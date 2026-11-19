// ---------------------------------------------------------------------------
// Seep (Sweep) Domain State Types
// Pure TypeScript immutable state representations.
// Supports 2, 3, and 4 players, floor items (loose cards + houses),
// persistent opening bids, and comprehensive seep lifecycles (active/downed/permanent).
// ---------------------------------------------------------------------------

import type { Card, CardId, PlayerConfig, PlayerId } from '../core/types';
import type { SeepRuleset } from './schema';

export interface SeepPlayer extends PlayerConfig {
  readonly hand: readonly Card[];
  readonly teamIndex: number;
}

export interface SeepHouse {
  readonly id: string;
  readonly buildValue: number; // 9 to 13
  readonly ownerPlayerIndex: number;
  readonly ownerTeamIndex: number;
  readonly coOwnerPlayerIndex?: number;
  readonly coOwnerTeamIndex?: number;
  readonly isCemented: boolean;
  readonly cards: readonly Card[];
}

export type FloorItem =
  | { readonly type: 'loose'; readonly id: string; readonly card: Card }
  | { readonly type: 'house'; readonly id: string; readonly house: SeepHouse };

export interface SeepFloor {
  readonly items: readonly FloorItem[];
  // Convenience accessors
  readonly looseCards: readonly Card[];
  readonly houses: readonly SeepHouse[];
}

export interface SeepTeam {
  readonly teamIndex: number;
  readonly name: string;
  readonly playerIndices: readonly number[];
  readonly capturedCards: readonly Card[];
  readonly permanentSeep: boolean; // Cannot be downed (e.g. opening seep)
  readonly activeSeeps: number;     // Active additional seeps (eligible for takedown)
  readonly downedSeeps: number;     // Cancelled seeps
  readonly seepCount: number;       // Total net seeps (permanent + active)
  readonly roundScore: number;
  readonly totalScore: number;
}

export interface OpeningBidInfo {
  readonly playerId: PlayerId;
  readonly playerIndex: number;
  readonly houseValue: number; // 9 to 13
  readonly isCaptured: boolean;
  readonly active: boolean;
}

export type SeepPhase =
  | { readonly type: 'bidding' }
  | { readonly type: 'playing' }
  | { readonly type: 'round_over'; readonly winnerTeamIndex: number | null }
  | { readonly type: 'game_over'; readonly matchWinnerTeamIndex: number };

export interface SeepGameState {
  readonly ruleset: SeepRuleset;
  readonly players: readonly SeepPlayer[];
  readonly teams: readonly SeepTeam[];
  readonly currentPlayerIndex: number;
  readonly bidderIndex: number;
  readonly floor: SeepFloor;
  readonly phase: SeepPhase;
  readonly openingBid: OpeningBidInfo | null;
  readonly firstSeepOccurred: boolean;
  readonly lastCapturePlayerIndex: number | null;
  readonly lastActionAnnouncement: string | null;
  readonly forcedReason: string | null;
  readonly roundNumber: number;
  readonly turnNumber: number;
  readonly log: readonly string[];
  readonly undealtDeck?: readonly Card[];
}
