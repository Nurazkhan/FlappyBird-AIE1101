/**
 * Local Development Server for Flappy Pixel
 * Serves static assets and runs Vercel Serverless Functions in /api locally.
 */
require('./api/_env');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const authHandler = require('./api/auth');
const leaderboardHandler = require('./api/leaderboard');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8'
};

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve(body);
            }
        });
    });
}

function adaptResponse(res) {
    res.status = function(statusCode) {
        res.statusCode = statusCode;
        return res;
    };
    res.json = function(data) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(data));
        return res;
    };
    return res;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    adaptResponse(res);

    // -------------------------------------------------------------
    // Route API calls to Vercel serverless handlers
    // -------------------------------------------------------------
    if (pathname.startsWith('/api/')) {
        req.query = parsedUrl.query;
        req.body = await parseBody(req);

        if (pathname === '/api/auth' || pathname === '/api/auth/' || pathname.startsWith('/api/auth/')) {
            return authHandler(req, res);
        }
        if (pathname === '/api/leaderboard' || pathname === '/api/leaderboard/' || pathname.startsWith('/api/leaderboard/')) {
            return leaderboardHandler(req, res);
        }

        return res.status(404).json({ error: 'API route not found' });
    }

    // -------------------------------------------------------------
    // Serve Static Files
    // -------------------------------------------------------------
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }

    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(process.cwd(), safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.end('404 Not Found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`  FLAPPY PIXEL SERVER RUNNING (Vercel Backend Ready)`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`  API Auth: http://localhost:${PORT}/api/auth`);
    console.log(`  API Leaderboard: http://localhost:${PORT}/api/leaderboard`);
    console.log(`==================================================\n`);
});
