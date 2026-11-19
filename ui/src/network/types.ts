import type { BluffMove, BluffRuleset } from '@cards/engine';

export type GameType = 'bluff' | 'thulla' | 'seep';

export interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  isHost: boolean;
  seatIndex: number;
  ready: boolean;
}

export interface RoomSeat {
  seatIndex: number;
  player: RoomPlayer | null;
  isBot: boolean;
  botDifficulty?: 'easy' | 'normal' | 'hard';
}

export type RoomStatus = 'lobby' | 'playing' | 'gameover';

export interface RoomState {
  code: string;
  game: GameType;
  hostId: string;
  maxPlayers: number;
  seats: RoomSeat[];
  status: RoomStatus;
  seed: number;
  ruleset?: BluffRuleset;
  createdAt: number;
  lastActive: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export type RoomMessage =
  | {
      type: 'ROOM_SYNC';
      room: RoomState;
      senderId: string;
    }
  | {
      type: 'PLAYER_JOIN';
      player: RoomPlayer;
      senderId: string;
    }
  | {
      type: 'PLAYER_LEAVE';
      playerId: string;
      senderId: string;
    }
  | {
      type: 'CLAIM_SEAT';
      playerId: string;
      seatIndex: number;
      senderId: string;
    }
  | {
      type: 'TOGGLE_BOT_SEAT';
      seatIndex: number;
      isBot: boolean;
      botName?: string;
      senderId: string;
    }
  | {
      type: 'START_GAME';
      room: RoomState;
      seed: number;
      senderId: string;
    }
  | {
      type: 'APPLY_MOVE';
      move: BluffMove;
      turnNumber: number;
      senderId: string;
      roomCode: string;
    }
  | {
      type: 'RESTART_GAME';
      seed: number;
      roomCode: string;
      senderId: string;
    }
  | {
      type: 'CHAT_MESSAGE';
      message: ChatMessage;
      senderId: string;
    }
  | {
      type: 'PING';
      senderId: string;
    }
  | {
      type: 'PONG';
      senderId: string;
    };
