# Run on your laptop without opening PowerShell each time

## Easiest: double-click launcher (recommended)

1. In the project folder, double-click **`Start Job Search Copilot.bat`**
2. Wait for the browser to open at `http://localhost:3000`
3. When finished, close the black window (that stops the server)

**No terminal window:** use **`Start Job Search Copilot (no terminal).vbs`** instead (minimized PowerShell).

### Desktop shortcut

1. Right-click `Start Job Search Copilot.bat` → **Show more options** → **Create shortcut**
2. Drag the shortcut to your Desktop
3. Optional: right-click shortcut → **Properties** → change icon

## Faster startup (production mode, optional)

Run once in PowerShell:

```powershell
cd C:\Users\gjwan\.cursor\projects\empty-window\job-search-copilot
npm run build
```

After that, the launcher uses `npm start` (faster) instead of `npm run dev`.

## Real `.exe` (optional, more work)

Your app is a **Next.js server** (Node.js + browser). A standalone `.exe` usually means **Electron** or **Tauri** wrapping:

- Node + your built app, or
- A small exe that starts the server and opens a built-in browser window

That is doable but heavier to package and update. The `.bat` / `.vbs` launchers are enough for most personal laptop use.

## Requirements on the laptop

- Node.js installed (`node -v` works)
- `.env.local` with Supabase and OpenAI keys
- Internet for Supabase, OpenAI, and LinkedIn
