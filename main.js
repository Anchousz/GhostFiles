const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  screen,
  Tray,
  Menu,
  globalShortcut,
  nativeImage,
} = require("electron");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const os = require("os");
const fileOps = require("./file-ops");
const { exec } = require("child_process");

let mainWindow;
let tray = null;
let boundsAnimation = null;
let boundsAnimating = false;
let panelCollapsed = false;
let expandedBounds = null;
let resizeTimeout = null;
const SETTINGS_PATH = path.join(app.getPath("userData"), "ghost-settings.json");
const TAB = 16;

const DEFAULTS = {
  side: "left",
  panelWidth: 340,
  panelHeight: 600,
  fontSize: 14,
  iconSize: 24,
  opacity: 1.0,
  alwaysOnTop: true,
  autoHide: false,
  // Keep a normal Windows taskbar button so DWM hover thumbnails are available.
  skipTaskbar: false,
  visualEffects: false,
  pinsHeight: 200,
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
      // Older builds stored skipTaskbar=true. Ignore that legacy value so the
      // taskbar button and its native Windows thumbnail stay enabled.
      return { ...DEFAULTS, ...saved, skipTaskbar: false };
    }
  } catch (e) {
    console.error("Settings load error:", e);
  }
  return { ...DEFAULTS };
}

function saveSettings(s) {
  try {
    // Taskbar presence is required for the Windows hover thumbnail.
    const normalized = { ...s, skipTaskbar: false };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(normalized, null, 2));
  } catch (e) {
    console.error("Settings save error:", e);
  }
}

function getBounds(s) {
  const { bounds } = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = bounds;
  const w = s.panelWidth || 340;
  const h = s.panelHeight || sh;
  switch (s.side) {
    case "right":
      return { x: sw - w, y: 0, width: w, height: h };
    case "top":
      return { x: 0, y: 0, width: sw, height: h };
    case "bottom":
      return { x: 0, y: sh - h, width: sw, height: h };
    default:
      return { x: 0, y: 0, width: w, height: h };
  }
}

function createWindow() {
  const s = loadSettings();
  mainWindow = new BrowserWindow({
    ...getBounds(s),
    icon: path.join(__dirname, "icon.ico"),
    frame: false,
    transparent: false, // ИСПРАВЛЕНО: Убрали прозрачность окна
    backgroundColor: "#000000", // ИСПРАВЛЕНО: Сплошной черный фон
    alwaysOnTop: s.alwaysOnTop,
    // Do not hide the app from the Windows taskbar: this enables hover previews.
    skipTaskbar: false,
    resizable: true,
    movable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep the native taskbar button enabled even when loading older settings.
  mainWindow.setSkipTaskbar(false);
  mainWindow.loadFile("index.html");
  mainWindow.setOpacity(s.opacity);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // If a user activates the taskbar button while the edge panel is collapsed,
  // expand it instead of leaving only the 16px shutter strip visible.
  mainWindow.on("focus", () => {
    if (panelCollapsed && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("toggle-collapse");
    }
  });

  mainWindow.on("resize", () => {
    if (!mainWindow.isVisible() || mainWindow.isMaximized()) return;

    // Never persist intermediate dimensions from the shutter animation.
    // Also cancel any pending debounce when the window becomes a narrow tab:
    // otherwise an older intermediate width could be saved after collapse.
    const b = mainWindow.getBounds();
    if (
      panelCollapsed ||
      boundsAnimating ||
      b.width <= TAB + 1 ||
      b.height <= TAB + 1
    ) {
      clearTimeout(resizeTimeout);
      resizeTimeout = null;
      return;
    }

    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (
        !mainWindow ||
        mainWindow.isDestroyed() ||
        panelCollapsed ||
        boundsAnimating ||
        !mainWindow.isVisible()
      ) return;

      // Read the latest bounds inside the callback, not the stale bounds
      // captured by the resize event.
      const latest = mainWindow.getBounds();
      if (latest.width <= TAB + 1 || latest.height <= TAB + 1) return;

      const currentS = loadSettings();
      currentS.panelWidth = latest.width;
      currentS.panelHeight = latest.height;
      saveSettings(currentS);
      expandedBounds = { ...latest };
      mainWindow.webContents.send("settings-updated", currentS);
    }, 200);
  });

  try {
    const iconPath = path.join(__dirname, "icon.png");
    const fallbackTrayImage = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFElEQVQ4T2NkYGD4z0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
    );
    let trayImage = fallbackTrayImage;
    if (fs.existsSync(iconPath)) {
      const sourceImage = nativeImage.createFromPath(iconPath);
      // A compact 16px image is the standard Windows notification-area size.
      if (!sourceImage.isEmpty()) {
        trayImage = sourceImage.resize({ width: 16, height: 16, quality: "best" });
      }
    }
    tray = new Tray(trayImage);
    const contextMenu = Menu.buildFromTemplate([
      { label: "Показать / Скрыть", click: () => toggleWindow() },
      { type: "separator" },
      {
        label: "Настройки",
        click: () => {
          if (!mainWindow || mainWindow.isDestroyed()) return;
          mainWindow.show();
          mainWindow.focus();
          if (panelCollapsed) mainWindow.webContents.send("toggle-collapse");
          mainWindow.webContents.send("open-settings");
        },
      },
      { type: "separator" },
      { label: "Выход", click: () => app.quit() },
    ]);
    tray.setToolTip("GHOST_FILES");
    tray.setContextMenu(contextMenu);
    tray.on("click", () => toggleWindow());
  } catch (e) {
    console.error("Tray creation error:", e);
  }
}

function toggleWindow() {
  if (!mainWindow) return;
  if (!mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    mainWindow.webContents.send("toggle-collapse");
  }
}

app.whenReady().then(() => {
  if (process.platform === "win32") app.setAppUserModelId("com.ghost.files");
  createWindow();
  const hotkeys = [
    "CommandOrControl+Alt+G",
    "CommandOrControl+Shift+G",
    "CommandOrControl+Alt+F",
  ];
  for (const hk of hotkeys) {
    if (globalShortcut.register(hk, () => toggleWindow())) {
      console.log(`[GHOST_FILES] Hotkey registered: ${hk}`);
      break;
    }
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── IPC ──────────────────────────────────────────────────────────────────
ipcMain.on("window-close", () => mainWindow.close());

// Animate the native window bounds together with the renderer's CSS shutter.
// This avoids the old effect where the contents slid away first and the
// narrow shutter strip/window snapped to its final size afterwards.
function animateWindowBounds(target, duration = 300) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (boundsAnimation) {
    clearInterval(boundsAnimation);
    boundsAnimation = null;
  }

  boundsAnimating = true;
  clearTimeout(resizeTimeout);
  resizeTimeout = null;

  const start = mainWindow.getBounds();
  const startedAt = Date.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  const finish = () => {
    if (boundsAnimation) clearInterval(boundsAnimation);
    boundsAnimation = null;
    boundsAnimating = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBounds(target);
    }
  };

  const tick = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      if (boundsAnimation) clearInterval(boundsAnimation);
      boundsAnimation = null;
      boundsAnimating = false;
      return;
    }

    const t = Math.min(1, (Date.now() - startedAt) / duration);
    const k = ease(t);
    const next = {
      x: Math.round(start.x + (target.x - start.x) * k),
      y: Math.round(start.y + (target.y - start.y) * k),
      width: Math.max(1, Math.round(start.width + (target.width - start.width) * k)),
      height: Math.max(1, Math.round(start.height + (target.height - start.height) * k)),
    };

    mainWindow.setBounds(next);
    if (t >= 1) finish();
  };

  tick();
  if (boundsAnimating) boundsAnimation = setInterval(tick, 16);
}
function getCollapsedBounds(s) {
  const { bounds } = screen.getPrimaryDisplay();
  switch (s.side) {
    case "right":
      return { x: bounds.width - TAB, y: 0, width: TAB, height: bounds.height };
    case "top":
      return { x: 0, y: 0, width: bounds.width, height: TAB };
    case "bottom":
      return { x: 0, y: bounds.height - TAB, width: bounds.width, height: TAB };
    default:
      return { x: 0, y: 0, width: TAB, height: bounds.height };
  }
}

ipcMain.on("collapse-panel", () => {
  if (!mainWindow || mainWindow.isDestroyed() || panelCollapsed) return;

  clearTimeout(resizeTimeout);
  resizeTimeout = null;

  // Snapshot the real expanded geometry BEFORE shrinking the native window.
  // This is the authoritative restore size even if settings were stale.
  const current = mainWindow.getBounds();
  if (current.width > TAB + 1 && current.height > TAB + 1) {
    expandedBounds = { ...current };
    const s = loadSettings();
    s.panelWidth = current.width;
    s.panelHeight = current.height;
    saveSettings(s);
  } else if (!expandedBounds) {
    expandedBounds = getBounds(loadSettings());
  }

  panelCollapsed = true;
  animateWindowBounds(getCollapsedBounds(loadSettings()));
});

ipcMain.handle("expand-panel", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  // Cancel an in-progress collapse and restore the last known full geometry.
  if (boundsAnimation) {
    clearInterval(boundsAnimation);
    boundsAnimation = null;
  }
  boundsAnimating = false;
  clearTimeout(resizeTimeout);
  resizeTimeout = null;

  const target = expandedBounds || getBounds(loadSettings());
  panelCollapsed = false;
  mainWindow.setBounds(target, false);
  expandedBounds = { ...target };
  return true;
});

ipcMain.handle("get-settings", () => loadSettings());
ipcMain.handle("save-settings", (_, ns) => {
  const s = { ...loadSettings(), ...ns, skipTaskbar: false };
  saveSettings(s);
  mainWindow.setAlwaysOnTop(s.alwaysOnTop);
  mainWindow.setSkipTaskbar(false);
  mainWindow.setOpacity(s.opacity);
  mainWindow.setBounds(getBounds(s), true);
  return s;
});

ipcMain.handle("get-autostart", () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle("set-autostart", (_, on) => {
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: on, path: process.execPath });
  }
  return app.isPackaged ? app.getLoginItemSettings().openAtLogin : false;
});

ipcMain.handle("read-dir", async (_, dir) => {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    let windowsHidden = new Set();

    // Query Windows Hidden/System attributes once per directory, not once per
    // file. The previous implementation spawned `attrib.exe` for every item.
    if (process.platform === "win32") {
      try {
        // Use UTF-16LE encoded PowerShell and Base64 UTF-8 names so paths with
        // apostrophes, spaces, or non-ASCII characters are handled correctly.
        const safeFolder = String(dir).replace(/'/g, "''");
        const script = `$folder = '${safeFolder}'; Get-ChildItem -LiteralPath $folder -Force | Where-Object { ($_.Attributes -band [System.IO.FileAttributes]::Hidden) -ne 0 -or ($_.Attributes -band [System.IO.FileAttributes]::System) -ne 0 } | ForEach-Object { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.Name)) }`;
        const encodedScript = Buffer.from(script, "utf16le").toString("base64");
        const { stdout } = await execFileAsync(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript],
          { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
        );
        windowsHidden = new Set(
          stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
            .map((value) => Buffer.from(value, "base64").toString("utf8")),
        );
      } catch (error) {
        console.warn("Could not read Windows hidden attributes:", error.message);
      }
    }

    const items = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      let size = 0;
      let mtime = null;
      let isSymlink = entry.isSymbolicLink();
      let isDirectory = entry.isDirectory();
      try {
        const linkStat = await fsp.lstat(fullPath);
        const itemStat = isSymlink ? await fsp.stat(fullPath).catch(() => linkStat) : linkStat;
        size = itemStat.size;
        mtime = itemStat.mtime.toISOString();
        isDirectory = itemStat.isDirectory();
      } catch {}

      const isHidden = entry.name.startsWith(".") || windowsHidden.has(entry.name);
      return {
        name: entry.name,
        path: fullPath,
        isDirectory,
        isSymlink,
        isHidden,
        ext: isDirectory ? "" : path.extname(entry.name).toLowerCase(),
        size,
        mtime,
      };
    }));

    return items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle("open-item", async (_, p) => {
  try {
    const error = await shell.openPath(p);
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle("get-home", async () => os.homedir());
ipcMain.handle("get-downloads", async () => app.getPath("downloads"));
ipcMain.handle("pick-folder", async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle("get-drives", async () => {
  if (process.platform !== "win32") return [{ path: "/", name: "root" }];
  const drives = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i) + ":";
    const p = letter + "\\";
    try {
      fs.accessSync(p);
      drives.push({ path: p, name: letter });
    } catch {}
  }
  return drives;
});

ipcMain.handle("get-pins", async () => {
  const home = os.homedir();
  return [
    { name: "Desktop", path: app.getPath("desktop") },
    { name: "Documents", path: app.getPath("documents") },
    { name: "Downloads", path: app.getPath("downloads") },
    { name: "Pictures", path: app.getPath("pictures") },
    { name: "Music", path: path.join(home, "Music") },
    { name: "Videos", path: path.join(home, "Videos") },
  ].filter((p) => {
    try {
      fs.accessSync(p.path);
      return true;
    } catch {
      return false;
    }
  });
});

ipcMain.handle("search-files", async (_, { dirPath, query }) => {
  const results = [],
    MAX = 80;
  async function walk(dir, depth) {
    if (results.length >= MAX || depth > 4) return;
    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (results.length >= MAX) break;
        if (e.name.toLowerCase().includes(query.toLowerCase()))
          results.push({
            name: e.name,
            path: path.join(dir, e.name),
            isDirectory: e.isDirectory(),
            ext: e.isDirectory() ? "" : path.extname(e.name).toLowerCase(),
          });
        if (e.isDirectory() && !e.name.startsWith("."))
          await walk(path.join(dir, e.name), depth + 1);
      }
    } catch {}
  }
  await walk(dirPath, 0);
  return results;
});

ipcMain.handle(
  "run-command",
  async (_, { command, cwd }) =>
    new Promise((resolve) =>
      exec(
        command,
        { cwd, shell: true, timeout: 30000 },
        (err, stdout, stderr) =>
          resolve({
            stdout: stdout || "",
            stderr: stderr || "",
            code: err ? err.code : 0,
          }),
      ),
    ),
);

ipcMain.handle("delete-files", async (_, inputPaths) => {
  const paths = [...new Set(Array.isArray(inputPaths) ? inputPaths : [])];
  if (!paths.length) return [];

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Отмена", "Удалить в корзину"],
    defaultId: 0,
    cancelId: 0,
    title: "Подтверждение",
    message: `Вы уверены, что хотите удалить ${paths.length} элемент(ов)?`,
  });
  if (response !== 1) return [{ ok: false, error: "cancelled" }];

  const results = [];
  for (const inputPath of paths) {
    let p;
    try {
      if (typeof inputPath !== "string" || !inputPath.trim()) {
        throw new Error("Не указан путь");
      }
      p = path.resolve(inputPath);
      await fsp.lstat(p);
      await shell.trashItem(p);
      results.push({ path: p, ok: true });
    } catch (e) {
      results.push({ path: p || String(inputPath), ok: false, error: e.message });
    }
  }
  return results;
});

ipcMain.handle("rename-file", async (_, options) => fileOps.renameFile(options));
ipcMain.handle("create-folder", async (_, options) => fileOps.createFolder(options));
ipcMain.handle("copy-files", async (_, options) =>
  fileOps.copyFiles(options?.paths, options?.destDir),
);
ipcMain.handle("move-files", async (_, options) =>
  fileOps.moveFiles(options?.paths, options?.destDir),
);
