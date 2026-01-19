---
description: Start local development server
---

# Starting Development After Reboot

Follow these steps to start working on the Kerala map project after a reboot:

## Prerequisites Check
- Ensure you're in the project directory: `d:\kerala`
- Verify Python is installed: `python --version`

## Start Development Server

### Option 1: Custom Node Server (Best for App)
This server handles SPA routing (reloading pages won't give 404) and correct MIME types.
```bash
cd d:\kerala
node server.js
```

### Option 2: Python HTTP Server (Backup)
```bash
cd d:\kerala
python -m http.server 8000
```

### Option 2: Node.js http-server
```bash
cd d:\kerala
npx http-server -p 8000
```

### Option 3: VS Code Live Server
1. Open `index.html` in VS Code
2. Right-click and select "Open with Live Server"

## Access Your App
Open your browser and navigate to:
- **http://localhost:8000**

## Important Notes
- ❌ **Don't use**: `file:///D:/kerala/index.html` (caching issues, CORS problems)
- ✅ **Always use**: `http://localhost:8000` (accurate rendering, no caching)
- 🔄 **Hard refresh**: Press `Ctrl+Shift+R` or `Ctrl+F5` if you need to clear browser cache
- 🛑 **Stop server**: Press `Ctrl+C` in the terminal running the server

## Viewing GitHub Pages Version
Your live version is hosted at: (check your GitHub repository settings for the URL)

## Making Changes
1. Edit your files (HTML, CSS, JS)
2. Save the changes
3. Refresh the browser (`F5` or `Ctrl+R`)
4. For stubborn cache: `Ctrl+Shift+R` (hard refresh)
