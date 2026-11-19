// ---------------------------------------------------------------------------
// Thulla bot implementation — implements BotPlayer<ThullaGameState, ThullaMove>.
// Bots only inspect visible state and legal moves.
// ---------------------------------------------------------------------------

import type { BotPlayer } from '../types';
import type { ThullaGameState, ThullaMove, Card } from '@cards/engine';
import { createRng, type SeededRng, RANK_ORDER } from '@cards/engine';

export interface ThullaBotOptions {
  readonly seed?: number;
}

export class ThullaBot implements BotPlayer<ThullaGameState, ThullaMove> {
  private readonly rng: SeededRng;

  constructor(options: ThullaBotOptions = {}) {
    this.rng = createRng(options.seed ?? Math.floor(Math.random() * 1_000_000));
  }

  public chooseMove(visibleState: ThullaGameState, legalMoves: ThullaMove[]): ThullaMove {
    if (legalMoves.length === 0) {
      throw new Error('No legal moves available for bot');
    }

    if (legalMoves.length === 1) {
      return legalMoves[0]!;
    }

    const myId = legalMoves[0]!.playerId;
    const myPlayer = visibleState.players.find((p) => p.id === myId);
    const hand: readonly Card[] = myPlayer?.hand ?? [];

    const currentTrick = visibleState.currentTrick;

    // 1. Leading a new trick
    if (currentTrick === null) {
      // Find cards in hand corresponding to legal moves
      const availableCards = hand.filter((c) => legalMoves.some((m) => m.cardId === c.id));
      if (availableCards.length === 0) return legalMoves[0]!;

      // Heuristic: Prefer leading lower cards (power <= 6) to avoid getting slapped with Thulla
      const sortedByPower = [...availableCards].sort(
        (a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank],
      );

      // 70% chance to lead lowest card, 30% chance to lead second lowest
      const chosenCard =
        sortedByPower.length > 1 && this.rng.next() < 0.3
          ? sortedByPower[1]!
          : sortedByPower[0]!;

      return { type: 'PLAY_CARD', playerId: myId, cardId: chosenCard.id };
    }

    // 2. Following a trick in progress: MUST follow suit if holding cards of ledSuit
    const ledSuit = currentTrick.ledSuit;
    const cardsOfLedSuitInHand = hand.filter((c) => c.suit === ledSuit);
    const legalCards = hand.filter((c) => legalMoves.some((m) => m.cardId === c.id));
    const followingSuitCards = legalCards.filter((c) => c.suit === ledSuit);

    if (cardsOfLedSuitInHand.length > 0 || followingSuitCards.length > 0) {
      // Must strictly follow suit! Bot cannot play any other suit's card.
      const candidateCards = followingSuitCards.length > 0 ? followingSuitCards : cardsOfLedSuitInHand;
      // Check current highest card of led suit in trick
      const highestCardInTrick = currentTrick.cards.find(
        (tc) =>
          tc.playerIndex === currentTrick.highestPlayerIndex &&
          tc.card.suit === ledSuit,
      );

      const highestPower = highestCardInTrick
        ? RANK_ORDER[highestCardInTrick.card.rank]
        : -1;

      // Cards safely below the highest card
      const safeCards = candidateCards.filter(
        (c) => RANK_ORDER[c.rank] < highestPower,
      );

      if (safeCards.length > 0) {
        // Play highest safe card to shed maximum value safely
        safeCards.sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank]);
        return { type: 'PLAY_CARD', playerId: myId, cardId: safeCards[0]!.id };
      }

      // If cannot play lower, play lowest card of that suit to minimize risk
      candidateCards.sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
      return { type: 'PLAY_CARD', playerId: myId, cardId: candidateCards[0]!.id };
    }

    // 3. Void in led suit → THULLA (Slap opportunity!)
    // Dump highest dangerous card (Ace/King of another suit) onto the highest card player!
    const offSuitCards = [...legalCards].sort(
      (a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank],
    );

    const highestDumpCard = offSuitCards[0]!;
    return { type: 'PLAY_CARD', playerId: myId, cardId: highestDumpCard.id };
  }
}
