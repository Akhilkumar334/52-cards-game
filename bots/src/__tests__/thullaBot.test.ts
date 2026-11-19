// ---------------------------------------------------------------------------
// ThullaBot unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { ThullaBot } from '../thulla/thullaBot';
import { ThullaEngine, DEFAULT_THULLA_RULESET, type ThullaGameState } from '@cards/engine';

describe('ThullaBot', () => {
  it('selects legal moves and plays Ace of Spades if opening game', () => {
    const s = ThullaEngine.createGame(DEFAULT_THULLA_RULESET, [
      { id: 'b0', name: 'Bot 0', isBot: true },
      { id: 'b1', name: 'Bot 1', isBot: true },
    ], 42);

    const bot = new ThullaBot({ seed: 100 });
    const active = s.players[s.currentPlayerIndex]!;
    const visible = ThullaEngine.getVisibleState(s, active.id);
    const legal = ThullaEngine.getLegalMoves(visible, active.id);

    const move = bot.chooseMove(visible, legal);
    expect(move.type).toBe('PLAY_CARD');
    const card = active.hand.find((c) => c.id === move.cardId)!;
    expect(card.suit).toBe('S');
    expect(card.rank).toBe('A');
  });

  it('correctly dumps high card on Thulla when void in led suit', () => {
    const bot = new ThullaBot({ seed: 200 });
    // Construct state where led suit is Spades, bot has no spades, but has King of Hearts and 2 of Clubs
    const mockState: ThullaGameState = {
      ruleset: DEFAULT_THULLA_RULESET,
      players: [
        { id: 'p0', name: 'P0', isBot: true, hand: [], hasEscaped: false, finishOrder: null },
        {
          id: 'bot',
          name: 'Bot',
          isBot: true,
          hand: [
            { id: '2C', suit: 'C', rank: '2', deckIndex: 0 },
            { id: 'KH', suit: 'H', rank: 'K', deckIndex: 0 },
          ],
          hasEscaped: false,
          finishOrder: null,
        },
      ],
      currentPlayerIndex: 1,
      currentTrick: {
        ledSuit: 'S',
        cards: [
          { playerId: 'p0', playerIndex: 0, card: { id: 'AS', suit: 'S', rank: 'A', deckIndex: 0 }, isThulla: false },
        ],
        highestPlayerIndex: 0,
      },
      discardPile: [],
      lastResolvedTrick: null,
      phase: { type: 'play' },
      escapedPlayerIds: [],
      bhabhiPlayerId: null,
      totalCards: 52,
      trickNumber: 0,
      log: [],
    };

    const legal = [
      { type: 'PLAY_CARD' as const, playerId: 'bot', cardId: '2C' },
      { type: 'PLAY_CARD' as const, playerId: 'bot', cardId: 'KH' },
    ];

    const move = bot.chooseMove(mockState, legal);
    // Bot should dump King of Hearts (higher rank)
    expect(move.cardId).toBe('KH');
  });

  it('strictly follows suit and never chooses an off-suit card when holding cards of the led suit', () => {
    const bot = new ThullaBot({ seed: 300 });
    // Bot holds 4S (Spade) and KH, AD, 9C (off-suits). Led suit is Spades.
    const mockState: ThullaGameState = {
      ruleset: DEFAULT_THULLA_RULESET,
      players: [
        { id: 'p0', name: 'P0', isBot: true, hand: [], hasEscaped: false, finishOrder: null },
        {
          id: 'bot',
          name: 'Bot',
          isBot: true,
          hand: [
            { id: '4S', suit: 'S', rank: '4', deckIndex: 0 },
            { id: 'KH', suit: 'H', rank: 'K', deckIndex: 0 },
            { id: 'AD', suit: 'D', rank: 'A', deckIndex: 0 },
            { id: '9C', suit: 'C', rank: '9', deckIndex: 0 },
          ],
          hasEscaped: false,
          finishOrder: null,
        },
      ],
      currentPlayerIndex: 1,
      currentTrick: {
        ledSuit: 'S',
        cards: [
          { playerId: 'p0', playerIndex: 0, card: { id: 'JS', suit: 'S', rank: 'J', deckIndex: 0 }, isThulla: false },
        ],
        highestPlayerIndex: 0,
      },
      discardPile: [],
      lastResolvedTrick: null,
      phase: { type: 'play' },
      escapedPlayerIds: [],
      bhabhiPlayerId: null,
      totalCards: 52,
      trickNumber: 1,
      log: [],
    };

    const legal = [
      { type: 'PLAY_CARD' as const, playerId: 'bot', cardId: '4S' },
    ];

    const move = bot.chooseMove(mockState, legal);
    expect(move.cardId).toBe('4S');
    const playedCard = mockState.players[1]!.hand.find((c) => c.id === move.cardId)!;
    expect(playedCard.suit).toBe('S');
  });
});
