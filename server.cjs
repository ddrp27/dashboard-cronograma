const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

let lastCheckTime = 0;
function checkAndAutoUpdateCronograma() {
  const now = Date.now();
  if (now - lastCheckTime < 1500) return;
  lastCheckTime = now;
  try {
    const datosPath = path.join(__dirname, 'datos_cronograma.js');
    const datosMtime = fs.existsSync(datosPath) ? fs.statSync(datosPath).mtimeMs : 0;

    const files = fs.readdirSync(__dirname)
      .filter(f => (f.endsWith('.xlsx') || f.endsWith('.csv')) && !f.startsWith('~$'))
      .map(f => ({ file: f, mtime: fs.statSync(path.join(__dirname, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0 && files[0].mtime > datosMtime + 1000) {
      console.log(`🔄 [Auto-Update] Detectado archivo Excel más reciente: "${files[0].file}". Actualizando cronograma...`);
      execSync(`node "${path.join(__dirname, 'actualizar_cronograma.cjs')}" "${path.join(__dirname, files[0].file)}"`, { stdio: 'inherit' });
    }
  } catch (err) {
    console.warn('[Auto-Update Warning]:', err.message);
  }
}

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/' || reqUrl === '') reqUrl = '/index.html';

  if (reqUrl === '/index.html' || reqUrl === '/datos_cronograma.js') {
    checkAndAutoUpdateCronograma();
  }

  const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor local listo en http://localhost:${PORT}`);
});
