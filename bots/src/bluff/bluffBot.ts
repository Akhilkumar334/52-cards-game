// ---------------------------------------------------------------------------
// Bluff bot implementation — implements BotPlayer<BluffGameState, BluffMove>.
// Bots only inspect visible state and pick a legal move.
// ---------------------------------------------------------------------------

import type { BotPlayer } from '../types';
import type { BluffGameState, BluffMove, Card, Rank } from '@cards/engine';
import { createRng, type SeededRng } from '@cards/engine';

export interface BluffBotOptions {
  readonly bluffProbability?: number; // chance of bluffing even with matching cards (default 0.22)
  readonly baseChallengeProbability?: number; // base challenge chance (default 0.08)
  readonly seed?: number;
}

export class BluffBot implements BotPlayer<BluffGameState, BluffMove> {
  private readonly rng: SeededRng;
  private readonly bluffProbability: number;
  private readonly baseChallengeProbability: number;

  constructor(options: BluffBotOptions = {}) {
    this.bluffProbability = options.bluffProbability ?? 0.22;
    this.baseChallengeProbability = options.baseChallengeProbability ?? 0.08;
    this.rng = createRng(options.seed ?? Math.floor(Math.random() * 1_000_000));
  }

  public chooseMove(visibleState: BluffGameState, legalMoves: BluffMove[]): BluffMove {
    if (legalMoves.length === 0) {
      throw new Error('No legal moves available for bot');
    }

    if (legalMoves.length === 1) {
      return legalMoves[0]!;
    }

    const firstMove = legalMoves[0]!;
    const myId = firstMove.playerId;
    const myPlayer = visibleState.players.find((p) => p.id === myId);
    const hand: readonly Card[] = myPlayer?.hand ?? [];

    const challengeMove = legalMoves.find((m): m is Extract<BluffMove, { type: 'CHALLENGE' }> => m.type === 'CHALLENGE');
    const passChallengeMove = legalMoves.find((m): m is Extract<BluffMove, { type: 'PASS_CHALLENGE' }> => m.type === 'PASS_CHALLENGE');
    const playMoves = legalMoves.filter((m): m is Extract<BluffMove, { type: 'PLAY' }> => m.type === 'PLAY');
    const passTurnMove = legalMoves.find((m): m is Extract<BluffMove, { type: 'PASS_TURN' }> => m.type === 'PASS_TURN');

    // 1. If challenge is an option, evaluate suspicion on previous play
    if (challengeMove) {
      const wantsChallenge = this.shouldChallenge(visibleState, myId, hand);
      if (wantsChallenge) {
        return challengeMove;
      }
      // If in cycle mode where only challenge or pass_challenge is legal:
      if (passChallengeMove && playMoves.length === 0) {
        return passChallengeMove;
      }
    }

    // 2. Play or Pass decisions in continuous round flow
    if (playMoves.length > 0) {
      if (visibleState.canLeadRank) {
        // Round leader always leads cards
        return this.choosePlayMove(visibleState, myId, hand, playMoves);
      }

      // Check if bot holds honest matching cards of currentRank
      const matchingCards = hand.filter((c) => c.rank === visibleState.currentRank);

      // Check if turn returned to the bot after all opponents skipped on its own play
      const isReturningToSelf =
        visibleState.lastPlayedPlayerIndex !== null &&
        visibleState.players[visibleState.lastPlayedPlayerIndex]?.id === myId;

      if (isReturningToSelf) {
        // If bot has no matching cards, always skip to clear table and lead new round
        if (matchingCards.length === 0 && passTurnMove) {
          return passTurnMove;
        }
        // If bot has matching cards, 50% chance to play more, 50% chance to pass and clear table
        if (passTurnMove && this.rng.next() < 0.5) {
          return passTurnMove;
        }
        return this.choosePlayMove(visibleState, myId, hand, playMoves);
      }

      if (matchingCards.length > 0) {
        // Bot has matching cards: contribute them (85% play, 15% tactical pass if pass allowed)
        if (passTurnMove && this.rng.next() < 0.15) {
          return passTurnMove;
        }
        return this.choosePlayMove(visibleState, myId, hand, playMoves);
      } else {
        // Bot has NO matching cards: decide to bluff or pass
        if (passTurnMove) {
          // Bluff with probability bluffProbability (e.g. 20%), otherwise pass/skip!
          if (this.rng.next() < this.bluffProbability) {
            return this.choosePlayMove(visibleState, myId, hand, playMoves);
          }
          return passTurnMove;
        }
        // If passing not allowed, forced to bluff
        return this.choosePlayMove(visibleState, myId, hand, playMoves);
      }
    }

    if (passTurnMove) {
      return passTurnMove;
    }

    if (passChallengeMove) {
      return passChallengeMove;
    }

    // Fallback to first legal move
    return legalMoves[0]!;
  }

  private choosePlayMove(
    state: BluffGameState,
    myId: string,
    hand: readonly Card[],
    playMoves: Extract<BluffMove, { type: 'PLAY' }>[],
  ): BluffMove {
    let declaredRank = state.currentRank;
    if (state.canLeadRank && hand.length > 0) {
      // Pick rank with highest count in hand to maximize truth-play
      const rankCounts = new Map<Rank, number>();
      for (const c of hand) {
        rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
      }
      let bestRank = hand[0]!.rank;
      let maxCount = 0;
      for (const [r, cnt] of rankCounts.entries()) {
        if (cnt > maxCount) {
          maxCount = cnt;
          bestRank = r;
        }
      }
      declaredRank = bestRank;
    }

    const matchingCards = hand.filter((c) => c.rank === declaredRank);
    const nonMatchingCards = hand.filter((c) => c.rank !== declaredRank);
    const maxAllowed =
      state.ruleset.deckCount === 1
        ? Math.min(4, state.ruleset.maxCardsPerPlay)
        : state.ruleset.maxCardsPerPlay;

    // Decision: honest vs bluff
    const hasMatching = matchingCards.length > 0;
    const playHonest = hasMatching && (this.rng.next() >= this.bluffProbability || nonMatchingCards.length === 0);

    let chosenCardIds: string[] = [];

    if (playHonest) {
      // Play 1 up to all matching cards (capped by maxAllowed)
      const count = Math.min(
        matchingCards.length,
        maxAllowed,
        this.rng.nextInt(1, Math.min(matchingCards.length, maxAllowed)),
      );
      chosenCardIds = matchingCards.slice(0, count).map((c) => c.id);
    } else {
      // Bluffing!
      // Pick 1 or 2 cards from non-matching (or any hand cards if no non-matching)
      const pool = nonMatchingCards.length > 0 ? nonMatchingCards : hand;
      const count = Math.min(pool.length, Math.min(2, maxAllowed));
      // Shuffle pool selection
      const shuffled = [...pool].sort(() => this.rng.next() - 0.5);
      chosenCardIds = shuffled.slice(0, Math.max(1, count)).map((c) => c.id);
    }

    if (chosenCardIds.length === 0 && hand.length > 0) {
      chosenCardIds = [hand[0]!.id];
    }

    // Validate if exact match exists in playMoves (if engine enumerates moves), or construct it
    const matchingMove = playMoves.find(
      (m) =>
        m.cardIds.length === chosenCardIds.length &&
        chosenCardIds.every((id) => m.cardIds.includes(id)),
    );

    return matchingMove ?? {
      type: 'PLAY',
      playerId: myId,
      cardIds: chosenCardIds,
      declaredRank: declaredRank,
    };
  }

  private shouldChallenge(
    state: BluffGameState,
    myId: string,
    hand: readonly Card[],
  ): boolean {
    const lastPlay = state.lastPlay;
    if (!lastPlay) return false;

    const claimedCount = lastPlay.cardCount;
    const claimedRank = lastPlay.declaredRank;

    // Count how many cards of that rank the bot holds in its own hand
    const myCardsOfRank = hand.filter((c) => c.rank === claimedRank).length;
    const deckCount = state.ruleset.deckCount ?? 1;
    const totalRankInDeck = 4 * deckCount;

    // 1. Certainty check: If claimed + bot's cards > total in deck, it is mathematically IMPOSSIBLE
    if (claimedCount + myCardsOfRank > totalRankInDeck) {
      return true; // 100% caught red-handed!
    }

    // 2. Target player out of cards (last play check to win the game)
    const targetPlayer = state.players.find((p) => p.id === lastPlay.playerId);
    const targetHandRemaining = targetPlayer?.hand.length ?? 0;
    if (targetHandRemaining === 0) {
      // Challenging the final winning card — healthy skepticism without guaranteed shutdown
      return this.rng.next() < 0.35;
    }

    // 3. Pile size dynamic:
    const pileSize = state.pile.length;

    // A) If the pile is small (<= 4 cards), bots prefer to let the game and pile build up!
    // Shows on tiny piles are boring. Only challenge if opponent made a huge claim (>= 3 cards).
    if (pileSize <= 4) {
      if (claimedCount >= 3) {
        return this.rng.next() < 0.15;
      }
      if (myCardsOfRank >= 2 && claimedCount >= 2) {
        return this.rng.next() < 0.10;
      }
      return this.rng.next() < (this.baseChallengeProbability * 0.25); // ~2%
    }

    // B) If the pile is large (> 12 cards), fear of picking up 12+ cards keeps bots cautious
    if (pileSize > 12) {
      if (claimedCount >= 3 && myCardsOfRank >= 1) {
        return this.rng.next() < 0.14;
      }
      return this.rng.next() < (this.baseChallengeProbability * 0.35); // ~2.8%
    }

    // C) Medium pile (5 to 12 cards) — standard tension:
    // High claim count check (claiming 3 or 4 of a rank)
    if (claimedCount >= 3) {
      return this.rng.next() < 0.18;
    }

    // Bot holds 2 of that rank and opponent claims 2
    if (myCardsOfRank >= 2 && claimedCount >= 2) {
      return this.rng.next() < 0.12;
    }

    // Base rate on medium piles: bots generally pass or play to keep the pile building
    return this.rng.next() < (this.baseChallengeProbability * 0.5); // ~4%
  }
}
