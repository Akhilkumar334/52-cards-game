// ---------------------------------------------------------------------------
// Bluff game state types — all fields are readonly (immutable state pattern).
// ---------------------------------------------------------------------------

import type { Card, Rank, PlayerId } from '../core/types';
import type { BluffRuleset } from './schema';

/**
 * The game sits in one of three phases:
 *   play      — currentPlayerIndex must make a PLAY (or PASS_TURN if allowed).
 *   challenge — pendingIndices[0] must CHALLENGE or PASS_CHALLENGE.
 *   gameover  — a winner exists; no more moves are legal.
 */
export type BluffPhase =
  | { readonly type: 'play' }
  | { readonly type: 'challenge'; readonly pendingIndices: readonly number[] }
  | { readonly type: 'gameover' };

export interface BluffPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly isBot: boolean;
  /** Full hand. In the VISIBLE state exposed to opponents this is an empty array. */
  readonly hand: readonly Card[];
}

/**
 * Records the most recent play for challenge purposes.
 * cards[] is hidden in the visible state (these are the face-down cards).
 */
export interface BluffLastPlay {
  readonly playerId: PlayerId;
  readonly playerIndex: number;
  /** Actual cards placed face-down. Hidden from opponents via getBluffVisibleState. */
  readonly cards: readonly Card[];
  readonly declaredRank: Rank;
  /** Visible count — opponents can see how many cards were played. */
  readonly cardCount: number;
}

export interface BluffGameState {
  readonly ruleset: BluffRuleset; // snapshotted at createGame, never mutated
  readonly players: readonly BluffPlayer[];
  readonly currentPlayerIndex: number;
  /** Rank currently active or declared for this round. */
  readonly currentRank: Rank;
  /** Whether the current player can freely choose any rank to lead this round. */
  readonly canLeadRank: boolean;
  /**
   * Accumulated face-down pile. Grows every PLAY, cleared on CHALLENGE or on all-pass in tableClear mode.
   * Hidden in visible state (pile is face-down).
   */
  readonly pile: readonly Card[];
  /** Cleared / burned cards removed from play after all players pass. */
  readonly discardPile: readonly Card[];
  /** Total consecutive passes since the last PLAY. */
  readonly consecutivePasses: number;
  /** Index of player who placed the most recent cards on pile. */
  readonly lastPlayedPlayerIndex: number | null;
  /** Most recent play — the one open to challenge. Null after challenge resolves. */
  readonly lastPlay: BluffLastPlay | null;
  readonly phase: BluffPhase;
  readonly winnerId: PlayerId | null;
  /** Total cards in play (52 or 104). Used for conservation checks. */
  readonly totalCards: number;
  readonly turnNumber: number;
  /** Human-readable event log shown in the UI. */
  readonly log: readonly string[];
}
