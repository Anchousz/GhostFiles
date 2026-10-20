"use strict";

const $ = (id) => document.getElementById(id);

const S = {
  cwd: "",
  history: [],
  histIdx: -1,
  files: [],
  sortBy: localStorage.getItem("sortBy") || "name",
  showHidden: localStorage.getItem("showHidden") === "true",
  viewMode: localStorage.getItem("viewMode") || "grid",
  selected: new Set(),
  clip: { files: [], mode: null },
  ctxTarget: null,
  searchTimer: null,
  termHist: [],
  termHistIdx: -1,
  settings: {},
  isCollapsed: false,
  isExpanding: false,
  autoHide: false,
  autoHideTimer: null,
  matrixReq: null,
  fileOpBusy: false,
  dirLoadToken: 0,
};

const IMG = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
  ".ico",
  ".svg",
  ".tiff",
  ".heic",
];
const AUDIO = [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".opus"];
const VIDEO = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".wmv", ".flv"];
const CODE = [
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".vue",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".c",
  ".cpp",
  ".h",
  ".java",
  ".cs",
  ".php",
  ".html",
  ".css",
  ".scss",
  ".svelte",
  ".kt",
  ".swift",
];
const DATA = [
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".env",
  ".csv",
];
const SHELL = [".sh", ".bat", ".ps1", ".cmd", ".zsh"];
const ARCH = [".zip", ".rar", ".7z", ".tar", ".gz", ".xz", ".bz2"];
const EXE = [".exe", ".msi", ".dmg", ".deb"];

function icon(f) {
  if (f.isDirectory) return "📁";
  const e = (f.ext || "").toLowerCase();
  if (IMG.includes(e)) return "🖼";
  if (AUDIO.includes(e)) return "🎵";
  if (VIDEO.includes(e)) return "🎬";
  if (CODE.includes(e)) return "💻";
  if (DATA.includes(e)) return "📊";
  if (SHELL.includes(e)) return "⌨";
  if (ARCH.includes(e)) return "📦";
  if (EXE.includes(e)) return "⚙";
  if (e === ".pdf") return "📕";
  if ([".docx", ".doc"].includes(e)) return "📘";
  if ([".xlsx", ".xls"].includes(e)) return "📗";
  if ([".pptx", ".ppt"].includes(e)) return "📙";
  if ([".txt", ".md", ".log"].includes(e)) return "📄";
  return "📄";
}

const PIN_ICONS = {
  Desktop: "🖥",
  Documents: "📄",
  Downloads: "⬇",
  Pictures: "🖼",
  Music: "🎵",
  Videos: "🎬",
};

function fmtSize(b) {
  if (!b) return "—";
  if (b < 1024) return b + "B";
  if (b < 1 << 20) return (b / 1024).toFixed(1) + "K";
  if (b < 1 << 30) return (b / 1048576).toFixed(1) + "M";
  return (b / 1073741824).toFixed(2) + "G";
}
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function dirname(p) {
  const value = String(p || "");
  const sep = value.includes("\\") ? "\\" : "/";
  const clean = value.replace(/[\/]+$/, "");
  const index = clean.lastIndexOf(sep);

  if (sep === "\\") {
    if (index < 0) return value || ".";
    // Preserve drive roots such as C:\ when the parent is the drive root.
    if (index === 2 && /^[A-Za-z]:/.test(clean)) return clean.slice(0, 3);
    if (index === 0) return "\\";
    return clean.slice(0, index) || value;
  }

  if (!clean) return "/";
  if (index < 0) return ".";
  if (index === 0) return "/";
  return clean.slice(0, index);
}

function toast(msg, type = "ok") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  $("toast-area").appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

(function tick() {
  const n = new Date(),
    p = (x) => String(x).padStart(2, "0");
  $("sb-time").textContent =
    `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
  setTimeout(tick, 1000);
})();

// ════════════════════════════════════════════════════════
//  MATRIX RAIN (ВИЗУАЛЬНЫЙ ЭФФЕКТ)
// ════════════════════════════════════════════════════════
const canvas = $("bg-canvas");
const ctx = canvas.getContext("2d");
let cols, drops;
const FS = 14;
const CHARS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノ日月火水木金土人口山川｜ー―0123456789GHOSTFILES".split(
    "",
  );

function initMatrix() {
  const wrapper = $("app-wrapper");
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  cols = Math.floor(canvas.width / FS);
  drops = Array(cols)
    .fill(0)
    .map(() => Math.random() * -100);
}

function drawMatrix() {
  // Не рисуем, если эффекты выключены, окно скрыто, ИЛИ панель свернута
  if (
    !document.body.classList.contains("effects-on") ||
    document.hidden ||
    S.isCollapsed
  ) {
    S.matrixReq = requestAnimationFrame(drawMatrix);
    return;
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff"; // Чисто белый цвет
  ctx.font = FS + "px monospace";

  for (let i = 0; i < drops.length; i++) {
    const text = CHARS[Math.floor(Math.random() * CHARS.length)];
    ctx.fillText(text, i * FS, drops[i] * FS);
    if (drops[i] * FS > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
  S.matrixReq = requestAnimationFrame(drawMatrix);
}

const resizeObserver = new ResizeObserver(() => {
  initMatrix();
});
resizeObserver.observe($("app-wrapper"));

initMatrix();
S.matrixReq = requestAnimationFrame(drawMatrix);
// ════════════════════════════════════════════════════════

async function navigate(dir, push = true) {
  if (!dir) return;
  dir = dir.trim();
  if (push && dir !== S.cwd) {
    S.history = S.history.slice(0, S.histIdx + 1);
    S.history.push(dir);
    S.histIdx = S.history.length - 1;
  }
  S.cwd = dir;
  S.selected.clear();
  updateNavBtns();
  renderBreadcrumb(dir);
  $("sb-path").textContent = dir;
  $("term-cwd").textContent = dir;
  await loadDir(dir);
  highlightPin(dir);
}

function updateNavBtns() {
  $("btn-back").disabled = S.histIdx <= 0;
  $("btn-fwd").disabled = S.histIdx >= S.history.length - 1;
  $("btn-up").disabled = false;
}

const pathBar = $("path-bar");
const breadcrumb = $("breadcrumb");
const pathInput = $("path-input");

function renderBreadcrumb(dir) {
  const sep = dir.includes("\\") ? "\\" : "/";
  const parts = dir
    .replace(/[/\\]$/, "")
    .split(sep)
    .filter(Boolean);
  let html = "",
    acc = "";
  parts.forEach((part, i) => {
    if (i === 0 && dir.includes(":\\")) acc = part + "\\";
    else acc = (acc ? acc.replace(/[/\\]$/, "") + sep : "") + part;
    const p = acc;
    const isLast = i === parts.length - 1;
    if (!isLast)
      html += `<span class="bc-part" data-path="${esc(p)}">${esc(part)}</span><span class="bc-sep">›</span>`;
    else html += `<span class="bc-part last">${esc(part)}</span>`;
  });
  breadcrumb.innerHTML = html;
  breadcrumb.querySelectorAll(".bc-part:not(.last)").forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation();
      navigate(el.dataset.path);
    };
  });
}

pathBar.addEventListener("click", () => {
  breadcrumb.style.display = "none";
  pathInput.style.display = "block";
  pathInput.value = S.cwd;
  pathInput.focus();
  pathInput.select();
  pathBar.classList.add("editing");
});

pathInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const v = pathInput.value.trim();
    if (v) navigate(v);
    closePath();
  }
  if (e.key === "Escape") closePath();
  e.stopPropagation();
});
pathInput.addEventListener("blur", closePath);

function closePath() {
  pathInput.style.display = "none";
  breadcrumb.style.display = "";
  pathBar.classList.remove("editing");
}

async function loadDir(dir) {
  const token = ++S.dirLoadToken;
  $("loading").classList.add("active");
  $("files-grid").style.display = "none";
  $("empty-state").style.display = "none";

  try {
    const res = await window.ghost.readDir(dir);
    // Ignore a slower response from a directory the user has already left.
    if (token !== S.dirLoadToken || dir !== S.cwd) return;
    if (res && res.error) {
      toast("Ошибка чтения: " + res.error, "err");
      S.files = [];
      renderFiles();
      return;
    }
    S.files = Array.isArray(res) ? res : [];
    renderFiles();
  } catch (e) {
    if (token === S.dirLoadToken) toast("Ошибка чтения: " + e.message, "err");
  } finally {
    if (token === S.dirLoadToken) {
      $("loading").classList.remove("active");
      $("files-grid").style.display = "";
    }
  }
}

function getSorted() {
  let f = S.files.slice();
  if (!S.showHidden) f = f.filter((x) => !x.isHidden);
  f.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    if (S.sortBy === "name") return a.name.localeCompare(b.name);
    if (S.sortBy === "date")
      return (b.mtime || "").localeCompare(a.mtime || "");
    if (S.sortBy === "size") return b.size - a.size;
    return 0;
  });
  return f;
}


async function copyDroppedFiles(fileList, destination) {
  const paths = [...(fileList || [])]
    .map((file) => file && file.path)
    .filter((filePath) => typeof filePath === "string" && filePath.length);
  if (!paths.length || S.fileOpBusy) return;

  S.fileOpBusy = true;
  try {
    const results = await window.ghost.copyFiles({ paths, destDir: destination });
    const items = Array.isArray(results) ? results : [];
    const copied = items.filter((item) => item.ok).length;
    const failed = items.filter((item) => !item.ok);
    if (copied) toast(`Добавлено файлов: ${copied}`);
    if (failed.length) toast(`Не удалось добавить: ${failed.length} — ${failed[0].error || "ошибка"}`, "err");
    if (destination === S.cwd) await loadDir(S.cwd);
  } catch (error) {
    toast("Ошибка импорта файлов: " + error.message, "err");
  } finally {
    S.fileOpBusy = false;
  }
}

function renderFiles() {
  const files = getSorted();
  const grid = $("files-grid");
  grid.innerHTML = "";

  if (!files.length) {
    $("empty-state").style.display = "flex";
    $("item-count").textContent = "0 items";
    return;
  }
  $("empty-state").style.display = "none";
  const dirs = files.filter((f) => f.isDirectory).length;
  $("item-count").textContent = `${dirs} папок, ${files.length - dirs} файлов`;

  files.forEach((f, i) => {
    const card = document.createElement("div");
    const isCut = S.clip.mode === "cut" && S.clip.files.includes(f.path);
    card.className =
      "file-card" +
      (S.selected.has(f.path) ? " selected" : "") +
      (isCut ? " cut" : "");
    card.dataset.path = f.path;
    card.draggable = true;

    const ico = document.createElement("div");
    ico.className = "f-ico";
    ico.textContent = icon(f);
    const name = document.createElement("div");
    name.className = "f-name";
    name.textContent = f.name;

    card.appendChild(ico);
    card.appendChild(name);

    if (S.viewMode === "list") {
      const meta = document.createElement("div");
      meta.className = "f-meta";
      meta.textContent = f.isDirectory ? "" : fmtSize(f.size);
      card.appendChild(meta);
    }
    if (!f.isDirectory && f.ext) {
      const ext = document.createElement("div");
      ext.className = "f-ext";
      ext.textContent = f.ext.replace(".", "");
      card.appendChild(ext);
    }

    card.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (S.selected.has(f.path)) S.selected.delete(f.path);
        else S.selected.add(f.path);
        updateSelectionUI();
        return;
      }
      if (e.shiftKey && S.selected.size) {
        const filesArr = getSorted();
        const last = filesArr.findIndex((x) => S.selected.has(x.path));
        const curr = filesArr.indexOf(f);
        const [lo, hi] = [Math.min(last, curr), Math.max(last, curr)];
        filesArr.slice(lo, hi + 1).forEach((x) => S.selected.add(x.path));
        updateSelectionUI();
        return;
      }
      S.selected.clear();
      S.selected.add(f.path);
      updateSelectionUI();
      cardOpen(f);
    });

    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      S.ctxTarget = f;
      // Right-clicking an unselected item makes it the operation target,
      // while right-clicking within a multi-selection preserves the group.
      if (!S.selected.has(f.path)) {
        S.selected.clear();
        S.selected.add(f.path);
        updateSelectionUI();
      }
      showCtx(e.clientX, e.clientY);
    });

    card.addEventListener("dragstart", (e) => {
      if (!S.selected.has(f.path)) {
        S.selected.clear();
        S.selected.add(f.path);
        updateSelectionUI();
      }
      const paths = [...S.selected];
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/x-ghost-files", JSON.stringify(paths));
      e.dataTransfer.setData("text/plain", paths.join("\n"));
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      document.querySelectorAll(".file-card").forEach((el) => {
        el.classList.remove("dragging", "drop-target");
      });
    });
    if (f.isDirectory) {
      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        card.classList.add("drop-target");
      });
      card.addEventListener("dragleave", (e) => {
        if (!card.contains(e.relatedTarget)) card.classList.remove("drop-target");
      });
      card.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.classList.remove("drop-target");
        let paths = [];
        try { paths = JSON.parse(e.dataTransfer.getData("application/x-ghost-files") || "[]"); } catch {}
        if (paths.length) {
          await movePathsTo(paths, f.path);
        } else if (e.dataTransfer.files && e.dataTransfer.files.length) {
          await copyDroppedFiles(e.dataTransfer.files, f.path);
        }
      });
    }
    grid.appendChild(card);
  });

  updateSel();
}

const filesGrid = $("files-grid");
filesGrid.addEventListener("dragover", (e) => {
  if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
});
filesGrid.addEventListener("drop", async (e) => {
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    e.preventDefault();
    await copyDroppedFiles(e.dataTransfer.files, S.cwd);
  }
});

function updateSelectionUI() {
  document.querySelectorAll(".file-card").forEach((card) => {
    card.classList.toggle("selected", S.selected.has(card.dataset.path));
  });
  updateSel();
}

async function cardOpen(f) {
  if (f.isDirectory) {
    await navigate(f.path);
    return;
  }
  try {
    const result = await window.ghost.openItem(f.path);
    if (result && result.ok === false) toast("Не удалось открыть: " + result.error, "err");
  } catch (error) {
    toast("Не удалось открыть: " + error.message, "err");
  }
}

function updateSel() {
  $("sb-sel").textContent = S.selected.size
    ? `${S.selected.size} выделено`
    : "";
}

function startRename(file) {
  const card = document.querySelector(
    `.file-card[data-path="${CSS.escape(file.path)}"]`,
  );
  if (!card) return;
  const nameEl = card.querySelector(".f-name");
  const input = document.createElement("input");
  input.className = "rename-input";
  input.value = file.name;
  nameEl.replaceWith(input);
  input.focus();
  const dotIdx = file.isDirectory ? -1 : file.name.lastIndexOf(".");
  input.setSelectionRange(0, dotIdx > 0 ? dotIdx : file.name.length);

  let committed = false;
  async function commit() {
    if (committed) return;
    committed = true;
    const newName = input.value.trim();
    if (!newName || newName === file.name) {
      renderFiles();
      return;
    }
    const res = await window.ghost.renameFile({ oldPath: file.path, newName });
    if (res.ok) {
      toast(`Переименовано → ${newName}`);
      await loadDir(S.cwd);
      if (res.newPath) {
        S.selected = new Set([res.newPath]);
        updateSelectionUI();
      }
    } else {
      toast("Ошибка: " + res.error, "err");
      await loadDir(S.cwd);
    }
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      committed = true;
      renderFiles();
    }
    e.stopPropagation();
  });
  input.addEventListener("blur", commit);
}

function getOperationSelection() {
  if (S.selected.size) return [...S.selected];
  return S.ctxTarget ? [S.ctxTarget.path] : [];
}

function doCopy() {
  const sel = getOperationSelection();
  if (!sel.length) return;
  S.clip = { files: sel, mode: "copy" };
  toast(`В буфере копирования: ${sel.length}`);
  updateClipStatus();
  updateSelectionUI();
}
function doCut() {
  const sel = getOperationSelection();
  if (!sel.length) return;
  S.clip = { files: sel, mode: "cut" };
  toast(`Подготовлено к перемещению: ${sel.length}`);
  updateClipStatus();
  renderFiles();
}

async function runMove(paths, destDir, opts = {}) {
  if (S.fileOpBusy || !paths.length) return [];
  S.fileOpBusy = true;
  try {
    const results = await window.ghost.moveFiles({ paths, destDir });
    const list = Array.isArray(results) ? results : [];
    const ok = list.filter((item) => item.ok).length;
    const fail = list.length - ok;
    if (ok) toast(`Перемещено: ${ok}`);
    if (fail) {
      const firstError = list.find((item) => !item.ok)?.error;
      toast(`Не удалось переместить: ${fail}${firstError ? ` — ${firstError}` : ""}`, "err");
    }
    if (opts.reloadCurrent) await loadDir(S.cwd);
    return list;
  } catch (e) {
    toast("Ошибка перемещения: " + e.message, "err");
    return [];
  } finally {
    S.fileOpBusy = false;
  }
}

async function movePathsTo(paths, destDir) {
  if (S.fileOpBusy) return;
  // A directory cannot be dropped into itself or any selected folder inside it.
  const filtered = paths.filter((itemPath) => itemPath !== destDir);
  if (!filtered.length) return;
  const results = await runMove(filtered, destDir);
  const moved = new Set(results.filter((item) => item.ok).map((item) => item.src));
  S.selected = new Set([...S.selected].filter((p) => !moved.has(p)));
  updateSelectionUI();
  if (moved.size) await loadDir(S.cwd);
}

async function doPaste() {
  if (!S.clip.files.length || S.fileOpBusy) return;
  const files = [...S.clip.files];
  const mode = S.clip.mode;
  S.fileOpBusy = true;
  try {
    const op = mode === "cut" ? window.ghost.moveFiles : window.ghost.copyFiles;
    const res = await op({ paths: files, destDir: S.cwd });
    const results = Array.isArray(res) ? res : [];
    const ok = results.filter((item) => item.ok).length;
    const failed = results.filter((item) => !item.ok);
    if (ok) toast(`${mode === "cut" ? "Перемещено" : "Скопировано"}: ${ok}`);
    if (failed.length) {
      const firstError = failed[0].error;
      toast(`Не выполнено: ${failed.length}${firstError ? ` — ${firstError}` : ""}`, "err");
    }

    // A partial cut must retain only the paths that did not move successfully.
    // Copy buffers remain reusable, as in a conventional file manager.
    if (mode === "cut") {
      const moved = new Set(results.filter((item) => item.ok).map((item) => item.src));
      const remaining = files.filter((p) => !moved.has(p));
      S.clip = { files: remaining, mode: remaining.length ? "cut" : null };
    }
    updateClipStatus();
    await loadDir(S.cwd);
  } catch (e) {
    toast("Ошибка вставки: " + e.message, "err");
  } finally {
    S.fileOpBusy = false;
    renderFiles();
  }
}

async function doDelete() {
  const sel = getOperationSelection();
  if (!sel.length || S.fileOpBusy) return;
  S.fileOpBusy = true;
  try {
    const res = await window.ghost.deleteFiles(sel);
    if (res[0] && res[0].error === "cancelled") return;
    const results = Array.isArray(res) ? res : [];
    const ok = results.filter((item) => item.ok).length;
    const failed = results.filter((item) => !item.ok);
    if (ok) toast(`В корзину: ${ok}`);
    if (failed.length) toast(`Не удалено: ${failed.length} — ${failed[0].error || "ошибка"}`, "err");
    const failedPaths = new Set(failed.map((item) => item.path));
    S.selected = new Set([...S.selected].filter((p) => failedPaths.has(p)));
    await loadDir(S.cwd);
    updateSelectionUI();
  } catch (e) {
    toast("Ошибка удаления: " + e.message, "err");
  } finally {
    S.fileOpBusy = false;
  }
}
async function doNewFolder() {
  if (S.fileOpBusy) return;
  S.fileOpBusy = true;
  try {
    const name = "Новая папка";
    const res = await window.ghost.createFolder({ dir: S.cwd, name });
    if (res.ok) {
      toast("Папка создана");
      await loadDir(S.cwd);
      const file = S.files.find((f) => f.path === res.path);
      if (file) {
        S.selected = new Set([file.path]);
        renderFiles();
        setTimeout(() => startRename(file), 80);
      }
    } else toast("Ошибка: " + res.error, "err");
  } catch (error) {
    toast("Ошибка создания папки: " + error.message, "err");
  } finally {
    S.fileOpBusy = false;
  }
}
function selectAll() {
  getSorted().forEach((f) => S.selected.add(f.path));
  updateSelectionUI();
}
function updateClipStatus() {
  $("sb-clip").textContent = S.clip.files.length
    ? `${S.clip.mode === "cut" ? "✂" : "📋"} ${S.clip.files.length}`
    : "";
}

const ctxMenu = $("ctx-menu");
function showCtx(x, y) {
  const mw = ctxMenu.offsetWidth || 152,
    mh = ctxMenu.offsetHeight || 200;
  ctxMenu.style.left = Math.min(x, window.innerWidth - mw - 4) + "px";
  ctxMenu.style.top = Math.min(y, window.innerHeight - mh - 4) + "px";
  ctxMenu.classList.add("visible");
  $("ctx-paste").classList.toggle("dim", !S.clip.files.length);
}
function hideCtx() {
  ctxMenu.classList.remove("visible");
}

$("ctx-open").onclick = () => {
  if (S.ctxTarget) cardOpen(S.ctxTarget);
  hideCtx();
};
$("ctx-open-term").onclick = () => {
  if (!S.ctxTarget) return hideCtx();
  const dir = S.ctxTarget.isDirectory
    ? S.ctxTarget.path
    : dirname(S.ctxTarget.path);
  navigate(dir).then(() => {
    $("term-panel").classList.add("open");
    $("term-in").focus();
  });
  hideCtx();
};
$("ctx-copy").onclick = () => {
  doCopy();
  hideCtx();
};
$("ctx-cut").onclick = () => {
  doCut();
  hideCtx();
};
$("ctx-paste").onclick = () => {
  doPaste();
  hideCtx();
};
$("ctx-rename").onclick = () => {
  if (S.ctxTarget) startRename(S.ctxTarget);
  hideCtx();
};
$("ctx-delete").onclick = () => {
  doDelete();
  hideCtx();
};
$("ctx-new-folder").onclick = () => {
  doNewFolder();
  hideCtx();
};
$("ctx-copy-path").onclick = async () => {
  if (!S.ctxTarget) return hideCtx();
  try {
    await navigator.clipboard.writeText(S.ctxTarget.path);
    toast("Путь скопирован");
  } catch (e) {
    toast("Не удалось скопировать путь: " + e.message, "err");
  }
  hideCtx();
};

document.addEventListener("click", (e) => {
  if (!ctxMenu.contains(e.target)) hideCtx();
  const sr = $("search-results");
  if (!sr.contains(e.target) && e.target !== $("search-input"))
    sr.classList.remove("visible");
});
document.addEventListener("contextmenu", (e) => {
  if (!e.target.closest(".file-card")) {
    e.preventDefault();
    S.ctxTarget = null;
    showCtx(e.clientX, e.clientY);
  }
});

document.addEventListener("keydown", (e) => {
  const inInput =
    e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";
  const ctrl = e.ctrlKey || e.metaKey;

  if (
    e.target === $("path-input") ||
    e.target === $("search-input") ||
    e.target === $("term-in")
  )
    return;
  if (e.key === "`") {
    toggleTerm();
    return;
  }
  if (inInput || e.target.isContentEditable) return;

  if (e.key === "Escape") {
    S.selected.clear();
    updateSelectionUI();
    hideCtx();
    return;
  }
  if (e.key === "Backspace" && !ctrl) {
    goUp();
    e.preventDefault();
    return;
  }
  if (e.key === "F5") {
    loadDir(S.cwd);
    return;
  }
  if (e.altKey && e.key === "ArrowLeft") {
    goBack();
    e.preventDefault();
    return;
  }
  if (e.altKey && e.key === "ArrowRight") {
    goFwd();
    e.preventDefault();
    return;
  }

  if (ctrl && e.key.toLowerCase() === "c") {
    doCopy();
    e.preventDefault();
    return;
  }
  if (ctrl && e.key.toLowerCase() === "x") {
    doCut();
    e.preventDefault();
    return;
  }
  if (ctrl && e.key.toLowerCase() === "v") {
    doPaste();
    e.preventDefault();
    return;
  }
  if (ctrl && e.key.toLowerCase() === "a") {
    selectAll();
    e.preventDefault();
    return;
  }
  if (ctrl && e.shiftKey && e.key.toLowerCase() === "n") {
    doNewFolder();
    e.preventDefault();
    return;
  }
  if (e.key === "Delete") {
    doDelete();
    return;
  }
  if (e.key === "F2") {
    const f = firstSelected();
    if (f) startRename(f);
    return;
  }
  if (e.key === "Enter") {
    const f = firstSelected();
    if (f) cardOpen(f);
    return;
  }

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    arrowNav(e.key);
    e.preventDefault();
  }
});

function firstSelected() {
  return S.selected.size ? S.files.find((f) => S.selected.has(f.path)) : null;
}

function arrowNav(key) {
  const cards = [...document.querySelectorAll(".file-card")];
  if (!cards.length) return;
  const sel = cards.findIndex((c) => c.classList.contains("selected"));
  const cols =
    S.viewMode === "list"
      ? 1
      : Math.max(
          1,
          Math.floor($("files-grid").getBoundingClientRect().width / 100),
        );
  let next = sel < 0 ? 0 : sel;
  if (key === "ArrowRight") next = Math.min(sel + 1, cards.length - 1);
  if (key === "ArrowLeft") next = Math.max(sel - 1, 0);
  if (key === "ArrowDown") next = Math.min(sel + cols, cards.length - 1);
  if (key === "ArrowUp") next = Math.max(sel - cols, 0);
  if (next !== sel) {
    S.selected.clear();
    S.selected.add(cards[next].dataset.path);
    updateSelectionUI();
    cards[next].scrollIntoView({ block: "nearest" });
  }
}

$("btn-back").onclick = goBack;
$("btn-fwd").onclick = goFwd;
$("btn-up").onclick = goUp;
$("btn-pick-dir").onclick = async () => {
  const d = await window.ghost.pickFolder();
  if (d) navigate(d);
};

function goBack() {
  if (S.histIdx > 0) {
    S.histIdx--;
    navigate(S.history[S.histIdx], false);
  }
}
function goFwd() {
  if (S.histIdx < S.history.length - 1) {
    S.histIdx++;
    navigate(S.history[S.histIdx], false);
  }
}
function goUp() {
  if (!S.cwd) return;
  const p = dirname(S.cwd);
  if (p && p !== S.cwd) navigate(p);
}

function setSort(by) {
  S.sortBy = by;
  localStorage.setItem("sortBy", by);
  ["sort-name", "sort-date", "sort-size"].forEach((id) =>
    $(id).classList.remove("active"),
  );
  $("sort-" + by).classList.add("active");
  renderFiles();
}
$("sort-name").onclick = () => setSort("name");
$("sort-date").onclick = () => setSort("date");
$("sort-size").onclick = () => setSort("size");
$("toggle-hidden").onclick = function () {
  S.showHidden = !S.showHidden;
  localStorage.setItem("showHidden", S.showHidden);
  this.classList.toggle("active", S.showHidden);
  renderFiles();
};

$("btn-vg").onclick = () => {
  S.viewMode = "grid";
  localStorage.setItem("viewMode", "grid");
  $("files-grid").classList.remove("list-mode");
  $("btn-vg").classList.add("active");
  $("btn-vl").classList.remove("active");
  renderFiles();
};
$("btn-vl").onclick = () => {
  S.viewMode = "list";
  localStorage.setItem("viewMode", "list");
  $("files-grid").classList.add("list-mode");
  $("btn-vl").classList.add("active");
  $("btn-vg").classList.remove("active");
  renderFiles();
};

async function loadPins() {
  const [pins, drives] = await Promise.all([
    window.ghost.getPins(),
    window.ghost.getDrives(),
  ]);
  const list = $("pins-list");
  list.innerHTML = "";
  [...pins, ...drives.map((d) => ({ ...d, isDrive: true }))].forEach((p) => {
    const el = document.createElement("div");
    el.className = "pin-item";
    el.dataset.path = p.path;
    el.innerHTML = `<span class="pi">${PIN_ICONS[p.name] || "💾"}</span><span>${p.isDrive ? p.name + "\\" : p.name}</span>`;
    el.onclick = () => navigate(p.path);
    list.appendChild(el);
  });
}

function highlightPin(dir) {
  document
    .querySelectorAll(".pin-item")
    .forEach((el) =>
      el.classList.toggle(
        "active",
        dir === el.dataset.path || dir.startsWith(el.dataset.path + "\\"),
      ),
    );
}

const searchInput = $("search-input");
const searchResults = $("search-results");

searchInput.addEventListener("input", () => {
  clearTimeout(S.searchTimer);
  const q = searchInput.value.trim();
  if (!q) {
    searchResults.classList.remove("visible");
    return;
  }
  S.searchTimer = setTimeout(() => doSearch(q), 280);
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    searchResults.classList.remove("visible");
    searchInput.value = "";
    searchInput.blur();
  }
  e.stopPropagation();
});

async function doSearch(q) {
  const res = await window.ghost.searchFiles({ dirPath: S.cwd, query: q });
  if (!res || !res.length) {
    searchResults.innerHTML =
      '<div class="sr-i"><span class="sri-name" style="color:var(--dim)">Ничего не найдено</span></div>';
    searchResults.classList.add("visible");
    return;
  }
  searchResults.innerHTML = res
    .map(
      (f) =>
        `<div class="sr-i" data-path="${esc(f.path)}" data-isdir="${f.isDirectory}">
      <span class="sri-ico">${icon(f)}</span>
      <span class="sri-name">${esc(f.name)}</span>
      <span class="sri-path">${esc(dirname(f.path))}</span>
    </div>`,
    )
    .join("");
  searchResults.classList.add("visible");
  searchResults.querySelectorAll(".sr-i").forEach((el) => {
    el.onclick = () => {
      const p = el.dataset.path;
      if (el.dataset.isdir === "true") {
        navigate(p);
      } else {
        navigate(dirname(p)).then(() => window.ghost.openItem(p)).then((result) => {
          if (result && result.ok === false) toast("Не удалось открыть: " + result.error, "err");
        }).catch((error) => toast("Не удалось открыть: " + error.message, "err"));
      }
      searchResults.classList.remove("visible");
      searchInput.value = "";
    };
  });
}

const termPanel = $("term-panel");
const termOut = $("term-out");
const termIn = $("term-in");

function toggleTerm() {
  termPanel.classList.toggle("open");
  if (termPanel.classList.contains("open")) {
    termIn.focus();
    if (!termOut.children.length)
      termLog("GHOST_FILES terminal ready.", "info");
  }
}
$("btn-term").onclick = toggleTerm;
$("term-clear").onclick = () => {
  termOut.innerHTML = "";
};

function termLog(txt, type = "stdout") {
  const s = document.createElement("span");
  s.className = `tl ${type}`;
  s.textContent = txt;
  termOut.appendChild(s);
  termOut.appendChild(document.createElement("br"));
  termOut.scrollTop = termOut.scrollHeight;
}

termIn.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    const cmd = termIn.value.trim();
    if (!cmd) return;
    S.termHist.unshift(cmd);
    S.termHistIdx = -1;
    termLog("❯ " + cmd, "prompt");
    termIn.value = "";
    if (cmd === "cd" || cmd.startsWith("cd ")) {
      const t =
        cmd === "cd" ? await window.ghost.getHome() : cmd.slice(3).trim();
      await navigate(t);
      return;
    }
    if (cmd === "cls" || cmd === "clear") {
      termOut.innerHTML = "";
      return;
    }
    const { stdout, stderr } = await window.ghost.runCommand({
      command: cmd,
      cwd: S.cwd,
    });
    if (stdout) termLog(stdout, "stdout");
    if (stderr) termLog(stderr, "stderr");
  }
  if (e.key === "ArrowUp") {
    if (S.termHistIdx < S.termHist.length - 1) {
      S.termHistIdx++;
      termIn.value = S.termHist[S.termHistIdx];
    }
    e.preventDefault();
  }
  if (e.key === "ArrowDown") {
    if (S.termHistIdx > 0) {
      S.termHistIdx--;
      termIn.value = S.termHist[S.termHistIdx];
    } else {
      S.termHistIdx = -1;
      termIn.value = "";
    }
    e.preventDefault();
  }
  if (e.key === "Escape") termPanel.classList.remove("open");
  e.stopPropagation();
});

// ════════════════════════════════════════════════════════
//  SHUTTER & AUTO-HIDE
// ════════════════════════════════════════════════════════
const shutterTab = $("shutter-tab");
const stArrow = $("st-arrow");
const appWrapper = $("app-wrapper");

function updateArrow() {
  const side = S.settings.side || "left";
  if (side === "left") stArrow.textContent = S.isCollapsed ? "▶" : "◀";
  if (side === "right") stArrow.textContent = S.isCollapsed ? "◀" : "▶";
  if (side === "top") stArrow.textContent = S.isCollapsed ? "▼" : "▲";
  if (side === "bottom") stArrow.textContent = S.isCollapsed ? "▲" : "▼";
}

function doCollapse() {
  if (S.isCollapsed) return;
  S.isCollapsed = true;
  $("settings-drawer").classList.remove("open");
  document.body.classList.add("collapsed");
  window.ghost.collapsePanel();
  updateArrow();
}

async function doExpand() {
  if (!S.isCollapsed || S.isExpanding) return;
  S.isExpanding = true;
  cancelCollapse();
  try {
    // Expand the native window first; the CSS shutter then slides out smoothly.
    await window.ghost.expandPanel();
    S.isCollapsed = false;
    document.body.classList.remove("collapsed");
    updateArrow();
  } catch (err) {
    console.error("Panel expand failed:", err);
  } finally {
    S.isExpanding = false;
  }
}

shutterTab.addEventListener("click", () => {
  if (S.isCollapsed) doExpand();
  else doCollapse();
});

window.ghost.onToggleCollapse(() => {
  if (S.isCollapsed) doExpand();
  else doCollapse();
});

function scheduleCollapse() {
  if (!S.autoHide || S.isCollapsed) return;
  if (ctxMenu.classList.contains("visible")) return;
  clearTimeout(S.autoHideTimer);
  S.autoHideTimer = setTimeout(() => {
    if (!S.autoHide || S.isCollapsed) return;
    if (ctxMenu.classList.contains("visible")) return;
    doCollapse();
  }, 900);
}

function cancelCollapse() {
  clearTimeout(S.autoHideTimer);
  S.autoHideTimer = null;
}

appWrapper.addEventListener("mouseleave", (e) => {
  if (shutterTab.contains(e.relatedTarget) || e.relatedTarget === shutterTab)
    return;
  scheduleCollapse();
});
appWrapper.addEventListener("mouseenter", cancelCollapse);

shutterTab.addEventListener("mouseenter", () => {
  cancelCollapse();
  if (S.autoHide && S.isCollapsed) doExpand();
});
shutterTab.addEventListener("mouseleave", (e) => {
  if (appWrapper.contains(e.relatedTarget) || e.relatedTarget === appWrapper)
    return;
  scheduleCollapse();
});

ctxMenu.addEventListener("mouseenter", cancelCollapse);
ctxMenu.addEventListener("mouseleave", (e) => {
  if (appWrapper.contains(e.relatedTarget) || e.relatedTarget === appWrapper)
    return;
  if (shutterTab.contains(e.relatedTarget) || e.relatedTarget === shutterTab)
    return;
  scheduleCollapse();
});

// ════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════
$("btn-settings").onclick = () => $("settings-drawer").classList.add("open");
$("btn-settings-close").onclick = () =>
  $("settings-drawer").classList.remove("open");
window.ghost.onOpenSettings(() => $("settings-drawer").classList.add("open"));

function bindSlider(id, valId, suffix = "") {
  const sl = $(id),
    vl = $(valId);
  sl.addEventListener("input", () => {
    vl.textContent = sl.value + suffix;
  });
}
bindSlider("s-width", "sv-width", "px");
bindSlider("s-height", "sv-height", "px");
bindSlider("s-font", "sv-font", "px");
bindSlider("s-icon", "sv-icon", "px");
bindSlider("s-opacity", "sv-opacity", "%");
bindSlider("s-pins-h", "sv-pins-h", "px");

document.querySelectorAll(".side-opt").forEach((el) => {
  el.onclick = () => {
    document
      .querySelectorAll(".side-opt")
      .forEach((x) => x.classList.remove("active"));
    el.classList.add("active");
  };
});

function bindToggle(id) {
  $(id).addEventListener("click", () => $(id).classList.toggle("on"));
}
bindToggle("tt-top");
bindToggle("tt-autohide");
bindToggle("tt-autostart");
bindToggle("tt-fx");

function populateSettings(s) {
  $("s-width").value = s.panelWidth || 340;
  $("sv-width").textContent = $("s-width").value + "px";
  $("s-height").value = s.panelHeight || 600;
  $("sv-height").textContent = $("s-height").value + "px";
  $("s-font").value = s.fontSize || 14;
  $("sv-font").textContent = $("s-font").value + "px";
  $("s-icon").value = s.iconSize || 24;
  $("sv-icon").textContent = $("s-icon").value + "px";
  $("s-opacity").value = Math.round((s.opacity || 1) * 100);
  $("sv-opacity").textContent = $("s-opacity").value + "%";

  $("s-pins-h").value = s.pinsHeight !== undefined ? s.pinsHeight : 200;
  $("sv-pins-h").textContent = $("s-pins-h").value + "px";

  document
    .querySelectorAll(".side-opt")
    .forEach((el) =>
      el.classList.toggle("active", el.dataset.side === (s.side || "left")),
    );
  $("tt-top").classList.toggle("on", !!s.alwaysOnTop);
  $("tt-autohide").classList.toggle("on", !!s.autoHide);
  $("tt-fx").classList.toggle("on", !!s.visualEffects);
}

$("s-save").onclick = async () => {
  const side = (
    document.querySelector(".side-opt.active") || { dataset: { side: "left" } }
  ).dataset.side;
  const ns = {
    side,
    panelWidth: parseInt($("s-width").value),
    panelHeight: parseInt($("s-height").value),
    fontSize: parseInt($("s-font").value),
    iconSize: parseInt($("s-icon").value),
    opacity: parseInt($("s-opacity").value) / 100,
    alwaysOnTop: $("tt-top").classList.contains("on"),
    autoHide: $("tt-autohide").classList.contains("on"),
    visualEffects: $("tt-fx").classList.contains("on"),
    pinsHeight: parseInt($("s-pins-h").value),
  };

  const isAutostart = $("tt-autostart").classList.contains("on");
  await window.ghost.setAutostart(isAutostart);

  S.settings = await window.ghost.saveSettings(ns);
  applySettings(S.settings);

  const btn = $("s-save");
  btn.textContent = "✓ СОХРАНЕНО";
  btn.style.color = "var(--hi)";
  toast("Настройки сохранены", "ok");
  setTimeout(() => {
    btn.textContent = "APPLY SETTINGS";
    btn.style.color = "";
  }, 1500);
};

window.ghost.onSettingsUpdated((newSettings) => {
  S.settings = newSettings;
  populateSettings(newSettings);
});

function applySettings(s) {
  document.documentElement.style.setProperty("--fs", (s.fontSize || 14) + "px");
  document.documentElement.style.setProperty(
    "--icon-sz",
    (s.iconSize || 24) + "px",
  );
  document.documentElement.style.setProperty(
    "--pins-h",
    (s.pinsHeight !== undefined ? s.pinsHeight : 200) + "px",
  );
  document.body.className =
    "side-" +
    (s.side || "left") +
    (S.isCollapsed ? " collapsed" : "") +
    (s.visualEffects ? " effects-on" : "");
  S.autoHide = !!s.autoHide;
  updateArrow();
}

function applyUIState() {
  if (S.viewMode === "list") {
    $("files-grid").classList.add("list-mode");
    $("btn-vl").classList.add("active");
    $("btn-vg").classList.remove("active");
  } else {
    $("files-grid").classList.remove("list-mode");
    $("btn-vg").classList.add("active");
    $("btn-vl").classList.remove("active");
  }
  ["sort-name", "sort-date", "sort-size"].forEach((id) =>
    $(id).classList.remove("active"),
  );
  $("sort-" + S.sortBy).classList.add("active");
  $("toggle-hidden").classList.toggle("active", S.showHidden);
}

async function init() {
  S.settings = await window.ghost.getSettings();
  applySettings(S.settings);
  populateSettings(S.settings);
  applyUIState();

  const autostartOn = await window.ghost.getAutostart();
  $("tt-autostart").classList.toggle("on", autostartOn);

  await loadPins();
  const downloads = await window.ghost.getDownloads();
  await navigate(downloads);
}

init();
