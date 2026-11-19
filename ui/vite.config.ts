import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import crypto from 'crypto';
import type { Socket } from 'net';

function cardsWebSocketPlugin(): Plugin {
  return {
    name: 'cards-websocket-relay',
    configureServer(server) {
      if (!server.httpServer) return;

      const rooms = new Map<string, Set<Socket>>();

      server.httpServer.on('upgrade', (req, socket, _head) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname !== '/cards-ws') return;

        const roomCode = (url.searchParams.get('room') ?? 'DEFAULT').toUpperCase();
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
        const clientSockets = rooms.get(roomCode)!;
        clientSockets.add(socket);

        socket.on('data', (buffer) => {
          try {
            if (buffer.length < 2) return;
            const byte1 = buffer[0]!;
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

            const isMasked = (buffer[1]! & 0x80) !== 0;
            let payloadLen = buffer[1]! & 0x7f;
            let offset = 2;

            if (payloadLen === 126) {
              if (buffer.length < 4) return;
              payloadLen = buffer.readUInt16BE(offset);
              offset += 2;
            } else if (payloadLen === 127) {
              if (buffer.length < 10) return;
              offset += 8;
            }

            let mask: Buffer | null = null;
            if (isMasked) {
              if (buffer.length < offset + 4) return;
              mask = buffer.subarray(offset, offset + 4);
              offset += 4;
            }

            const payload = buffer.subarray(offset, offset + payloadLen);
            if (mask) {
              for (let i = 0; i < payload.length; i++) {
                payload[i] ^= mask[i % 4]!;
              }
            }

            // Encode unmasked server frame
            let frameHeader: Buffer;
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
    },
  };
}

export default defineConfig({
  plugins: [react(), cardsWebSocketPlugin()],
  resolve: {
    alias: {
      '@cards/engine': path.resolve(__dirname, '../engine/src/index.ts'),
      '@cards/bots': path.resolve(__dirname, '../bots/src/index.ts'),
    },
  },
});
