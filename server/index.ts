// Bug Fights - Bun WebSocket Server
// Runs simulation 24/7 and broadcasts to all clients

import { resolve } from 'path';
import { Simulation, TICK_RATE, TICK_MS } from './simulation';
import type { ServerWebSocket } from 'bun';
import prisma from './db';

const STATIC_DIR = resolve(import.meta.dir + '/../dist/client');

// Read version from package.json
const pkg = await Bun.file(import.meta.dir + '/../package.json').json() as { version: string };
const version: string = pkg.version;

// ============================================
// GAME SIMULATION
// ============================================

const simulation = await Simulation.create();

// Track connected clients
const clients = new Set<ServerWebSocket<unknown>>();

function broadcast(data: WSServerMessage): void {
    const message = JSON.stringify(data);
    for (const client of clients) {
        client.send(message);
    }
}

// Game loop
let tickCount = 0;
const startTime = Date.now();

setInterval(() => {
    simulation.update();
    tickCount++;

    const stateMsg: WSStateMessage = {
        type: 'state',
        state: simulation.getState(),
    };
    broadcast(stateMsg);

    // Log stats periodically
    if (tickCount % (TICK_RATE * 10) === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const actualRate = tickCount / elapsed;
        console.log(
            `Tick ${simulation.tick} | Fight #${simulation.fightNumber} | ` +
            `Phase: ${simulation.phase} | Clients: ${clients.size} | Rate: ${actualRate.toFixed(1)}/s`
        );
    }
}, TICK_MS);

// ============================================
// BUN HTTP + WEBSOCKET SERVER
// ============================================

const PORT = Number(process.env['PORT'] ?? 8080);

const server = Bun.serve({
    port: PORT,

    async fetch(req, server) {
        const url = new URL(req.url);

        // WebSocket upgrade on /ws path
        if (url.pathname === '/ws' && req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
            if (server.upgrade(req)) return undefined;
            return new Response('WebSocket upgrade failed', { status: 400 });
        }

        // API: roster
        if (url.pathname === '/api/roster') {
            return Response.json(simulation.getRoster(), {
                headers: { 'Access-Control-Allow-Origin': '*' },
            });
        }

        // API: recent fight history
        if (url.pathname === '/api/fights') {
            const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
            const fights = await prisma.fight.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit,
                include: {
                    bug1: { select: { id: true, name: true } },
                    bug2: { select: { id: true, name: true } },
                    winner: { select: { id: true, name: true } },
                },
            });
            return Response.json(fights, {
                headers: { 'Access-Control-Allow-Origin': '*' },
            });
        }

        // API: bug details with fight history
        const bugMatch = url.pathname.match(/^\/api\/bug\/(.+)$/);
        if (bugMatch) {
            const bugId = bugMatch[1]!;
            const bug = await prisma.bug.findUnique({
                where: { id: bugId },
                include: {
                    parent1: { select: { id: true, name: true } },
                    parent2: { select: { id: true, name: true } },
                    childrenAsParent1: { select: { id: true, name: true, generation: true } },
                    childrenAsParent2: { select: { id: true, name: true, generation: true } },
                    fightsAsBug1: {
                        orderBy: { createdAt: 'desc' },
                        take: 20,
                        include: {
                            bug2: { select: { id: true, name: true } },
                            winner: { select: { id: true, name: true } },
                        },
                    },
                    fightsAsBug2: {
                        orderBy: { createdAt: 'desc' },
                        take: 20,
                        include: {
                            bug1: { select: { id: true, name: true } },
                            winner: { select: { id: true, name: true } },
                        },
                    },
                },
            });
            if (!bug) {
                return Response.json({ error: 'Bug not found' }, { status: 404 });
            }
            return Response.json({
                ...bug,
                genome: JSON.parse(bug.genome),
            }, {
                headers: { 'Access-Control-Allow-Origin': '*' },
            });
        }

        // Static file serving
        let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
        filePath = decodeURIComponent(filePath.split('?')[0]!);

        const resolved = resolve(STATIC_DIR, '.' + filePath);
        if (!resolved.startsWith(STATIC_DIR)) {
            return new Response('403 Forbidden', { status: 403 });
        }

        const file = Bun.file(resolved);
        if (await file.exists()) {
            return new Response(file);
        }

        return new Response('404 Not Found', { status: 404 });
    },

    websocket: {
        open(ws) {
            clients.add(ws);
            console.log(`Client connected. Total: ${clients.size}`);

            const initMsg: WSInitMessage = {
                type: 'init',
                state: simulation.getState(),
            };
            ws.send(JSON.stringify(initMsg));
        },

        message(ws, message) {
            try {
                const data = JSON.parse(String(message)) as { type: string };
                console.log('Received:', data.type);
            } catch (e) {
                console.error('Invalid message:', e);
            }
        },

        close(ws) {
            clients.delete(ws);
            console.log(`Client disconnected. Total: ${clients.size}`);
        },
    },
});

// ============================================
// STARTUP BANNER
// ============================================

const versionPadded = version.padEnd(14);
console.log(`
╔════════════════════════════════════════════╗
║         BUG FIGHTS SERVER ${versionPadded}║
╠════════════════════════════════════════════╣
║  HTTP + WS:    http://localhost:${server.port}       ║
║  Tick Rate:    ${TICK_RATE} ticks/second            ║
║  Runtime:      Bun ${Bun.version}                 ║
╚════════════════════════════════════════════╝
`);
console.log('Simulation started. Fights running 24/7...\n');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.stop();
    process.exit(0);
});
