// ---------------------------------------------------------------------------
// Thulla (Bhabhi) game state types — all fields are readonly (immutable pattern).
// ---------------------------------------------------------------------------

import type { Card, PlayerId, Suit } from '../core/types';
import type { ThullaRuleset } from './schema';

export interface ThullaPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly isBot: boolean;
  /** Full hand. Hidden in visible state exposed to opponents. */
  readonly hand: readonly Card[];
  /** Whether player has emptied hand and escaped. */
  readonly hasEscaped: boolean;
  /** Finish rank (1 = 1st, 2 = 2nd, etc.) */
  readonly finishOrder: number | null;
}

export interface ThullaTrickCard {
  readonly playerId: PlayerId;
  readonly playerIndex: number;
  readonly card: Card;
  /** Whether this card triggered a Thulla (different suit than led suit). */
  readonly isThulla: boolean;
}

export interface ThullaTrick {
  readonly ledSuit: Suit;
  readonly cards: readonly ThullaTrickCard[];
  /** Player index of the current highest card of ledSuit in this trick. */
  readonly highestPlayerIndex: number;
}

export type ThullaPhase =
  | { readonly type: 'play' }
  | { readonly type: 'gameover' };

export interface ThullaGameState {
  readonly ruleset: ThullaRuleset;
  readonly players: readonly ThullaPlayer[];
  readonly currentPlayerIndex: number;
  /** Current active trick, or null if waiting for new trick lead. */
  readonly currentTrick: ThullaTrick | null;
  /** Discarded / burned trick cards permanently removed from play. */
  readonly discardPile: readonly Card[];
  /** Last resolved trick details for visual animations and feedback. */
  readonly lastResolvedTrick: {
    readonly cards: readonly ThullaTrickCard[];
    readonly wasThulla: boolean;
    readonly penaltyPlayerId: PlayerId | null;
    readonly winnerPlayerId: PlayerId | null;
  } | null;
  readonly phase: ThullaPhase;
  /** List of escaped player IDs in order of escape (1st, 2nd, 3rd). */
  readonly escapedPlayerIds: readonly PlayerId[];
  /** The final loser holding cards (the Bhabhi). */
  readonly bhabhiPlayerId: PlayerId | null;
  /** Total cards in play (52 or 104). Preserved via invariants. */
  readonly totalCards: number;
  readonly trickNumber: number;
  readonly log: readonly string[];
}
