import { describe, it, expect, beforeEach } from 'vitest';
import { MultiplayerTransport } from '../multiplayerTransport';
import { useRoomStore } from '../useRoomStore';
import type { RoomMessage } from '../types';

describe('Multiplayer Networking & Room System', () => {
  beforeEach(() => {
    useRoomStore.getState().leaveRoom();
  });

  it('connects two transport instances in the same room via BroadcastChannel', async () => {
    const roomCode = 'TEST-101';
    const player1 = new MultiplayerTransport(roomCode, 'p1');
    const player2 = new MultiplayerTransport(roomCode, 'p2');

    const receivedMessages: RoomMessage[] = [];
    player2.subscribe((envelope) => {
      receivedMessages.push(envelope.payload);
    });

    const testMsg: RoomMessage = {
      type: 'CHAT_MESSAGE',
      message: {
        id: 'msg-1',
        senderId: 'p1',
        senderName: 'Player 1',
        senderAvatar: '🤠',
        text: 'Hello from Player 1!',
        timestamp: Date.now(),
      },
      senderId: 'p1',
    };

    player1.send(testMsg);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0]!.type).toBe('CHAT_MESSAGE');
    if (receivedMessages[0]!.type === 'CHAT_MESSAGE') {
      expect(receivedMessages[0]!.message.text).toBe('Hello from Player 1!');
    }

    player1.destroy();
    player2.destroy();
  });

  it('isolates messages between different room codes', async () => {
    const playerA = new MultiplayerTransport('ROOM-A', 'pA');
    const playerB = new MultiplayerTransport('ROOM-B', 'pB');

    const receivedB: RoomMessage[] = [];
    playerB.subscribe((envelope) => {
      receivedB.push(envelope.payload);
    });

    playerA.send({
      type: 'PING',
      senderId: 'pA',
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedB.length).toBe(0);

    playerA.destroy();
    playerB.destroy();
  });

  it('creates a room in Zustand store with empty waiting seats by default', () => {
    const store = useRoomStore.getState();
    // autoFillBots defaults to false
    store.createRoom('bluff', 'Akhil', '🤠', 'BLUFF-TEST', 4);

    const updated = useRoomStore.getState();
    expect(updated.room).not.toBeNull();
    expect(updated.room?.code).toBe('BLUFF-TEST');
    expect(updated.room?.game).toBe('bluff');
    expect(updated.room?.status).toBe('lobby');
    expect(updated.localPlayer?.name).toBe('Akhil');
    expect(updated.localPlayer?.isHost).toBe(true);
    expect(updated.localPlayer?.seatIndex).toBe(0);

    // Seat 0 is Host (Akhil), seats 1, 2, 3 start as empty waiting for players!
    expect(updated.room?.seats.length).toBe(4);
    expect(updated.room?.seats[0]!.player?.name).toBe('Akhil');
    expect(updated.room?.seats[1]!.player).toBeNull();
    expect(updated.room?.seats[2]!.player).toBeNull();
    expect(updated.room?.seats[3]!.player).toBeNull();
  });

  it('allows host to manually toggle bot seats in the lobby', () => {
    const store = useRoomStore.getState();
    store.createRoom('bluff', 'HostPlayer', '🤠', 'BLUFF-TOGGLE', 4);

    // Initially seat 1 is empty
    expect(useRoomStore.getState().room?.seats[1]!.player).toBeNull();

    // Toggle seat 1 on (add bot)
    useRoomStore.getState().toggleBotSeat(1);
    expect(useRoomStore.getState().room?.seats[1]!.isBot).toBe(true);
    expect(useRoomStore.getState().room?.seats[1]!.player).not.toBeNull();

    // Toggle seat 1 off (remove bot)
    useRoomStore.getState().toggleBotSeat(1);
    expect(useRoomStore.getState().room?.seats[1]!.isBot).toBe(false);
    expect(useRoomStore.getState().room?.seats[1]!.player).toBeNull();
  });

  it('starts game with only current players when fillEmptyWithBots is false', () => {
    const store = useRoomStore.getState();
    store.createRoom('bluff', 'Player1', '🤠', 'BLUFF-2P', 4);

    // Add 1 bot to simulate a 2-player lobby
    useRoomStore.getState().toggleBotSeat(1);

    // Start with ONLY current 2 players (seats 2 and 3 remain empty and are dropped)
    store.startGame(false);

    const state = useRoomStore.getState();
    expect(state.room?.status).toBe('playing');
    expect(state.room?.seats.length).toBe(2);
    expect(state.room?.maxPlayers).toBe(2);
  });

  it('enforces 4-player compulsion for Seep game even when empty seats remain', () => {
    const store = useRoomStore.getState();
    store.createRoom('seep', 'HostSeep', '🤠', 'SEEP-START', 4);

    // Even if fillEmptyWithBots is passed false, Seep compels 4 players
    store.startGame(false);

    const state = useRoomStore.getState();
    expect(state.room?.status).toBe('playing');
    expect(state.room?.seats.length).toBe(4);
    expect(state.room?.seats.every((s) => s.player !== null)).toBe(true);
  });
});
