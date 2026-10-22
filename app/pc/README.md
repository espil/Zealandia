# PC program (desktop shell)

The PC version wraps the **same payload** as the phone app (`app/www`) in an
Electron window. There is one codebase: whatever ships in `www` is what the
PC program runs.

Why a local server: the game loads JSON, models and audio by relative URL,
which `file://` cannot serve. `server.js` serves `www` over
`http://127.0.0.1` inside the app and marks the session as the app
(`window.__ESPIL_APP__`), the same flag the phone shell sets.

## Run (development)

```
cd app/pc
npm install
npm start
```

## Build a Windows program

On a Windows PC (Node 22+):

```
cd app/pc
npm install
npm run dist
```

Produces one portable `.exe` in `app/pc/dist/` - no installer, no admin
rights; double-click to play. The `.exe` is unsigned for now, so Windows
SmartScreen shows a "Windows protected your PC" prompt on first run
(More info -> Run anyway). Code signing is a separate decision.

Notes:
- The portable exe bundles the whole payload, so expect roughly
  payload size (217 MB) + ~90 MB of Electron runtime.
- macOS/Linux builds are the same wrapper (`electron-builder --mac` /
  `--linux`); the Mac build needs a Mac or a cloud runner, like iOS.
