// ---------------------------------------------------------------------------
// Generic GameEngine interface — implemented by Bluff, Thulla, and Seep.
// All functions are pure: no I/O, no global state, no randomness (use seed).
// ---------------------------------------------------------------------------

import type { PlayerId, PlayerConfig } from './core/types';

export type { PlayerConfig };

/**
 * S = GameState, M = Move, R = Ruleset
 *
 * Contract:
 * - createGame deep-clones the ruleset into state; the live config is NEVER read again.
 * - getLegalMoves receives VISIBLE state only; caller must hide opponent hands.
 * - applyMove is immutable — it always returns a NEW state, never mutates.
 * - applyMove throws GameError on any illegal move.
 */
export interface GameEngine<S, M, R> {
  createGame(ruleset: R, players: PlayerConfig[], seed: number): S;
  getLegalMoves(state: S, playerId: PlayerId): M[];
  applyMove(state: S, move: M): S;
  isGameOver(state: S): boolean;
  /** Throws if !isGameOver(state). */
  getScores(state: S): Record<PlayerId, number>;
}

/** Thrown by applyMove when a move is illegal. Carries a machine-readable code. */
export class GameError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}
