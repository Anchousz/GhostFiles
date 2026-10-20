const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ghost", {
  close: () => ipcRenderer.send("window-close"),
  collapsePanel: () => ipcRenderer.send("collapse-panel"),
  expandPanel: () => ipcRenderer.invoke("expand-panel"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),
  getAutostart: () => ipcRenderer.invoke("get-autostart"),
  setAutostart: (on) => ipcRenderer.invoke("set-autostart", on),
  getHome: () => ipcRenderer.invoke("get-home"),
  getDownloads: () => ipcRenderer.invoke("get-downloads"),
  getPins: () => ipcRenderer.invoke("get-pins"),
  getDrives: () => ipcRenderer.invoke("get-drives"),
  readDir: (p) => ipcRenderer.invoke("read-dir", p),
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  searchFiles: (o) => ipcRenderer.invoke("search-files", o),
  openItem: (p) => ipcRenderer.invoke("open-item", p),
  deleteFiles: (ps) => ipcRenderer.invoke("delete-files", ps),
  renameFile: (o) => ipcRenderer.invoke("rename-file", o),
  createFolder: (o) => ipcRenderer.invoke("create-folder", o),
  copyFiles: (o) => ipcRenderer.invoke("copy-files", o),
  moveFiles: (o) => ipcRenderer.invoke("move-files", o),
  runCommand: (o) => ipcRenderer.invoke("run-command", o),

  onToggleCollapse: (cb) => ipcRenderer.on("toggle-collapse", cb),
  onOpenSettings: (cb) => ipcRenderer.on("open-settings", cb),
  onSettingsUpdated: (cb) =>
    ipcRenderer.on("settings-updated", (_, s) => cb(s)),
});
