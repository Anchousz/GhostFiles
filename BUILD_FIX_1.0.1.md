# Build configuration fix (1.0.1)

Fixed the Windows `electron-builder` configuration for electron-builder 26.15.x.

The unsupported `build.win.sign` property was replaced with `build.win.signExecutable: false`.
This disables code signing while keeping executable resource editing enabled, so the app icon and Windows metadata can still be applied.

Run on Windows:

```powershell
npm install
npm run build
```

Build artifacts are written to `dist/`.
