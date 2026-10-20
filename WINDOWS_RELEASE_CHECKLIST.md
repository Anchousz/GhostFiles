# Windows release checklist

Automated checks are not a substitute for running the packaged app on a real Windows 10/11 machine. Complete these checks before publishing an installer.

## Build and launch

- [ ] Run `npm install`, `npm test`, `npm run check`, and `npm run build`.
- [ ] Install the generated installer on a clean Windows account or VM.
- [ ] Launch GHOST_FILES, close it, relaunch it, and confirm settings persist.
- [ ] Confirm the app icon appears correctly in the system tray / hidden icons area and the tray menu works.
- [ ] Confirm GHOST_FILES has a taskbar button and Windows shows a thumbnail when hovering over it.
- [ ] Click the taskbar button while the panel is collapsed; verify the panel expands.
- [ ] Confirm the global hotkey works while another application has focus.
- [ ] Test collapse/expand using the panel button, tray and global hotkey, including quickly reversing the animation.

## File operations

- [ ] Copy one file and a multi-selection to another folder.
- [ ] Copy a folder containing nested folders and files.
- [ ] Copy into a folder containing a same-name file; verify both versions remain intact.
- [ ] Cut/paste one file, several files and a folder; verify moved sources disappear only after success.
- [ ] Try moving to an occupied destination; verify the source and destination are unchanged.
- [ ] Test moving between two different volumes (for example `C:` to `D:`).
- [ ] Rename files and folders, including Unicode names and files with multiple extensions.
- [ ] Try a duplicate name and an invalid Windows name; verify a clear error and no data loss.
- [ ] Create several folders with the default name; verify unique names are generated.
- [ ] Delete a file and a folder; confirm they appear in the Recycle Bin and cancellation does nothing.
- [ ] Drag files from Explorer into the current folder and onto an app folder.
- [ ] Drag selected app items onto a folder; verify they move once and the listing refreshes.
- [ ] Try selecting a folder and one of its child files together; verify the operation is not duplicated.

## Navigation and visibility

- [ ] Browse a folder with spaces and non-Latin characters in its path.
- [ ] Check Desktop, Documents, Downloads and other available quick-access pins.
- [ ] Toggle `+HID` and verify dot-files plus Windows Hidden/System items appear and disappear.
- [ ] Test search, sorting, list/grid views, Back/Forward/Up and F5 refresh.
- [ ] Test a large folder and a folder where access is denied; the interface should remain responsive and show a useful error.

## Before publishing

- [ ] Confirm no personal files, paths, logs, tokens or local settings are included in the release archive.
- [ ] Confirm version number, repository URL, release notes and screenshots are correct.
- [ ] Test the generated installer on a machine that does not have Node.js installed.
- [ ] Keep a backup of the previous release and test data.
