import { create } from 'zustand';
import type { BluffMove, BluffRuleset } from '@cards/engine';
import { MultiplayerTransport, type TransportEnvelope } from './multiplayerTransport';
import type { ChatMessage, GameType, RoomPlayer, RoomSeat, RoomState } from './types';

interface RoomStoreState {
  room: RoomState | null;
  localPlayer: RoomPlayer | null;
  chatMessages: ChatMessage[];
  transport: MultiplayerTransport | null;
  lastRemoteMove: { move: BluffMove; turnNumber: number; senderId: string } | null;
  newGameSeed: number | null;
  isConnected: boolean;

  // Actions
  createRoom: (
    game: GameType,
    playerName: string,
    avatar: string,
    customCode?: string,
    maxSeats?: number,
    autoFillBots?: boolean,
  ) => void;
  joinRoom: (
    code: string,
    playerName: string,
    avatar: string,
  ) => void;
  claimSeat: (seatIndex: number) => void;
  toggleBotSeat: (seatIndex: number) => void;
  startGame: (fillEmptyWithBots?: boolean, ruleset?: BluffRuleset) => void;
  broadcastMove: (move: BluffMove, turnNumber: number) => void;
  sendChatMessage: (text: string) => void;
  restartGame: () => void;
  leaveRoom: () => void;
}

const DEFAULT_AVATARS = ['🤠', '🎩', '🦊', '🦁', '🐯', '🐼', '🦹', '🧙'];

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  room: null,
  localPlayer: null,
  chatMessages: [],
  transport: null,
  lastRemoteMove: null,
  newGameSeed: null,
  isConnected: false,

  createRoom: (
    game: GameType,
    playerName: string,
    avatar: string,
    customCode?: string,
    maxSeats = 4,
    autoFillBots = false,
  ) => {
    const existingTransport = get().transport;
    if (existingTransport) existingTransport.destroy();

    const code = customCode
      ? customCode.toUpperCase().trim()
      : `${game.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const playerId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const localPlayer: RoomPlayer = {
      id: playerId,
      name: playerName.trim() || 'Player 1',
      avatar: avatar || DEFAULT_AVATARS[0]!,
      isBot: false,
      isHost: true,
      seatIndex: 0,
      ready: true,
    };

    const botNames = ['Karan (Bot)', 'Priya (Bot)', 'Rohan (Bot)'];
    const seats: RoomSeat[] = Array.from({ length: maxSeats }, (_, i) => {
      if (i === 0) {
        return { seatIndex: 0, player: localPlayer, isBot: false };
      }
      return {
        seatIndex: i,
        player: autoFillBots
          ? {
              id: `bot-${i}`,
              name: botNames[i - 1] ?? `Bot ${i}`,
              avatar: '🤖',
              isBot: true,
              isHost: false,
              seatIndex: i,
              ready: true,
            }
          : null,
        isBot: autoFillBots,
      };
    });

    const room: RoomState = {
      code,
      game,
      hostId: playerId,
      maxPlayers: maxSeats,
      seats,
      status: 'lobby',
      seed: Math.floor(Math.random() * 1_000_000),
      createdAt: Date.now(),
      lastActive: Date.now(),
    };

    const transport = new MultiplayerTransport(code, playerId);

    // Initial system chat message
    const welcomeMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      senderId: 'system',
      senderName: 'Dealer',
      senderAvatar: '♠️',
      text: `Room ${code} created. Share the room code or invite link with friends!`,
      timestamp: Date.now(),
      isSystem: true,
    };

    transport.subscribe((envelope: TransportEnvelope) => {
      handleIncomingMessage(envelope, get, set);
    });

    // Save and announce room state
    transport.send({
      type: 'ROOM_SYNC',
      room,
      senderId: playerId,
    });

    set({
      room,
      localPlayer,
      chatMessages: [welcomeMsg],
      transport,
      isConnected: true,
      lastRemoteMove: null,
      newGameSeed: null,
    });
  },

  joinRoom: (code: string, playerName: string, avatar: string) => {
    const existingTransport = get().transport;
    if (existingTransport) existingTransport.destroy();

    const normalizedCode = code.toUpperCase().trim();
    const playerId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const transport = new MultiplayerTransport(normalizedCode, playerId);

    // Check cached room first
    const cached = transport.loadCachedRoom();
    const gameType: GameType = cached?.game ?? (normalizedCode.startsWith('THULLA') ? 'thulla' : normalizedCode.startsWith('SEEP') ? 'seep' : 'bluff');

    let initialRoom: RoomState;
    if (cached) {
      initialRoom = cached;
    } else {
      const maxSeats = 4;
      initialRoom = {
        code: normalizedCode,
        game: gameType,
        hostId: '',
        maxPlayers: maxSeats,
        seats: Array.from({ length: maxSeats }, (_, i) => ({
          seatIndex: i,
          player: null,
          isBot: false,
        })),
        status: 'lobby',
        seed: Math.floor(Math.random() * 1_000_000),
        createdAt: Date.now(),
        lastActive: Date.now(),
      };
    }

    // Find first available seat
    let assignedSeat = -1;
    for (let i = 0; i < initialRoom.seats.length; i++) {
      const s = initialRoom.seats[i]!;
      if (!s.player || s.isBot) {
        assignedSeat = i;
        break;
      }
    }
    if (assignedSeat === -1) assignedSeat = 1;

    const localPlayer: RoomPlayer = {
      id: playerId,
      name: playerName.trim() || `Player ${assignedSeat + 1}`,
      avatar: avatar || DEFAULT_AVATARS[assignedSeat % DEFAULT_AVATARS.length]!,
      isBot: false,
      isHost: !initialRoom.hostId,
      seatIndex: assignedSeat,
      ready: true,
    };

    const updatedSeats = [...initialRoom.seats];
    updatedSeats[assignedSeat] = {
      seatIndex: assignedSeat,
      player: localPlayer,
      isBot: false,
    };

    const updatedRoom: RoomState = {
      ...initialRoom,
      hostId: initialRoom.hostId || playerId,
      seats: updatedSeats,
    };

    transport.subscribe((envelope: TransportEnvelope) => {
      handleIncomingMessage(envelope, get, set);
    });

    transport.send({
      type: 'PLAYER_JOIN',
      player: localPlayer,
      senderId: playerId,
    });

    const joinMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      senderId: 'system',
      senderName: 'Dealer',
      senderAvatar: '♠️',
      text: `${localPlayer.name} joined the room!`,
      timestamp: Date.now(),
      isSystem: true,
    };

    set({
      room: updatedRoom,
      localPlayer,
      chatMessages: [joinMsg],
      transport,
      isConnected: true,
      lastRemoteMove: null,
      newGameSeed: null,
    });
  },

  claimSeat: (seatIndex: number) => {
    const { room, localPlayer, transport } = get();
    if (!room || !localPlayer || !transport) return;
    if (seatIndex < 0 || seatIndex >= room.seats.length) return;

    const currentOccupant = room.seats[seatIndex]?.player;
    if (currentOccupant && !currentOccupant.isBot && currentOccupant.id !== localPlayer.id) {
      return;
    }

    const updatedLocalPlayer: RoomPlayer = {
      ...localPlayer,
      seatIndex,
    };

    const newSeats = room.seats.map((seat) => {
      if (seat.player?.id === localPlayer.id) {
        return { ...seat, player: null, isBot: false };
      }
      if (seat.seatIndex === seatIndex) {
        return { ...seat, player: updatedLocalPlayer, isBot: false };
      }
      return seat;
    });

    const updatedRoom: RoomState = {
      ...room,
      seats: newSeats,
      lastActive: Date.now(),
    };

    transport.send({
      type: 'CLAIM_SEAT',
      playerId: localPlayer.id,
      seatIndex,
      senderId: localPlayer.id,
    });

    transport.send({
      type: 'ROOM_SYNC',
      room: updatedRoom,
      senderId: localPlayer.id,
    });

    set({ room: updatedRoom, localPlayer: updatedLocalPlayer });
  },

  toggleBotSeat: (seatIndex: number) => {
    const { room, localPlayer, transport } = get();
    if (!room || !localPlayer || !transport || !localPlayer.isHost) return;

    const seat = room.seats[seatIndex];
    if (!seat) return;
    if (seat.player?.id === localPlayer.id) return;

    const botNames = ['Karan (Bot)', 'Priya (Bot)', 'Rohan (Bot)', 'Anita (Bot)'];
    const nowBot = !seat.isBot;

    const newSeats = [...room.seats];
    newSeats[seatIndex] = {
      seatIndex,
      isBot: nowBot,
      player: nowBot
        ? {
            id: `bot-${seatIndex}`,
            name: botNames[seatIndex - 1] ?? `Bot ${seatIndex}`,
            avatar: '🤖',
            isBot: true,
            isHost: false,
            seatIndex,
            ready: true,
          }
        : null,
    };

    const updatedRoom: RoomState = {
      ...room,
      seats: newSeats,
      lastActive: Date.now(),
    };

    transport.send({
      type: 'TOGGLE_BOT_SEAT',
      seatIndex,
      isBot: nowBot,
      botName: newSeats[seatIndex]?.player?.name,
      senderId: localPlayer.id,
    });

    transport.send({
      type: 'ROOM_SYNC',
      room: updatedRoom,
      senderId: localPlayer.id,
    });

    set({ room: updatedRoom });
  },

  startGame: (fillEmptyWithBots = false, ruleset?: BluffRuleset) => {
    const { room, localPlayer, transport } = get();
    if (!room || !localPlayer || !transport || !localPlayer.isHost) return;

    const botNames = ['Karan (Bot)', 'Priya (Bot)', 'Rohan (Bot)', 'Anita (Bot)'];

    let finalSeats: RoomSeat[];
    // In Seep: 4 players is compulsory.
    // In Bluff & Thulla: fill with bots only if requested or if only 1 player.
    const isSeep = room.game === 'seep';
    const currentOccupants = room.seats.filter((s) => s.player !== null);
    const shouldAddBots = fillEmptyWithBots || (isSeep && currentOccupants.length < 4);

    if (shouldAddBots) {
      let botCounter = 1;
      finalSeats = room.seats.map((seat, idx) => {
        if (!seat.player) {
          const botName = botNames[botCounter - 1] ?? `Bot ${idx + 1}`;
          botCounter++;
          return {
            seatIndex: idx,
            isBot: true,
            player: {
              id: `bot-${idx}`,
              name: botName,
              avatar: '🤖',
              isBot: true,
              isHost: false,
              seatIndex: idx,
              ready: true,
            },
          };
        }
        return seat;
      });
    } else {
      // Start with ONLY the players currently in the room
      finalSeats = currentOccupants.map((s, newIdx) => ({
        seatIndex: newIdx,
        isBot: s.isBot,
        player: {
          ...s.player!,
          seatIndex: newIdx,
        },
      }));
    }

    const seed = Math.floor(Math.random() * 1_000_000);
    const updatedRoom: RoomState = {
      ...room,
      seats: finalSeats,
      maxPlayers: finalSeats.length,
      status: 'playing',
      seed,
      ruleset,
      lastActive: Date.now(),
    };

    transport.send({
      type: 'START_GAME',
      room: updatedRoom,
      seed,
      senderId: localPlayer.id,
    });

    const startMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      senderId: 'system',
      senderName: 'Dealer',
      senderAvatar: '♠️',
      text: `Game started with ${finalSeats.length} players! Cards dealt.`,
      timestamp: Date.now(),
      isSystem: true,
    };

    // Update local player seat index in case it was compacted
    const myCompactedPlayer = finalSeats.find((s) => s.player?.id === localPlayer.id)?.player ?? localPlayer;

    set({
      room: updatedRoom,
      localPlayer: myCompactedPlayer,
      chatMessages: [...get().chatMessages, startMsg],
      newGameSeed: seed,
    });
  },

  broadcastMove: (move: BluffMove, turnNumber: number) => {
    const { room, localPlayer, transport } = get();
    if (!room || !localPlayer || !transport) return;

    transport.send({
      type: 'APPLY_MOVE',
      move,
      turnNumber,
      senderId: localPlayer.id,
      roomCode: room.code,
    });
  },

  sendChatMessage: (text: string) => {
    const { localPlayer, transport } = get();
    if (!localPlayer || !transport || !text.trim()) return;

    const chatMsg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: localPlayer.id,
      senderName: localPlayer.name,
      senderAvatar: localPlayer.avatar,
      text: text.trim(),
      timestamp: Date.now(),
    };

    transport.send({
      type: 'CHAT_MESSAGE',
      message: chatMsg,
      senderId: localPlayer.id,
    });

    set({ chatMessages: [...get().chatMessages, chatMsg] });
  },

  restartGame: () => {
    const { room, localPlayer, transport } = get();
    if (!room || !localPlayer || !transport) return;

    const seed = Math.floor(Math.random() * 1_000_000);
    const updatedRoom: RoomState = {
      ...room,
      status: 'playing',
      seed,
      lastActive: Date.now(),
    };

    transport.send({
      type: 'RESTART_GAME',
      seed,
      roomCode: room.code,
      senderId: localPlayer.id,
    });

    const restartMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      senderId: 'system',
      senderName: 'Dealer',
      senderAvatar: '♠️',
      text: 'New round started! Re-shuffling 52 cards.',
      timestamp: Date.now(),
      isSystem: true,
    };

    set({
      room: updatedRoom,
      newGameSeed: seed,
      lastRemoteMove: null,
      chatMessages: [...get().chatMessages, restartMsg],
    });
  },

  leaveRoom: () => {
    const { room, localPlayer, transport } = get();
    if (transport && localPlayer && room) {
      transport.send({
        type: 'PLAYER_LEAVE',
        playerId: localPlayer.id,
        senderId: localPlayer.id,
      });
      transport.destroy();
    }

    set({
      room: null,
      localPlayer: null,
      transport: null,
      chatMessages: [],
      lastRemoteMove: null,
      newGameSeed: null,
      isConnected: false,
    });
  },
}));

function handleIncomingMessage(
  envelope: TransportEnvelope,
  get: () => RoomStoreState,
  set: (state: Partial<RoomStoreState>) => void,
) {
  const { localPlayer, room } = get();
  if (!localPlayer) return;

  if (envelope.senderId === localPlayer.id) return;

  const payload = envelope.payload;

  switch (payload.type) {
    case 'ROOM_SYNC': {
      const remoteRoom = payload.room;
      const updatedLocalPlayer = remoteRoom.seats.find(
        (s) => s.player?.id === localPlayer.id,
      )?.player ?? localPlayer;

      set({
        room: remoteRoom,
        localPlayer: updatedLocalPlayer,
      });
      break;
    }

    case 'PLAYER_JOIN': {
      if (!room) return;
      const joinedPlayer = payload.player;

      const newSeats = [...room.seats];
      if (joinedPlayer.seatIndex >= 0 && joinedPlayer.seatIndex < newSeats.length) {
        newSeats[joinedPlayer.seatIndex] = {
          seatIndex: joinedPlayer.seatIndex,
          player: joinedPlayer,
          isBot: false,
        };
      }

      const updatedRoom: RoomState = {
        ...room,
        seats: newSeats,
        lastActive: Date.now(),
      };

      const joinMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        senderName: 'Dealer',
        senderAvatar: '♠️',
        text: `${joinedPlayer.name} joined the room!`,
        timestamp: Date.now(),
        isSystem: true,
      };

      set({
        room: updatedRoom,
        chatMessages: [...get().chatMessages, joinMsg],
      });

      if (localPlayer.isHost && get().transport) {
        get().transport!.send({
          type: 'ROOM_SYNC',
          room: updatedRoom,
          senderId: localPlayer.id,
        });
      }
      break;
    }

    case 'PLAYER_LEAVE': {
      if (!room) return;
      const leavingId = payload.playerId;
      const leavingSeat = room.seats.find((s) => s.player?.id === leavingId);
      const leavingName = leavingSeat?.player?.name ?? 'A player';

      // Leave seat empty (not automatically converted to a bot)
      const newSeats = room.seats.map((seat) => {
        if (seat.player?.id === leavingId) {
          return {
            ...seat,
            player: null,
            isBot: false,
          };
        }
        return seat;
      });

      let newHostId = room.hostId;
      if (room.hostId === leavingId) {
        const nextHuman = newSeats.find((s) => s.player && !s.player.isBot)?.player;
        if (nextHuman) {
          newHostId = nextHuman.id;
        }
      }

      const updatedRoom: RoomState = {
        ...room,
        hostId: newHostId,
        seats: newSeats,
        lastActive: Date.now(),
      };

      const isMeNowHost = newHostId === localPlayer.id;
      const updatedLocalPlayer: RoomPlayer = {
        ...localPlayer,
        isHost: isMeNowHost || localPlayer.isHost,
      };

      const leaveMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        senderName: 'Dealer',
        senderAvatar: '♠️',
        text: `${leavingName} left the room.`,
        timestamp: Date.now(),
        isSystem: true,
      };

      set({
        room: updatedRoom,
        localPlayer: updatedLocalPlayer,
        chatMessages: [...get().chatMessages, leaveMsg],
      });
      break;
    }

    case 'CLAIM_SEAT': {
      if (!room) return;
      const { playerId, seatIndex } = payload;
      const newSeats = room.seats.map((seat) => {
        if (seat.player?.id === playerId) {
          return { ...seat, player: null, isBot: false };
        }
        return seat;
      });

      const updatedRoom: RoomState = {
        ...room,
        seats: newSeats,
        lastActive: Date.now(),
      };

      set({ room: updatedRoom });
      break;
    }

    case 'TOGGLE_BOT_SEAT': {
      if (!room) return;
      const { seatIndex, isBot, botName } = payload;
      const newSeats = [...room.seats];
      if (newSeats[seatIndex]) {
        newSeats[seatIndex] = {
          seatIndex,
          isBot,
          player: isBot
            ? {
                id: `bot-${seatIndex}`,
                name: botName ?? `Bot ${seatIndex}`,
                avatar: '🤖',
                isBot: true,
                isHost: false,
                seatIndex,
                ready: true,
              }
            : null,
        };
      }

      set({
        room: {
          ...room,
          seats: newSeats,
          lastActive: Date.now(),
        },
      });
      break;
    }

    case 'START_GAME': {
      const remoteRoom = payload.room;
      const myUpdatedPlayer = remoteRoom.seats.find(
        (s) => s.player?.id === localPlayer.id,
      )?.player ?? localPlayer;

      const startMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        senderName: 'Dealer',
        senderAvatar: '♠️',
        text: `Host started the game with ${remoteRoom.seats.length} players! Dealing cards...`,
        timestamp: Date.now(),
        isSystem: true,
      };

      set({
        room: remoteRoom,
        localPlayer: myUpdatedPlayer,
        newGameSeed: payload.seed,
        chatMessages: [...get().chatMessages, startMsg],
        lastRemoteMove: null,
      });
      break;
    }

    case 'APPLY_MOVE': {
      set({
        lastRemoteMove: {
          move: payload.move,
          turnNumber: payload.turnNumber,
          senderId: payload.senderId,
        },
      });
      break;
    }

    case 'RESTART_GAME': {
      if (!room) return;
      const updatedRoom: RoomState = {
        ...room,
        status: 'playing',
        seed: payload.seed,
        lastActive: Date.now(),
      };

      const restartMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        senderName: 'Dealer',
        senderAvatar: '♠️',
        text: 'Host started a new round! Re-shuffling 52 cards.',
        timestamp: Date.now(),
        isSystem: true,
      };

      set({
        room: updatedRoom,
        newGameSeed: payload.seed,
        lastRemoteMove: null,
        chatMessages: [...get().chatMessages, restartMsg],
      });
      break;
    }

    case 'CHAT_MESSAGE': {
      set({
        chatMessages: [...get().chatMessages, payload.message],
      });
      break;
    }
  }
}
