import type { RoomMessage, RoomState } from './types';

export interface TransportEnvelope {
  messageId: string;
  roomCode: string;
  senderId: string;
  timestamp: number;
  payload: RoomMessage;
}

export type MessageHandler = (envelope: TransportEnvelope) => void;

export class MultiplayerTransport {
  private readonly roomCode: string;
  private readonly localPlayerId: string;
  private broadcastChannel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private seenMessageIds: Set<string> = new Set();
  private isDestroyed = false;
  private storageKey: string;

  constructor(roomCode: string, localPlayerId: string) {
    this.roomCode = roomCode.toUpperCase().trim();
    this.localPlayerId = localPlayerId;
    this.storageKey = `52cards_room_${this.roomCode}`;

    this.initBroadcastChannel();
    this.initWebSocket();
  }

  private initBroadcastChannel() {
    try {
      const BC =
        typeof window !== 'undefined' && 'BroadcastChannel' in window
          ? window.BroadcastChannel
          : typeof BroadcastChannel !== 'undefined'
          ? BroadcastChannel
          : null;

      if (BC) {
        this.broadcastChannel = new BC(`52cards_channel_${this.roomCode}`);
        this.broadcastChannel.onmessage = (event: MessageEvent<TransportEnvelope>) => {
          this.handleIncomingEnvelope(event.data);
        };
      }
    } catch (e) {
      console.warn('[Transport] BroadcastChannel not supported or failed:', e);
    }
  }

  private initWebSocket() {
    if (typeof window === 'undefined') return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/cards-ws?room=${this.roomCode}&player=${this.localPlayerId}`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        this.ws = socket;
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          const envelope = JSON.parse(event.data) as TransportEnvelope;
          this.handleIncomingEnvelope(envelope);
        } catch {}
      };

      socket.onerror = () => {
        this.ws = null;
      };

      socket.onclose = () => {
        this.ws = null;
      };
    } catch {
      this.ws = null;
    }
  }

  private handleIncomingEnvelope(envelope: TransportEnvelope) {
    if (this.isDestroyed || !envelope || !envelope.messageId) return;

    if (envelope.roomCode !== this.roomCode) return;

    if (this.seenMessageIds.has(envelope.messageId)) return;
    this.seenMessageIds.add(envelope.messageId);

    if (this.seenMessageIds.size > 200) {
      const iter = this.seenMessageIds.values();
      for (let i = 0; i < 50; i++) {
        const val = iter.next().value;
        if (val) this.seenMessageIds.delete(val);
      }
    }

    for (const handler of this.messageHandlers) {
      try {
        handler(envelope);
      } catch (err) {
        console.error('[Transport] Message handler error:', err);
      }
    }
  }

  public subscribe(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  public send(payload: RoomMessage): void {
    if (this.isDestroyed) return;

    const messageId = `${this.localPlayerId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const envelope: TransportEnvelope = {
      messageId,
      roomCode: this.roomCode,
      senderId: this.localPlayerId,
      timestamp: Date.now(),
      payload,
    };

    this.seenMessageIds.add(messageId);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(envelope);
      } catch (e) {
        console.warn('[Transport] Failed to send over BroadcastChannel:', e);
      }
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(envelope));
      } catch (e) {
        console.warn('[Transport] Failed to send over WebSocket:', e);
      }
    }

    if (payload.type === 'ROOM_SYNC' || payload.type === 'START_GAME') {
      try {
        const storage =
          typeof window !== 'undefined' && window.localStorage
            ? window.localStorage
            : (globalThis as unknown as { localStorage: Storage }).localStorage;
        if (storage) {
          storage.setItem(this.storageKey, JSON.stringify(payload.room));
        }
      } catch {}
    }
  }

  public loadCachedRoom(): RoomState | null {
    try {
      const storage =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage
          : (globalThis as unknown as { localStorage: Storage }).localStorage;
      if (!storage) return null;
      const raw = storage.getItem(this.storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as RoomState;
    } catch {
      return null;
    }
  }

  public clearCachedRoom(): void {
    try {
      const storage =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage
          : (globalThis as unknown as { localStorage: Storage }).localStorage;
      if (storage) storage.removeItem(this.storageKey);
    } catch {}
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.messageHandlers.clear();

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}
