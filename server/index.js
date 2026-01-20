// Bug Fights - WebSocket Server
// Runs simulation 24/7 and broadcasts to all clients

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const { Simulation, TICK_RATE, TICK_MS } = require('./simulation');

// ============================================
// HTTP SERVER (Static Files)
// ============================================

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function serveStatic(req, res) {
    let filePath = req.url === '/' ? '/index.html' : req.url;

    // Remove query string
    filePath = filePath.split('?')[0];

    // API endpoints
    if (filePath === '/api/roster') {
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(simulation.getRoster()));
        return;
    }

    // Security: prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');

    const fullPath = path.join(PUBLIC_DIR, filePath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(fullPath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
            }
            return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

const server = http.createServer(serveStatic);

// ============================================
// WEBSOCKET SERVER
// ============================================

const wss = new WebSocket.Server({ server });

// Track connected clients
let clients = new Set();

wss.on('connection', (ws) => {
    console.log(`Client connected. Total: ${clients.size + 1}`);
    clients.add(ws);

    // Send initial state immediately
    const state = simulation.getState();
    ws.send(JSON.stringify({
        type: 'init',
        state: state,
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // Handle client messages (e.g., bet placement)
            // For now, betting is client-side only
            console.log('Received:', data.type);
        } catch (e) {
            console.error('Invalid message:', e);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        clients.delete(ws);
    });
});

function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// ============================================
// GAME SIMULATION
// ============================================

const simulation = new Simulation();

let lastTickTime = Date.now();
let tickCount = 0;

function gameLoop() {
    const now = Date.now();

    // Run simulation tick
    simulation.update();
    tickCount++;

    // Broadcast state to all clients
    broadcast({
        type: 'state',
        state: simulation.getState(),
    });

    // Log stats periodically
    if (tickCount % (TICK_RATE * 10) === 0) { // Every 10 seconds
        const elapsed = (now - lastTickTime) / 1000;
        const actualRate = tickCount / elapsed;
        console.log(`Tick ${simulation.tick} | Fight #${simulation.fightNumber} | Phase: ${simulation.phase} | Clients: ${clients.size} | Rate: ${actualRate.toFixed(1)}/s`);
    }
}

// Run game loop at fixed interval
setInterval(gameLoop, TICK_MS);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║         BUG FIGHTS SERVER v1.0             ║
╠════════════════════════════════════════════╣
║  HTTP Server:  http://localhost:${PORT}       ║
║  WebSocket:    ws://localhost:${PORT}         ║
║  Tick Rate:    ${TICK_RATE} ticks/second            ║
╚════════════════════════════════════════════╝
    `);
    console.log('Simulation started. Fights running 24/7...\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    wss.close();
    server.close();
    process.exit(0);
});
