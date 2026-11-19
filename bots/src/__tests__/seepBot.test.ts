// ---------------------------------------------------------------------------
// SeepBot Unit Tests — verifying heuristic decision making (Seep priority, point capture)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { SeepBot } from '../seep/seepBot';
import { DEFAULT_SEEP_RULESET, SeepEngine, type SeepGameState, type SeepMove } from '@cards/engine';

const mkPlayers = () => [
  { id: 'p0', name: 'South', isBot: true },
  { id: 'p1', name: 'East', isBot: true },
  { id: 'p2', name: 'North', isBot: true },
  { id: 'p3', name: 'West', isBot: true },
];

describe('SeepBot heuristics', () => {
  it('instantiates and selects a legal move in initial bidding phase', () => {
    const bot = new SeepBot();
    const state = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(), 42);
    const legalMoves = SeepEngine.getLegalMoves(state, 'p0');

    expect(legalMoves.length).toBeGreaterThan(0);
    const chosen = bot.chooseMove(state, legalMoves);
    expect(['DECLARE_BID', 'BID']).toContain(chosen.type);
  });

  it('prioritizes capturing high-point card over throwing', () => {
    const bot = new SeepBot();
    const mockState: SeepGameState = {
      ruleset: DEFAULT_SEEP_RULESET,
      players: [
        {
          id: 'p0',
          name: 'South',
          isBot: true,
          teamIndex: 0,
          hand: [
            { id: 'c-9S', suit: 'S', rank: '9', deckIndex: 0 },
            { id: 'c-2H', suit: 'H', rank: '2', deckIndex: 0 },
          ],
        },
        { id: 'p1', name: 'East', isBot: true, teamIndex: 1, hand: [] },
        { id: 'p2', name: 'North', isBot: true, teamIndex: 0, hand: [] },
        { id: 'p3', name: 'West', isBot: true, teamIndex: 1, hand: [] },
      ],
      teams: [
        {
          teamIndex: 0,
          name: 'Team 0',
          playerIndices: [0, 2],
          capturedCards: [],
          permanentSeep: false,
          activeSeeps: 0,
          downedSeeps: 0,
          seepCount: 0,
          roundScore: 0,
          totalScore: 0,
        },
        {
          teamIndex: 1,
          name: 'Team 1',
          playerIndices: [1, 3],
          capturedCards: [],
          permanentSeep: false,
          activeSeeps: 0,
          downedSeeps: 0,
          seepCount: 0,
          roundScore: 0,
          totalScore: 0,
        },
      ],
      currentPlayerIndex: 0,
      bidderIndex: 0,
      floor: {
        items: [{ type: 'loose', id: 'c-9H', card: { id: 'c-9H', suit: 'H', rank: '9', deckIndex: 0 } }],
        looseCards: [{ id: 'c-9H', suit: 'H', rank: '9', deckIndex: 0 }],
        houses: [],
      },
      phase: { type: 'playing' },
      openingBid: null,
      firstSeepOccurred: false,
      forcedReason: null,
      lastCapturePlayerIndex: null,
      lastActionAnnouncement: null,
      roundNumber: 1,
      turnNumber: 5,
      log: [],
    };

    const legal: SeepMove[] = [
      {
        type: 'CAPTURE',
        playerId: 'p0',
        handCardId: 'c-9S',
        itemIds: ['c-9H'],
        capturedLooseCardIds: ['c-9H'],
        capturedHouseIds: [],
      },
      { type: 'THROW', playerId: 'p0', cardId: 'c-2H' },
    ];

    const chosen = bot.chooseMove(mockState, legal);
    expect(chosen.type).toBe('CAPTURE');
  });

  it('resists taking a 3rd seep when holding 2 active seeps to avoid downing both seeps', () => {
    const bot = new SeepBot();
    const mockState: SeepGameState = {
      ruleset: { ...DEFAULT_SEEP_RULESET, thirdSeepDownsBoth: true },
      players: [
        {
          id: 'p0',
          name: 'South',
          isBot: true,
          teamIndex: 0,
          hand: [
            { id: 'c-9S', suit: 'S', rank: '9', deckIndex: 0 },
            { id: 'c-2H', suit: 'H', rank: '2', deckIndex: 0 },
          ],
        },
        { id: 'p1', name: 'East', isBot: true, teamIndex: 1, hand: [] },
        { id: 'p2', name: 'North', isBot: true, teamIndex: 0, hand: [] },
        { id: 'p3', name: 'West', isBot: true, teamIndex: 1, hand: [] },
      ],
      teams: [
        {
          teamIndex: 0,
          name: 'Team 0',
          playerIndices: [0, 2],
          capturedCards: [],
          permanentSeep: false,
          activeSeeps: 2, // Already has 2 active seeps!
          downedSeeps: 0,
          seepCount: 2,
          roundScore: 50,
          totalScore: 50,
        },
        {
          teamIndex: 1,
          name: 'Team 1',
          playerIndices: [1, 3],
          capturedCards: [],
          permanentSeep: false,
          activeSeeps: 0, // Opponent has no active seep
          downedSeeps: 0,
          seepCount: 0,
          roundScore: 0,
          totalScore: 0,
        },
      ],
      currentPlayerIndex: 0,
      bidderIndex: 0,
      floor: {
        items: [{ type: 'loose', id: 'c-9H', card: { id: 'c-9H', suit: 'H', rank: '9', deckIndex: 0 } }],
        looseCards: [{ id: 'c-9H', suit: 'H', rank: '9', deckIndex: 0 }],
        houses: [],
      },
      phase: { type: 'playing' },
      openingBid: null,
      firstSeepOccurred: true,
      forcedReason: null,
      lastCapturePlayerIndex: 0,
      lastActionAnnouncement: null,
      roundNumber: 1,
      turnNumber: 8,
      log: [],
    };

    const legal: SeepMove[] = [
      {
        type: 'CAPTURE', // This would clear the floor and trigger the 3rd seep penalty!
        playerId: 'p0',
        handCardId: 'c-9S',
        itemIds: ['c-9H'],
        capturedLooseCardIds: ['c-9H'],
        capturedHouseIds: [],
      },
      { type: 'THROW', playerId: 'p0', cardId: 'c-2H' }, // Safe alternative
    ];

    const chosen = bot.chooseMove(mockState, legal);
    // Must resist clearing the floor to protect the 2 active seeps!
    expect(chosen.type).toBe('THROW');
  });

  it('allows floor clearing if opponent has an active seep to down even if own team has 2 active seeps', () => {
    const bot = new SeepBot();
    const mockState: SeepGameState = {
      ruleset: { ...DEFAULT_SEEP_RULESET, thirdSeepDownsBoth: true },
      players: [
        {
          id: 'p0',
          name: 'South',
          isBot: true,
          teamIndex: 0,
          hand: [
            { id: 'c-9S', suit: 'S', rank: '9', deckIndex: 0 },
            { id: 'c-2H', suit: 'H', rank: '2', deckIndex: 0 },
          ],
        },
        { id: 'p1', name: 'East', isBot: true, teamIndex: 1, hand: [] },
        { id: 'p2', name: 'North', isBot: true, teamIndex: 0, hand: [] },
        { id: 'p3', name: 'West', isBot: true, teamIndex: 1, hand: [] },
      ],
      teams: [
        {
          teamIndex: 0,
          name: 'Team 0',
          playerIndices: [0, 2],
          capturedCards: [],
          permanentSeep: false,
          activeSeeps: 2,
          downedSeeps: 0,
          seepCount: 2,
          roundScore: 50,
          totalScore: 50,
        },
        {
          teamIndex: 1,
          name: 'Team 1',
          playerIndices: [1, 3],
          capturedCards: [],
          permanentSeep: false,
          activeSeeps: 1, // Opponent has an active seep! Downing it takes precedence.
          downedSeeps: 0,
          seepCount: 1,
          roundScore: 25,
          totalScore: 25,
        },
      ],
      currentPlayerIndex: 0,
      bidderIndex: 0,
      floor: {
        items: [{ type: 'loose', id: 'c-9H', card: { id: 'c-9H', suit: 'H', rank: '9', deckIndex: 0 } }],
        looseCards: [{ id: 'c-9H', suit: 'H', rank: '9', deckIndex: 0 }],
        houses: [],
      },
      phase: { type: 'playing' },
      openingBid: null,
      firstSeepOccurred: true,
      forcedReason: null,
      lastCapturePlayerIndex: 1,
      lastActionAnnouncement: null,
      roundNumber: 1,
      turnNumber: 9,
      log: [],
    };

    const legal: SeepMove[] = [
      {
        type: 'CAPTURE',
        playerId: 'p0',
        handCardId: 'c-9S',
        itemIds: ['c-9H'],
        capturedLooseCardIds: ['c-9H'],
        capturedHouseIds: [],
      },
      { type: 'THROW', playerId: 'p0', cardId: 'c-2H' },
    ];

    const chosen = bot.chooseMove(mockState, legal);
    // Takedown is allowed and favored!
    expect(chosen.type).toBe('CAPTURE');
  });
});

