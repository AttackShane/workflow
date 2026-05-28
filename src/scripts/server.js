const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const rootDir = path.join(__dirname, '..');

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

function serveFile(res, filePath, statusCode = 200) {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.warn(`[404] Not Found: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                console.error(`[500] File read error: ${filePath}`, err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
            }
        } else {
            res.writeHead(statusCode, { 
                'Content-Type': getMimeType(filePath),
                'Cache-Control': 'no-cache'
            });
            res.end(content, 'utf-8');
        }
    });
}

function logRequest(req) {
    const timestamp = new Date().toLocaleString('zh-CN');
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
}

const routeMap = {
    '/': '/views/workflow-manager.html',
    '/index.html': '/views/workflow-manager.html',
    '/converter': '/views/converter.html',
    '/converter.html': '/views/converter.html',
    '/editor': '/views/workflow-editor.html',
    '/editor.html': '/views/workflow-editor.html'
};

const server = http.createServer((req, res) => {
    logRequest(req);
    
    let filePath = req.url;
    
    if (routeMap[filePath]) {
        filePath = routeMap[filePath];
    }
    
    const fullPath = path.join(rootDir, filePath);
    
    if (!fullPath.startsWith(rootDir)) {
        console.warn(`[403] Forbidden: ${req.url}`);
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }
    
    serveFile(res, fullPath);
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});

server.listen(PORT, () => {
    console.log('');
    console.log('🚀 工作流工具开发服务器');
    console.log('─────────────────────────────');
    console.log(`运行地址: http://localhost:${PORT}`);
    console.log('');
    console.log('路由映射:');
    console.log('  /           → 工作流管理页面');
    console.log('  /converter  → 工作流转换器');
    console.log('  /editor     → 工作流编辑器');
    console.log('');
    console.log('按 Ctrl+C 停止服务器');
    console.log('─────────────────────────────');
});