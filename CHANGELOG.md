# Changelog

## 1.0.1 — taskbar and tray update

- Kept the GHOST_FILES icon visible in the Windows notification area (system tray).
- Enabled the Windows taskbar button so the native hover thumbnail can be displayed.
- Migrated legacy settings that previously hid the taskbar button.
- Resized the tray artwork to the standard 16px notification-area size.
- Added Russian GitHub publishing instructions and expanded the project README.

## 1.0.0 — release candidate

- Hardened copy, cut/paste, move, rename, folder creation and delete reporting.
- Added collision-safe copy names and rejected unsafe overwrite/move cases.
- Prevented copying/moving directories into themselves or their descendants.
- Avoided duplicate processing when both a folder and one of its children are selected.
- Added drag-and-drop import from Explorer and drag-to-folder moves.
- Serialized long-running file operations to avoid overlapping refreshes.
- Improved hidden/system attribute detection for Windows Unicode filenames.
- Added automated tests and source checks.
- Updated the Electron dependency to the supported 44.x line and configured app/window icons.
