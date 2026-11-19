// ---------------------------------------------------------------------------
// Thulla helper utilities — pure helper functions for Thulla engine.
// ---------------------------------------------------------------------------

import type { Card, CardId, PlayerId, Rank, Suit } from '../core/types';
import { RANK_ORDER } from '../core/types';
import type { ThullaGameState, ThullaPlayer } from './state';

/** Rank comparison in Thulla: 2 is lowest, Ace is highest in every suit. */
export const THULLA_RANK_POWER: Readonly<Record<Rank, number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export function getRankPower(rank: Rank): number {
  return THULLA_RANK_POWER[rank];
}

/** Find the player holding Ace of Spades (AS). Falls back to 0. */
export function findAceOfSpadesHolder(players: readonly ThullaPlayer[]): number {
  for (let i = 0; i < players.length; i++) {
    if (players[i]!.hand.some((c) => c.suit === 'S' && c.rank === 'A')) {
      return i;
    }
  }
  return 0;
}

/** Get next active player clockwise who has not escaped. */
export function getNextActivePlayerIndex(
  startIndex: number,
  players: readonly ThullaPlayer[],
): number {
  const n = players.length;
  for (let offset = 1; offset < n; offset++) {
    const idx = (startIndex + offset) % n;
    if (!players[idx]!.hasEscaped && players[idx]!.hand.length > 0) {
      return idx;
    }
  }
  return startIndex;
}

/** Return remaining active players who have not escaped. */
export function getRemainingActivePlayers(players: readonly ThullaPlayer[]): ThullaPlayer[] {
  return players.filter((p) => !p.hasEscaped && p.hand.length > 0);
}

/** Remove card from hand by id. */
export function removeCardFromHand(hand: readonly Card[], cardId: CardId): Card[] {
  return hand.filter((c) => c.id !== cardId);
}

/** Mask opponent hands for visible state. */
export function getThullaVisibleState(
  state: ThullaGameState,
  forPlayerId: PlayerId,
): ThullaGameState {
  const emptyHand: readonly Card[] = Object.freeze([]);
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === forPlayerId ? p : { ...p, hand: emptyHand },
    ),
  };
}
