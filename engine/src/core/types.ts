// ---------------------------------------------------------------------------
// Core card domain types — used by all games.
// No game logic here; pure structural definitions.
// ---------------------------------------------------------------------------

export type Suit = 'S' | 'H' | 'D' | 'C';

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'] as const;

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'T'
  | 'J'
  | 'Q'
  | 'K';

export const RANKS: readonly Rank[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K',
] as const;

/** Zero-based order index for each rank (A=0, 2=1 … K=12). */
export const RANK_ORDER: Readonly<Record<Rank, number>> = {
  A: 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6,
  '8': 7, '9': 8, T: 9, J: 10, Q: 11, K: 12,
};

/** Numeric face-values used by Seep (A=1, 2-10 face, J=11, Q=12, K=13). */
export const SEEP_VALUES: Readonly<Record<Rank, number>> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13,
};

export type CardId = string; // e.g. "AS", "TD", "KH:1" (deck index suffix for 2-deck games)

export interface Card {
  readonly id: CardId;
  readonly suit: Suit;
  readonly rank: Rank;
  /** 0 = first deck, 1 = second deck. Allows duplicate rank+suit when deckCount=2. */
  readonly deckIndex: number;
}

export type PlayerId = string;

export interface PlayerConfig {
  readonly id: PlayerId;
  readonly name: string;
  readonly isBot: boolean;
}
