// DealerCraft desktop shell. Copyright (c) Buggy Games YT. All Rights Reserved.
// Serves the bundled web game from a fixed local port so saves (localStorage) persist between launches.
const { app, BrowserWindow, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'app');
const PORTS = [47816, 47817, 47818];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

function startServer(i = 0) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.normalize(path.join(ROOT, p));
      if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.once('error', (e) => (i + 1 < PORTS.length ? startServer(i + 1).then(resolve, reject) : reject(e)));
    srv.listen(PORTS[i], '127.0.0.1', () => resolve(PORTS[i]));
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const port = await startServer();
  const win = new BrowserWindow({
    width: 1280, height: 760, minWidth: 800, minHeight: 500,
    title: 'DealerCraft', backgroundColor: '#1a0f08', autoHideMenuBar: true,
    icon: path.join(ROOT, 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.loadURL(`http://localhost:${port}/index.html`);
});
app.on('window-all-closed', () => app.quit());
