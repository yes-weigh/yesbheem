const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm',
    '.pdf': 'application/pdf'
};

const server = http.createServer((req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // Handle basic path normalization
    let requestUrl = req.url.split('?')[0]; // Ignore query strings
    try {
        requestUrl = decodeURIComponent(requestUrl);
    } catch (e) {
        console.error('URI Decode Error:', e);
    }

    // Prevent directory traversal
    const safePath = path.normalize(requestUrl).replace(/^(\.\.[\/\\])+/, '');

    let filePath = path.join(__dirname, safePath);

    // If root is requested, serve index.html
    if (requestUrl === '/') {
        filePath = path.join(__dirname, 'index.html');
    }

    // Attempt to read the file
    fs.stat(filePath, (err, stats) => {
        if (err || (stats.isDirectory() && requestUrl !== '/')) {
            // File not found or is a directory (and not root)
            // Strategy: Check if it's a static asset (has extension)
            // If it has an extension, it's likely a missing file -> 404
            // If it has NO extension, it's likely a route -> Serve index.html (SPA Fallback)

            const ext = path.extname(filePath);

            if (!ext) {
                // SPA Fallback: Serve index.html
                serveFile(res, path.join(__dirname, 'index.html'));
            } else {
                // Static asset not found
                res.writeHead(404);
                res.end(`File not found: ${requestUrl}`);
            }
        } else {
            // File exists
            serveFile(res, filePath);
        }
    });
});

function serveFile(res, filePath) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end(`Server Error: ${err.code}`);
        } else {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

server.listen(PORT, () => {
    console.log(`Server running at http://127.0.0.1:${PORT}/`);
    console.log('SPA Routing enabled: Unknown routes will serve index.html');
});
