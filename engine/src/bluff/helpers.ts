// ---------------------------------------------------------------------------
// Bluff helper utilities — pure functions extracted to keep engine.ts slim.
// ---------------------------------------------------------------------------

import type { Rank, Card, PlayerId } from '../core/types';
import { RANKS, RANK_ORDER } from '../core/types';
import type { BluffGameState, BluffPlayer } from './state';

// ─── Rank arithmetic ────────────────────────────────────────────────────────

/** Advance rank cyclically: A→2→3→…→K→A. */
export function advanceRank(rank: Rank): Rank {
  const next = (RANK_ORDER[rank] + 1) % RANKS.length;
  return RANKS[next]!;
}

// ─── Card resolution ────────────────────────────────────────────────────────

/**
 * Resolve card IDs to Card objects using the player's hand as the source of truth.
 * Throws a plain Error (wrapped to GameError by the caller) if any ID is missing.
 */
export function resolveCardIds(cardIds: readonly string[], hand: readonly Card[]): Card[] {
  const handMap = new Map<string, Card>(hand.map(c => [c.id, c]));
  const resolved: Card[] = [];
  for (const id of cardIds) {
    const card = handMap.get(id);
    if (!card) throw new Error(`Card "${id}" not found in hand`);
    resolved.push(card);
  }
  return resolved;
}

/** Return a new hand with the given cards removed (by id). */
export function removeCards(hand: readonly Card[], cards: readonly Card[]): Card[] {
  const toRemove = new Set(cards.map(c => c.id));
  return hand.filter(c => !toRemove.has(c.id));
}

// ─── Player utilities ───────────────────────────────────────────────────────

/** Return the index of the player holding the Ace of Spades; falls back to 0. */
export function findAceOfSpadesHolder(players: readonly BluffPlayer[]): number {
  for (let i = 0; i < players.length; i++) {
    const player = players[i]!;
    if (player.hand.some(c => c.suit === 'S' && c.rank === 'A')) return i;
  }
  return 0;
}

// ─── Turn order after challenge ─────────────────────────────────────────────

/**
 * Who plays next after a challenge resolves?
 *   loser    → the player who picked up the pile (loserIndex).
 *   winner   → the player who won the challenge (winnerIndex).
 *   sequence → the seat immediately after the player who made the challenged play.
 */
export function getNextPlayerAfterChallenge(
  rule: 'loser' | 'winner' | 'sequence',
  loserIndex: number,
  winnerIndex: number,
  playedPlayerIndex: number,
  playerCount: number,
): number {
  switch (rule) {
    case 'loser':
      return loserIndex;
    case 'winner':
      return winnerIndex;
    case 'sequence':
      return (playedPlayerIndex + 1) % playerCount;
  }
}

// ─── Visibility ─────────────────────────────────────────────────────────────

/**
 * Strip hidden information before handing state to a bot or the UI for
 * opponent seats. Hides:
 *   - other players' hands  (face-down cards)
 *   - the pile              (face-down)
 *   - lastPlay.cards        (face-down played cards)
 */
export function getBluffVisibleState(
  state: BluffGameState,
  forPlayerId: PlayerId,
): BluffGameState {
  const emptyHand: readonly Card[] = Object.freeze([]);
  return {
    ...state,
    players: state.players.map(p =>
      p.id === forPlayerId ? p : { ...p, hand: emptyHand },
    ),
    pile: emptyHand,
    lastPlay: state.lastPlay ? { ...state.lastPlay, cards: emptyHand } : null,
  };
}
