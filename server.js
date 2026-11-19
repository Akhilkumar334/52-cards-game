import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.resolve(__dirname, 'ui/dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// Rooms registry for WebSocket clients: roomCode -> Set<Socket>
const rooms = new Map();

const server = http.createServer((req, res) => {
  // Simple health check endpoint for cloud platforms
  if (req.url === '/healthz' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // Parse request path
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;
  if (pathname === '/') pathname = '/index.html';

  let filePath = path.join(DIST_DIR, pathname);

  // Security check: ensure path stays inside DIST_DIR
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    // SPA fallback: if file does not exist, serve index.html
    if (err || !stats.isFile()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found. Did you run `npm run build`?');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Cache headers: assets get long-term caching; index.html is revalidated
      const headers = { 'Content-Type': contentType };
      if (filePath.endsWith('index.html')) {
        headers['Cache-Control'] = 'no-cache';
      } else {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      }

      res.writeHead(200, headers);
      res.end(content);
    });
  });
});

// WebSocket RFC 6455 Upgrade Handler for Multiplayer Relay
server.on('upgrade', (req, socket) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname !== '/cards-ws') {
    socket.destroy();
    return;
  }

  const roomCode = (url.searchParams.get('room') || 'DEFAULT').toUpperCase();
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );

  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, new Set());
  }
  const clientSockets = rooms.get(roomCode);
  clientSockets.add(socket);

  socket.on('data', (buffer) => {
    try {
      if (buffer.length < 2) return;
      const byte1 = buffer[0];
      const opcode = byte1 & 0x0f;

      if (opcode === 8) {
        // Close frame
        socket.destroy();
        return;
      }
      if (opcode === 9) {
        // Ping -> Pong
        socket.write(Buffer.from([0x8a, 0x00]));
        return;
      }
      if (opcode !== 1) return; // Text only

      const isMasked = (buffer[1] & 0x80) !== 0;
      let payloadLen = buffer[1] & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        offset += 8;
      }

      let mask = null;
      if (isMasked) {
        if (buffer.length < offset + 4) return;
        mask = buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      const payload = buffer.subarray(offset, offset + payloadLen);
      if (mask) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= mask[i % 4];
        }
      }

      // Encode unmasked server frame
      let frameHeader;
      if (payload.length < 126) {
        frameHeader = Buffer.from([0x81, payload.length]);
      } else if (payload.length <= 65535) {
        frameHeader = Buffer.alloc(4);
        frameHeader[0] = 0x81;
        frameHeader[1] = 126;
        frameHeader.writeUInt16BE(payload.length, 2);
      } else {
        frameHeader = Buffer.alloc(10);
        frameHeader[0] = 0x81;
        frameHeader[1] = 127;
        frameHeader.writeBigUInt64BE(BigInt(payload.length), 2);
      }

      const outgoing = Buffer.concat([frameHeader, payload]);
      for (const peer of clientSockets) {
        if (peer !== socket && !peer.destroyed) {
          try {
            peer.write(outgoing);
          } catch {}
        }
      }
    } catch {}
  });

  const cleanup = () => {
    clientSockets.delete(socket);
    if (clientSockets.size === 0) rooms.delete(roomCode);
  };
  socket.on('close', cleanup);
  socket.on('error', cleanup);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`♠ 52 Cards Platform Server running at http://0.0.0.0:${PORT}`);
});
