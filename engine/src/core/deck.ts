// ---------------------------------------------------------------------------
// Deck construction and Fisher-Yates shuffle.
// Pure functions — no side effects, no randomness except through injected RNG.
// ---------------------------------------------------------------------------

import type { Card } from './types';
import { RANKS, SUITS } from './types';
import type { SeededRng } from './rng';

/**
 * Build an ordered deck (or double deck) of 52 / 104 cards.
 * Cards are stable-sorted: suit × rank. Shuffle separately.
 */
export function buildDeck(deckCount: 1 | 2): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        // Append deck index suffix only when using 2 decks so card IDs remain unique.
        const id = deckCount === 1 ? `${rank}${suit}` : `${rank}${suit}:${d}`;
        cards.push({ id, suit, rank, deckIndex: d });
      }
    }
  }
  return cards;
}

/**
 * In-place Fisher-Yates shuffle. Returns a new array (does not mutate input).
 * Requires the injected SeededRng so the result is deterministic per seed.
 */
export function shuffle<T>(arr: readonly T[], rng: SeededRng): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}
