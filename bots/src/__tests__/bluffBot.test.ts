// ---------------------------------------------------------------------------
// BluffBot unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { BluffBot } from '../bluff/bluffBot';
import {
  BluffEngine,
  DEFAULT_BLUFF_RULESET,
  type BluffGameState,
  type PlayerConfig,
} from '@cards/engine';

describe('BluffBot', () => {
  const players: PlayerConfig[] = [
    { id: 'p0', name: 'Bot 0', isBot: true },
    { id: 'p1', name: 'Bot 1', isBot: true },
    { id: 'p2', name: 'Bot 2', isBot: true },
  ];

  it('selects a valid PLAY move when in play phase', () => {
    const bot = new BluffBot({ seed: 42 });
    const fullState = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, players, 123);
    const activePlayerId = fullState.players[fullState.currentPlayerIndex]!.id;
    const visible = BluffEngine.getVisibleState(fullState, activePlayerId);
    const legalMoves = BluffEngine.getLegalMoves(visible, activePlayerId);

    expect(legalMoves.length).toBeGreaterThan(0);
    const move = bot.chooseMove(visible, legalMoves);

    expect(move.type).toBe('PLAY');
    if (move.type === 'PLAY') {
      expect(move.playerId).toBe(activePlayerId);
      expect(move.cardIds.length).toBeGreaterThanOrEqual(1);
      expect(move.cardIds.length).toBeLessThanOrEqual(DEFAULT_BLUFF_RULESET.maxCardsPerPlay);
      expect(move.declaredRank).toBe(fullState.currentRank);
    }
  });

  it('selects CHALLENGE or PASS_CHALLENGE when in challenge phase', () => {
    const bot = new BluffBot({ seed: 99 });
    const fullState = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, players, 123);
    const activePlayerId = fullState.players[fullState.currentPlayerIndex]!.id;
    const visibleActive = BluffEngine.getVisibleState(fullState, activePlayerId);
    const playMove = bot.chooseMove(visibleActive, BluffEngine.getLegalMoves(visibleActive, activePlayerId));

    const stateAfterPlay = BluffEngine.applyMove(fullState, playMove);
    expect(stateAfterPlay.phase.type).toBe('challenge');

    if (stateAfterPlay.phase.type === 'challenge') {
      const challengerIndex = stateAfterPlay.phase.pendingIndices[0]!;
      const challengerId = stateAfterPlay.players[challengerIndex]!.id;

      const visibleChallenger = BluffEngine.getVisibleState(stateAfterPlay, challengerId);
      const legalMoves = BluffEngine.getLegalMoves(visibleChallenger, challengerId);

      const move = bot.chooseMove(visibleChallenger, legalMoves);
      expect(['CHALLENGE', 'PASS_CHALLENGE']).toContain(move.type);
    }
  });

  it('detects a mathematically impossible claim and always challenges', () => {
    // If bot holds all 4 Aces, and opponent claims 1 Ace, opponent MUST be lying
    const bot = new BluffBot({ seed: 1 });
    const fullState = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, players, 123);

    // Let's craft a visible state where bot holds 4 Aces
    const modifiedPlayers = fullState.players.map((p, i) => {
      if (i === 1) {
        return {
          ...p,
          hand: [
            { id: 'AS', suit: 'S', rank: 'A', deckIndex: 0 },
            { id: 'AH', suit: 'H', rank: 'A', deckIndex: 0 },
            { id: 'AD', suit: 'D', rank: 'A', deckIndex: 0 },
            { id: 'AC', suit: 'C', rank: 'A', deckIndex: 0 },
          ] as const,
        };
      }
      return p;
    });

    const stateWithImpossibleClaim: BluffGameState = {
      ...fullState,
      players: modifiedPlayers,
      phase: { type: 'challenge', pendingIndices: [1] },
      lastPlay: {
        playerId: 'p0',
        playerIndex: 0,
        cards: [], // hidden
        declaredRank: 'A',
        cardCount: 1, // Opponent claimed an Ace, but bot has all 4!
      },
    };

    const legalMoves = BluffEngine.getLegalMoves(stateWithImpossibleClaim, 'p1');
    const move = bot.chooseMove(stateWithImpossibleClaim, legalMoves);

    expect(move.type).toBe('CHALLENGE');
  });

  it('rarely calls show on small piles with standard claims so the pile builds up', () => {
    const fullState = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, players, 123);
    const stateSmallPile: BluffGameState = {
      ...fullState,
      phase: { type: 'challenge', pendingIndices: [1] },
      pile: [
        { id: 'c1', suit: 'H', rank: '7', deckIndex: 0 },
        { id: 'c2', suit: 'D', rank: '7', deckIndex: 0 },
      ],
      lastPlay: {
        playerId: 'p0',
        playerIndex: 0,
        cards: [],
        declaredRank: '7',
        cardCount: 1, // Standard single card claim
      },
    };

    const legalMoves = BluffEngine.getLegalMoves(stateSmallPile, 'p1');
    let challengeCount = 0;
    const TOTAL_TRIALS = 100;

    for (let seed = 0; seed < TOTAL_TRIALS; seed++) {
      const bot = new BluffBot({ seed });
      const move = bot.chooseMove(stateSmallPile, legalMoves);
      if (move.type === 'CHALLENGE') {
        challengeCount++;
      }
    }

    // Challenge rate on small pile single claim should be <= 10% (around 2-3%), allowing the pile to build up!
    expect(challengeCount).toBeLessThanOrEqual(10);
  });
});

