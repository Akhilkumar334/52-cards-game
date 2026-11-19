// ---------------------------------------------------------------------------
// Seep Engine Unit Tests — rules, 100-point accounting, card conservation,
// opening bids, seep permanence, takedowns, compulsory rules, and ruleset options.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { SeepEngine } from '../engine';
import { DEFAULT_SEEP_RULESET, type SeepRuleset } from '../schema';
import type { SeepGameState } from '../state';
import type { Card, PlayerConfig } from '../../core/types';
import { buildDeck } from '../../core/deck';
import { getCardPointValue, createFloor, getSeepForcedMoveReason } from '../helpers';
import type { SeepMove } from '../moves';

const mkPlayers = (count = 4): PlayerConfig[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${i}`,
    isBot: true,
  }));

const mkC = (id: string, rank: Card['rank'], suit: Card['suit'] = 'H'): Card => ({
  id,
  rank,
  suit,
  deckIndex: 0,
});

function totalCardsInSeep(s: SeepGameState): number {
  const handCards = s.players.flatMap((p) => p.hand);
  const loose = s.floor.looseCards;
  const houseCards = s.floor.houses.flatMap((h) => h.cards);
  const capturedCards = s.teams.flatMap((t) => t.capturedCards);
  const undealtDeck = s.undealtDeck ?? [];

  return (
    handCards.length +
    loose.length +
    houseCards.length +
    capturedCards.length +
    undealtDeck.length
  );
}

describe('Seep 100-Point Accounting Invariant', () => {
  it('standard 52 deck has exactly 100 point values', () => {
    const deck = buildDeck(1);
    expect(deck.length).toBe(52);
    const totalPoints = deck.reduce((acc, c) => acc + getCardPointValue(c), 0);
    expect(totalPoints).toBe(100);
  });
});

describe('Seep createGame', () => {
  it('creates 4-player game with 2 partnerships and 52 cards conserved', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 42);
    expect(s.players).toHaveLength(4);
    expect(s.teams).toHaveLength(2);
    expect(s.phase.type).toBe('bidding');
    expect(s.currentPlayerIndex).toBe(0);
    expect(s.players[0]!.hand).toHaveLength(4);
    expect(s.floor.looseCards).toHaveLength(4);
    expect(totalCardsInSeep(s)).toBe(52);
  });

  it('creates 2-player and 3-player individual games with 52 cards conserved', () => {
    const s2 = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(2), 10);
    expect(s2.players).toHaveLength(2);
    expect(s2.teams).toHaveLength(2);
    expect(totalCardsInSeep(s2)).toBe(52);

    const s3 = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(3), 20);
    expect(s3.players).toHaveLength(3);
    expect(s3.teams).toHaveLength(3);
    expect(totalCardsInSeep(s3)).toBe(52);
  });

  it('handles courtCardsOnInitialFloor = redeal without court cards on floor', () => {
    const s = SeepEngine.createGame(
      { ...DEFAULT_SEEP_RULESET, courtCardsOnInitialFloor: 'redeal' },
      mkPlayers(4),
      99,
    );
    const hasCourt = s.floor.looseCards.some((c) => ['J', 'Q', 'K'].includes(c.rank));
    expect(hasCourt).toBe(false);
  });
});

describe('Opening Bid Mechanics', () => {
  it('allows legal DECLARE_BID only for values held in hand', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 100);
    const p0 = s.players[0]!;
    const moves = SeepEngine.getLegalMoves(s, p0.id);

    const declareMoves = moves.filter((m) => m.type === 'DECLARE_BID');
    expect(declareMoves.length).toBeGreaterThan(0);

    for (const dm of declareMoves) {
      if (dm.type === 'DECLARE_BID') {
        const holdsCard = p0.hand.some((c) => {
          const val = c.rank === 'A' ? 1 : c.rank === 'T' ? 10 : c.rank === 'J' ? 11 : c.rank === 'Q' ? 12 : c.rank === 'K' ? 13 : Number(c.rank);
          return val === dm.houseValue;
        });
        expect(holdsCard).toBe(true);
      }
    }
  });

  it('rejects illegal bid declaration if player does not hold the value', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 100);
    const p0 = s.players[0]!;

    // Hand with no King (13)
    const modified: SeepGameState = {
      ...s,
      players: [
        {
          ...p0,
          hand: [
            mkC('c1', '9', 'H'),
            mkC('c2', '8', 'D'),
            mkC('c3', '7', 'C'),
            mkC('c4', '6', 'S'),
          ],
        },
        ...s.players.slice(1),
      ],
    };

    expect(() =>
      SeepEngine.applyMove(modified, {
        type: 'DECLARE_BID',
        playerId: p0.id,
        houseValue: 13,
      }),
    ).toThrow();
  });

  it('enforces openingTrailOnlyIfCannotBuild = true', () => {
    const s = SeepEngine.createGame(
      { ...DEFAULT_SEEP_RULESET, openingTrailOnlyIfCannotBuild: true },
      mkPlayers(4),
      100,
    );
    const p0 = s.players[0]!;

    // Player holds 10 and 2. Floor has 8. Player can build 10 (2 + 8).
    const declaredState: SeepGameState = {
      ...s,
      openingBid: {
        playerId: p0.id,
        playerIndex: 0,
        houseValue: 10,
        isCaptured: false,
        active: true,
      },
      players: [
        {
          ...p0,
          hand: [
            mkC('h-T', 'T', 'H'),
            mkC('h-2', '2', 'D'),
          ],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor([mkC('f-8', '8', 'S')], []),
    };

    const legal = SeepEngine.getLegalMoves(declaredState, p0.id);
    const hasTrail = legal.some((m) => m.type === 'TRAIL');
    // Cannot trail because a BUILD move exists
    expect(hasTrail).toBe(false);
  });
});

describe('Seep Permanence & Additional Seeps Cap', () => {
  it('awards opening seep as permanent and asserts later takedown never removes it', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 100);
    const p0 = s.players[0]!;

    // Set floor to [5, 5] and bidder hand to [10, 2]
    const bidDeclaredState: SeepGameState = {
      ...s,
      openingBid: {
        playerId: p0.id,
        playerIndex: 0,
        houseValue: 10,
        isCaptured: false,
        active: true,
      },
      players: [
        {
          ...p0,
          hand: [
            mkC('h-T', 'T', 'H'),
            mkC('h-2', '2', 'D'),
          ],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor(
        [
          mkC('f-5a', '5', 'S'),
          mkC('f-5b', '5', 'C'),
        ],
        [],
      ),
    };

    // Bidder captures [5, 5] with 10 -> OPENING SEEP
    const captureMove = SeepEngine.getLegalMoves(bidDeclaredState, p0.id).find(
      (m) => m.type === 'CAPTURE',
    )!;
    expect(captureMove).toBeDefined();

    const afterOpeningSeep = SeepEngine.applyMove(bidDeclaredState, captureMove);
    expect(afterOpeningSeep.teams[0]!.permanentSeep).toBe(true);
    expect(afterOpeningSeep.teams[0]!.activeSeeps).toBe(0); // permanent seeps are not active/downable
    expect(afterOpeningSeep.teams[0]!.roundScore).toBe(25);

    // Opponent clears floor later -> asserts permanent seep is NOT cancelled
    const p1 = afterOpeningSeep.players[1]!;

    const oppSeepState: SeepGameState = {
      ...afterOpeningSeep,
      currentPlayerIndex: 1,
      players: [
        afterOpeningSeep.players[0]!,
        {
          ...p1,
          hand: [mkC('p1-T', 'T', 'D')],
        },
        ...afterOpeningSeep.players.slice(2),
      ],
      floor: createFloor([mkC('f-T', 'T', 'S')], []),
    };

    const oppCapture = SeepEngine.getLegalMoves(oppSeepState, p1.id).find(
      (m) => m.type === 'CAPTURE',
    )!;
    const afterOppSeep = SeepEngine.applyMove(oppSeepState, oppCapture);

    // Team 0 still has permanentSeep = true!
    expect(afterOppSeep.teams[0]!.permanentSeep).toBe(true);
    expect(afterOppSeep.teams[0]!.roundScore).toBe(25);
  });

  it('caps additional seeps at maxAdditionalSeeps when thirdSeepDownsBoth is false', () => {
    const ruleset: SeepRuleset = {
      ...DEFAULT_SEEP_RULESET,
      maxAdditionalSeeps: 2,
      thirdSeepDownsBoth: false,
    };
    const s = SeepEngine.createGame(ruleset, mkPlayers(4), 100);

    // Team 0 already has 2 active seeps
    const stateAtCap: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 0,
      teams: [
        {
          ...s.teams[0]!,
          activeSeeps: 2,
          roundScore: 50,
        },
        s.teams[1]!,
      ],
      players: [
        {
          ...s.players[0]!,
          hand: [mkC('c-T', 'T', 'H')],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor([mkC('f-T', 'T', 'S')], []),
    };

    const capMove = SeepEngine.getLegalMoves(stateAtCap, s.players[0]!.id)[0]!;
    const afterSeep = SeepEngine.applyMove(stateAtCap, capMove);

    // activeSeeps remains 2 (capped)
    expect(afterSeep.teams[0]!.activeSeeps).toBe(2);
    expect(afterSeep.teams[0]!.roundScore).toBe(50);
  });

  it('downs both active seeps and deducts bonus when team attempts a 3rd seep with thirdSeepDownsBoth = true', () => {
    const ruleset: SeepRuleset = {
      ...DEFAULT_SEEP_RULESET,
      maxAdditionalSeeps: 2,
      thirdSeepDownsBoth: true,
      laterSeepBonus: 25,
    };
    const s = SeepEngine.createGame(ruleset, mkPlayers(4), 100);

    // Team 0 already has 2 active seeps and 50 roundScore
    const stateAtPenalty: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 0,
      teams: [
        {
          ...s.teams[0]!,
          activeSeeps: 2,
          downedSeeps: 0,
          seepCount: 2,
          roundScore: 50,
        },
        s.teams[1]!,
      ],
      players: [
        {
          ...s.players[0]!,
          hand: [mkC('c-T', 'T', 'H')],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor([mkC('f-T', 'T', 'S')], []),
    };

    const clearMove = SeepEngine.getLegalMoves(stateAtPenalty, s.players[0]!.id)[0]!;
    const afterPenalty = SeepEngine.applyMove(stateAtPenalty, clearMove);

    // Both active seeps downed, activeSeeps reset to 0, 50 pts deducted
    expect(afterPenalty.teams[0]!.activeSeeps).toBe(0);
    expect(afterPenalty.teams[0]!.downedSeeps).toBe(2);
    expect(afterPenalty.teams[0]!.seepCount).toBe(0);
    expect(afterPenalty.teams[0]!.roundScore).toBe(0);
    expect(afterPenalty.lastActionAnnouncement).toContain('3RD SEEP PENALTY');
  });
});

describe('Takedown Mechanics', () => {
  it('cancels active seep when opponent clears the floor', () => {
    const s = SeepEngine.createGame(
      { ...DEFAULT_SEEP_RULESET, takedownEnabled: true, takedownAwardsBonus: false },
      mkPlayers(4),
      100,
    );

    // Team 0 has 1 active seep (25 pts)
    const stateWithActiveSeep: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 1, // Player 1 (Team 1) turn
      teams: [
        { ...s.teams[0]!, activeSeeps: 1, roundScore: 25 },
        { ...s.teams[1]!, activeSeeps: 0, roundScore: 0 },
      ],
      players: [
        s.players[0]!,
        {
          ...s.players[1]!,
          hand: [mkC('p1-T', 'T', 'H')],
        },
        ...s.players.slice(2),
      ],
      floor: createFloor([mkC('f-T', 'T', 'S')], []),
    };

    const p1Move = SeepEngine.getLegalMoves(stateWithActiveSeep, s.players[1]!.id)[0]!;
    const afterTakedown = SeepEngine.applyMove(stateWithActiveSeep, p1Move);

    // Team 0's active seep cancelled: activeSeeps = 0, downedSeeps = 1, roundScore = 0
    expect(afterTakedown.teams[0]!.activeSeeps).toBe(0);
    expect(afterTakedown.teams[0]!.downedSeeps).toBe(1);
    expect(afterTakedown.teams[0]!.roundScore).toBe(0);

    // In Seep: Team 1 downed the seep, cancelling it — Team 1 does NOT receive a seep
    expect(afterTakedown.teams[1]!.activeSeeps).toBe(0);
    expect(afterTakedown.teams[1]!.roundScore).toBe(0);
  });

  it('awards bonus to downing team when takedownAwardsBonus = true', () => {
    const s = SeepEngine.createGame(
      { ...DEFAULT_SEEP_RULESET, takedownEnabled: true, takedownAwardsBonus: true },
      mkPlayers(4),
      100,
    );

    const stateWithActiveSeep: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 1,
      teams: [
        { ...s.teams[0]!, activeSeeps: 1, roundScore: 25 },
        { ...s.teams[1]!, activeSeeps: 0, roundScore: 0 },
      ],
      players: [
        s.players[0]!,
        {
          ...s.players[1]!,
          hand: [mkC('p1-T', 'T', 'H')],
        },
        ...s.players.slice(2),
      ],
      floor: createFloor([mkC('f-T', 'T', 'S')], []),
    };

    const p1Move = SeepEngine.getLegalMoves(stateWithActiveSeep, s.players[1]!.id)[0]!;
    const afterTakedown = SeepEngine.applyMove(stateWithActiveSeep, p1Move);

    // Team 1 receives takedown bonus (+25) only, no seep awarded
    expect(afterTakedown.teams[1]!.roundScore).toBe(25);
    expect(afterTakedown.teams[1]!.activeSeeps).toBe(0);
  });
});

describe('Compulsory Rules & Conflict Resolution', () => {
  it('restricts getLegalMoves to only floor-clearing moves when firstSeepCompulsory = true', () => {
    const s = SeepEngine.createGame(
      { ...DEFAULT_SEEP_RULESET, firstSeepCompulsory: true },
      mkPlayers(4),
      100,
    );

    const seepOpportunityState: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      firstSeepOccurred: false,
      currentPlayerIndex: 1,
      players: [
        s.players[0]!,
        {
          ...s.players[1]!,
          hand: [
            mkC('c-T', 'T', 'H'), // Can capture 10 and clear floor
            mkC('c-2', '2', 'D'), // Low card
          ],
        },
        ...s.players.slice(2),
      ],
      floor: createFloor([mkC('f-T', 'T', 'S')], []),
    };

    const moves = SeepEngine.getLegalMoves(seepOpportunityState, s.players[1]!.id);
    expect(moves.every((m) => m.type === 'CAPTURE')).toBe(true);
    expect(moves.some((m) => m.type === 'TRAIL')).toBe(false);
  });

  it('prefers takedown over first seep when both conditions conflict', () => {
    const s = SeepEngine.createGame(
      { ...DEFAULT_SEEP_RULESET, firstSeepCompulsory: true, takedownCompulsory: true },
      mkPlayers(4),
      100,
    );

    const conflictState: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      firstSeepOccurred: false,
      currentPlayerIndex: 1,
      teams: [
        { ...s.teams[0]!, activeSeeps: 1, roundScore: 25 },
        s.teams[1]!,
      ],
      players: [
        s.players[0]!,
        {
          ...s.players[1]!,
          hand: [mkC('c-T', 'T', 'H')],
        },
        ...s.players.slice(2),
      ],
      floor: createFloor([mkC('f-T', 'T', 'S')], []),
    };

    const moves = SeepEngine.getLegalMoves(conflictState, s.players[1]!.id);
    // Floor-clearing takedown move is returned
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.type === 'CAPTURE')).toBe(true);
  });
});

describe('Ruleset Options in Both States', () => {
  it('trailAlwaysAllowed: true allows trailing even when capture exists', () => {
    const s = SeepEngine.createGame(
      { ...DEFAULT_SEEP_RULESET, trailAlwaysAllowed: true },
      mkPlayers(4),
      100,
    );

    const captureAvailableState: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 1,
      firstSeepOccurred: true,
      players: [
        s.players[0]!,
        {
          ...s.players[1]!,
          hand: [mkC('c-T', 'T', 'H')],
        },
        ...s.players.slice(2),
      ],
      floor: createFloor(
        [
          mkC('f-T', 'T', 'S'),
          mkC('f-5', '5', 'C'),
        ],
        [],
      ),
    };

    const moves = SeepEngine.getLegalMoves(captureAvailableState, s.players[1]!.id);
    expect(moves.some((m) => m.type === 'TRAIL')).toBe(true);
    expect(moves.some((m) => m.type === 'CAPTURE')).toBe(true);
  });

  it('trailAlwaysAllowed: false disallows trailing when capture exists', () => {
    const s = SeepEngine.createGame(
      { ...DEFAULT_SEEP_RULESET, trailAlwaysAllowed: false },
      mkPlayers(4),
      100,
    );

    const captureAvailableState: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 1,
      firstSeepOccurred: true,
      players: [
        s.players[0]!,
        {
          ...s.players[1]!,
          hand: [mkC('c-T', 'T', 'H')],
        },
        ...s.players.slice(2),
      ],
      floor: createFloor(
        [
          mkC('f-T', 'T', 'S'),
          mkC('f-5', '5', 'C'),
        ],
        [],
      ),
    };

    const moves = SeepEngine.getLegalMoves(captureAvailableState, s.players[1]!.id);
    expect(moves.some((m) => m.type === 'TRAIL')).toBe(false);
    expect(moves.every((m) => m.type === 'CAPTURE')).toBe(true);
  });

  it('allowBuildOnOpponentHouse: true allows extending opponent house', () => {
    const s = SeepEngine.createGame(
      { ...DEFAULT_SEEP_RULESET, allowBuildOnOpponentHouse: true },
      mkPlayers(4),
      100,
    );

    // Opponent (Team 1) owns house of 9. Player 0 (Team 0) holds 2 and Jack (11).
    const stateWithOppHouse: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 0,
      firstSeepOccurred: true,
      players: [
        {
          ...s.players[0]!,
          hand: [
            mkC('c-2', '2', 'H'),
            mkC('c-J', 'J', 'D'), // Holds Jack (11) to capture later
          ],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor(
        [],
        [
          {
            id: 'h-9',
            buildValue: 9,
            ownerPlayerIndex: 1,
            ownerTeamIndex: 1,
            isCemented: false,
            cards: [mkC('c-9', '9', 'S')],
          },
        ],
      ),
    };

    const moves = SeepEngine.getLegalMoves(stateWithOppHouse, s.players[0]!.id);
    const extendMove = moves.find(
      (m) => m.type === 'BUILD' && 'extendHouseId' in m && m.extendHouseId === 'h-9',
    );
    expect(extendMove).toBeDefined();
  });

  it('strictly enforces at most 2 houses can be built at once on the table', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 42);
    // Floor already has 2 houses: House 9 and House 10
    const stateWith2Houses: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 0,
      players: [
        {
          ...s.players[0]!,
          // Player holds 3 and Jack (11) and loose cards on floor could sum to 8 (so 3 + 8 = 11)
          hand: [mkC('p0-3', '3', 'H'), mkC('p0-J', 'J', 'D')],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor(
        [mkC('fl-8', '8', 'S')],
        [
          {
            id: 'h-9',
            buildValue: 9,
            ownerPlayerIndex: 1,
            ownerTeamIndex: 1,
            isCemented: true,
            cards: [mkC('c-9', '9', 'C')],
          },
          {
            id: 'h-10',
            buildValue: 10,
            ownerPlayerIndex: 2,
            ownerTeamIndex: 0,
            isCemented: true,
            cards: [mkC('c-10', 'T', 'C')],
          },
        ],
      ),
    };

    // Legal moves should NOT propose creating a 3rd house (House 11)
    const moves = SeepEngine.getLegalMoves(stateWith2Houses, s.players[0]!.id);
    const newBuildMoves = moves.filter(
      (m) => m.type === 'BUILD' && (!('extendHouseId' in m) || !m.extendHouseId),
    );
    expect(newBuildMoves).toHaveLength(0);

    // Calling applyMove with a 3rd house must throw GameError
    expect(() =>
      SeepEngine.applyMove(stateWith2Houses, {
        type: 'BUILD',
        playerId: s.players[0]!.id,
        handCardId: 'p0-3',
        targetValue: 11,
        floorItemIds: ['fl-8'],
      }),
    ).toThrow(/At most 2 houses can be built at once/);
  });

  it('rejects building a duplicate house of the same value', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 42);
    // Floor has 1 house of value 9
    const stateWith1House: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 0,
      players: [
        {
          ...s.players[0]!,
          hand: [mkC('p0-4', '4', 'H'), mkC('p0-9', '9', 'D')],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor(
        [mkC('fl-5', '5', 'S')],
        [
          {
            id: 'h-9',
            buildValue: 9,
            ownerPlayerIndex: 1,
            ownerTeamIndex: 1,
            isCemented: false,
            cards: [mkC('c-9', '9', 'C')],
          },
        ],
      ),
    };

    // Legal moves should not allow building another House 9
    const moves = SeepEngine.getLegalMoves(stateWith1House, s.players[0]!.id);
    const build9Moves = moves.filter(
      (m) => m.type === 'BUILD' && m.targetValue === 9 && (!('extendHouseId' in m) || !m.extendHouseId),
    );
    expect(build9Moves).toHaveLength(0);

    // Calling applyMove to build duplicate House 9 must throw GameError
    expect(() =>
      SeepEngine.applyMove(stateWith1House, {
        type: 'BUILD',
        playerId: s.players[0]!.id,
        handCardId: 'p0-4',
        targetValue: 9,
        floorItemIds: ['fl-5'],
      }),
    ).toThrow(/already exists on the table/);
  });
});

describe('Compulsory First Seep Specification & Modes', () => {
  it('repro state: floor has House 13, House 11, and loose 5; player holds King (13), 6, 8 — no restriction, no banner', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 10);
    const p0 = s.players[0]!;

    const state: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 0,
      firstSeepOccurred: false,
      players: [
        {
          ...p0,
          hand: [
            mkC('p0-6', '6', 'H'),
            mkC('p0-8', '8', 'H'),
            mkC('p0-K', 'K', 'S'), // King (13)
          ],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor(
        [mkC('fl-5', '5', 'C')],
        [
          {
            id: 'house-13',
            buildValue: 13,
            ownerPlayerIndex: 0,
            ownerTeamIndex: 0,
            isCemented: true,
            cards: [mkC('h13-3', '3', 'C'), mkC('h13-4', '4', 'C'), mkC('h13-6', '6', 'D')],
          },
          {
            id: 'house-11',
            buildValue: 11,
            ownerPlayerIndex: 2,
            ownerTeamIndex: 0,
            isCemented: true,
            cards: [mkC('h11-3', '3', 'D'), mkC('h11-8', '8', 'C')],
          },
        ],
      ),
    };

    // No card can clear this floor (House 13 + House 11 + 5C), so no seep is possible
    const forcedReason = getSeepForcedMoveReason(state, p0.id);
    expect(forcedReason).toBeNull();

    const moves = SeepEngine.getLegalMoves(state, p0.id);
    // King captures House 13 (partial capture), but it is NOT forced by compulsory first seep
    expect(moves.length).toBeGreaterThan(0);
    const kingCapture = moves.find((m) => m.type === 'CAPTURE' && m.handCardId === 'p0-K');
    expect(kingCapture).toBeDefined();
    // Verify itemIds does NOT clear the floor (captures only 1 of 3 floor items)
    expect(kingCapture?.type === 'CAPTURE' && kingCapture.itemIds).toEqual(['house-13']);
  });

  it('floor = one house of 12, player holds a 12: only the seep capture is legal', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 10);
    const p0 = s.players[0]!;

    const state: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 0,
      firstSeepOccurred: false,
      players: [
        {
          ...p0,
          hand: [
            mkC('p0-Q', 'Q', 'S'), // Queen (12)
            mkC('p0-4', '4', 'D'),
          ],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor(
        [],
        [
          {
            id: 'house-12',
            buildValue: 12,
            ownerPlayerIndex: 1,
            ownerTeamIndex: 1,
            isCemented: true,
            cards: [mkC('h12-Q', 'Q', 'H')],
          },
        ],
      ),
    };

    const forcedReason = getSeepForcedMoveReason(state, p0.id);
    expect(forcedReason).toMatch(/Compulsory First Seep/);

    const moves = SeepEngine.getLegalMoves(state, p0.id);
    expect(moves).toHaveLength(1);
    expect(moves[0]!.type).toBe('CAPTURE');
    if (moves[0]!.type === 'CAPTURE') {
      expect(moves[0]!.handCardId).toBe('p0-Q');
      expect(moves[0]!.itemIds).toEqual(['house-12']);
    }
  });

  it('floor = one loose 5, player holds a 5: only the seep capture is legal', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 10);
    const p0 = s.players[0]!;

    const state: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 0,
      firstSeepOccurred: false,
      players: [
        {
          ...p0,
          hand: [
            mkC('p0-5', '5', 'H'), // 5
            mkC('p0-7', '7', 'D'), // 7
          ],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor([mkC('fl-5', '5', 'C')], []),
    };

    const forcedReason = getSeepForcedMoveReason(state, p0.id);
    expect(forcedReason).toMatch(/Compulsory First Seep/);

    const moves = SeepEngine.getLegalMoves(state, p0.id);
    expect(moves).toHaveLength(1);
    expect(moves[0]!.type).toBe('CAPTURE');
    if (moves[0]!.type === 'CAPTURE') {
      expect(moves[0]!.handCardId).toBe('p0-5');
      expect(moves[0]!.itemIds).toEqual(['fl-5']);
    }
  });

  it('floor = loose 5 and loose 2+3, player holds a 5: forced in anyFullClear mode, not forced in singleItemOnly mode', () => {
    const s = SeepEngine.createGame(
      { ...DEFAULT_SEEP_RULESET, firstSeepCompulsoryMode: 'anyFullClear' },
      mkPlayers(4),
      10,
    );
    const p0 = s.players[0]!;

    const baseState: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 0,
      firstSeepOccurred: false,
      players: [
        {
          ...p0,
          hand: [
            mkC('p0-5', '5', 'H'), // 5
            mkC('p0-7', '7', 'D'), // 7
          ],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor(
        [mkC('fl-5', '5', 'C'), mkC('fl-2', '2', 'D'), mkC('fl-3', '3', 'S')],
        [],
      ),
    };

    // Mode: anyFullClear (default) -> All 3 items partition into 5 ([5], [2+3]). Seep is possible and forced.
    const reasonAny = getSeepForcedMoveReason(baseState, p0.id);
    expect(reasonAny).toMatch(/Compulsory First Seep/);
    const movesAny = SeepEngine.getLegalMoves(baseState, p0.id);
    expect(movesAny).toHaveLength(1);
    expect(movesAny[0]!.type).toBe('CAPTURE');
    if (movesAny[0]!.type === 'CAPTURE') {
      expect(movesAny[0]!.handCardId).toBe('p0-5');
      expect(movesAny[0]!.itemIds).toEqual(['fl-5', 'fl-2', 'fl-3']);
    }

    // Mode: singleItemOnly -> Floor has 3 items !== 1 item. Not forced!
    const stateSingle: SeepGameState = {
      ...baseState,
      ruleset: {
        ...baseState.ruleset,
        firstSeepCompulsoryMode: 'singleItemOnly',
      },
    };
    const reasonSingle = getSeepForcedMoveReason(stateSingle, p0.id);
    expect(reasonSingle).toBeNull();
    const movesSingle = SeepEngine.getLegalMoves(stateSingle, p0.id);
    // Move is not restricted to compulsory first seep
    expect(movesSingle.length).toBeGreaterThan(0);
  });

  it('floor = loose 5 and a house of 11, player holds a 5 and an 11: not forced', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 10);
    const p0 = s.players[0]!;

    const state: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 0,
      firstSeepOccurred: false,
      players: [
        {
          ...p0,
          hand: [
            mkC('p0-5', '5', 'H'), // 5
            mkC('p0-J', 'J', 'S'), // Jack (11)
          ],
        },
        ...s.players.slice(1),
      ],
      floor: createFloor(
        [mkC('fl-5', '5', 'C')],
        [
          {
            id: 'house-11',
            buildValue: 11,
            ownerPlayerIndex: 1,
            ownerTeamIndex: 1,
            isCemented: true,
            cards: [mkC('h11-J', 'J', 'D')],
          },
        ],
      ),
    };

    // Neither 5 nor 11 can partition {5, 11} into subsets where all items are captured.
    // So no seep is possible, and the compulsory first seep rule does not fire.
    const forcedReason = getSeepForcedMoveReason(state, p0.id);
    expect(forcedReason).toBeNull();

    const moves = SeepEngine.getLegalMoves(state, p0.id);
    // Player can capture 5 with 5, or capture 11 with 11, without being forced by compulsory first seep
    expect(moves.length).toBeGreaterThan(0);
    const cap5 = moves.find((m) => m.type === 'CAPTURE' && m.handCardId === 'p0-5');
    const cap11 = moves.find((m) => m.type === 'CAPTURE' && m.handCardId === 'p0-J');
    expect(cap5).toBeDefined();
    expect(cap11).toBeDefined();
  });

  it('deals all remaining cards immediately after the first move (after_first_move mode)', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 42);
    // Initially each player has 4 cards, undealt deck has 32 cards
    expect(s.players[0]!.hand).toHaveLength(4);
    expect(s.players[1]!.hand).toHaveLength(4);
    expect(s.undealtDeck).toHaveLength(32);

    const p0 = s.players[0]!;
    // 1. Declare bid
    const bidMove = SeepEngine.getLegalMoves(s, p0.id).find((m) => m.type === 'DECLARE_BID')!;
    expect(bidMove).toBeDefined();
    const afterBid = SeepEngine.applyMove(s, bidMove);

    // 2. Make opening move (e.g. TRAIL or CAPTURE or BUILD)
    const openingMoves = SeepEngine.getLegalMoves(afterBid, p0.id);
    expect(openingMoves.length).toBeGreaterThan(0);
    const openingMove = openingMoves[0]!;
    const afterOpeningPlay = SeepEngine.applyMove(afterBid, openingMove);

    // After the first move, all 32 remaining cards are dealt (8 cards to each player)
    // Player 0 played 1 card, so holds 3 + 8 = 11 cards
    // Players 1, 2, 3 hold 4 + 8 = 12 cards each
    expect(afterOpeningPlay.players[0]!.hand).toHaveLength(11);
    expect(afterOpeningPlay.players[1]!.hand).toHaveLength(12);
    expect(afterOpeningPlay.players[2]!.hand).toHaveLength(12);
    expect(afterOpeningPlay.players[3]!.hand).toHaveLength(12);
    expect(afterOpeningPlay.undealtDeck).toHaveLength(0);
  });

  it('prohibits contributing to an opponent or own house without holding the matching card', () => {
    const s = SeepEngine.createGame(
      { ...DEFAULT_SEEP_RULESET, cementedHouses: true },
      mkPlayers(4),
      123,
    );

    const house9 = {
      id: 'house-9',
      buildValue: 9,
      ownerPlayerIndex: 1,
      ownerTeamIndex: 1,
      isCemented: false,
      cards: [mkC('h-5', '5', 'C'), mkC('h-4', '4', 'C')],
    };

    const state: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      currentPlayerIndex: 0,
      players: [
        { ...s.players[0]!, hand: [mkC('p0-3', '3', 'H'), mkC('p0-4', '4', 'D')] },
        { ...s.players[1]!, hand: [mkC('p1-9', '9', 'S')] },
        s.players[2]!,
        s.players[3]!,
      ],
      floor: {
        items: [
          { type: 'house', id: 'house-9', house: house9 },
          { type: 'loose', id: 'f-6', card: mkC('f-6', '6', 'C') },
        ],
        looseCards: [mkC('f-6', '6', 'C')],
        houses: [house9],
      },
    };

    // South holds 3H and 4D (no 9!). On floor: House 9 and loose 6C.
    // 3H + 6C = 9, but South holds NO 9 in hand!
    const legalMoves = SeepEngine.getLegalMoves(state, s.players[0]!.id);
    const cementMoves = legalMoves.filter((m) => m.type === 'CEMENT_HOUSE');
    expect(cementMoves).toHaveLength(0); // Cannot contribute without holding a 9!

    // If South has a 9 in hand, contributing 3H + 6C to House 9 becomes legal
    const stateWithNine = {
      ...state,
      players: [
        { ...state.players[0]!, hand: [...state.players[0]!.hand, mkC('p0-9', '9', 'D')] },
        ...state.players.slice(1),
      ],
    };
    const legalMovesWithNine = SeepEngine.getLegalMoves(stateWithNine, s.players[0]!.id);
    const cementWithNine = legalMovesWithNine.filter((m) => m.type === 'CEMENT_HOUSE');
    expect(cementWithNine.length).toBeGreaterThan(0);
  });

  it('allows building cemented house of 13 when player holds multiple Kings and loose King or 9+4 is on floor', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 456);
    const state: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      firstSeepOccurred: true,
      currentPlayerIndex: 0,
      players: [
        {
          ...s.players[0]!,
          hand: [mkC('ks', 'K', 'S'), mkC('kc', 'K', 'C'), mkC('c-2', '2', 'C')],
        },
        ...s.players.slice(1),
      ],
      floor: {
        items: [
          { type: 'loose', id: 'kd', card: mkC('kd', 'K', 'D') },
          { type: 'loose', id: 'c-9', card: mkC('c-9', '9', 'D') },
          { type: 'loose', id: 'c-4', card: mkC('c-4', '4', 'D') },
        ],
        looseCards: [
          mkC('kd', 'K', 'D'),
          mkC('c-9', '9', 'D'),
          mkC('c-4', '4', 'D'),
        ],
        houses: [],
      },
    };

    const legalMoves = SeepEngine.getLegalMoves(state, s.players[0]!.id);
    const buildMoves13 = legalMoves.filter(
      (m): m is Extract<SeepMove, { type: 'BUILD' }> =>
        m.type === 'BUILD' && m.targetValue === 13 && m.handCardId === 'ks',
    );

    // 1. Can build House of 13 using King on King (kd)
    const buildWithKd = buildMoves13.find(
      (m) => m.floorItemIds.length === 1 && m.floorItemIds.includes('kd'),
    );
    expect(buildWithKd).toBeDefined();

    // 2. Can build House of 13 using King on 9+4
    const buildWith94 = buildMoves13.find(
      (m) =>
        m.floorItemIds.length === 2 &&
        m.floorItemIds.includes('c-9') &&
        m.floorItemIds.includes('c-4'),
    );
    expect(buildWith94).toBeDefined();

    // 3. Applying buildWithKd creates a cemented house of 13
    const nextState = SeepEngine.applyMove(state, buildWithKd!);
    expect(nextState.floor.houses).toHaveLength(1);
    expect(nextState.floor.houses[0]!.buildValue).toBe(13);
    expect(nextState.floor.houses[0]!.isCemented).toBe(true);
    expect(nextState.floor.houses[0]!.cards.map((c) => c.id)).toEqual(
      expect.arrayContaining(['ks', 'kd']),
    );
  });

  it('allows player to optionally collect loose ground cards when cementing a house', () => {
    const s = SeepEngine.createGame(DEFAULT_SEEP_RULESET, mkPlayers(4), 789);
    const house13 = {
      id: 'house-13',
      buildValue: 13,
      ownerPlayerIndex: 0,
      ownerTeamIndex: 0,
      isCemented: true,
      cards: [mkC('kh', 'K', 'H'), mkC('kd', 'K', 'D')],
    };

    const state: SeepGameState = {
      ...s,
      phase: { type: 'playing' },
      firstSeepOccurred: true,
      currentPlayerIndex: 0,
      players: [
        {
          ...s.players[0]!,
          // Holds two Kings: KS to contribute, KC to retain
          hand: [mkC('ks', 'K', 'S'), mkC('kc', 'K', 'C')],
        },
        ...s.players.slice(1),
      ],
      floor: {
        items: [
          { type: 'house', id: 'house-13', house: house13 },
          { type: 'loose', id: 'c-9', card: mkC('c-9', '9', 'D') },
          { type: 'loose', id: 'c-4', card: mkC('c-4', '4', 'D') },
        ],
        looseCards: [mkC('c-9', '9', 'D'), mkC('c-4', '4', 'D')],
        houses: [house13],
      },
    };

    const legalMoves = SeepEngine.getLegalMoves(state, s.players[0]!.id);
    const cementMoves = legalMoves.filter(
      (m): m is Extract<SeepMove, { type: 'CEMENT_HOUSE' }> =>
        m.type === 'CEMENT_HOUSE' && m.houseId === 'house-13' && m.handCardId === 'ks',
    );

    // Option A: Cement just with hand card KS (additionalFloorCardIds is empty)
    const cementSolo = cementMoves.find((m) => m.additionalFloorCardIds.length === 0);
    expect(cementSolo).toBeDefined();

    // Option B: Cement with hand card KS AND collect 9+4 from ground into House 13
    const cementWithGroundCards = cementMoves.find(
      (m) =>
        m.additionalFloorCardIds.length === 2 &&
        m.additionalFloorCardIds.includes('c-9') &&
        m.additionalFloorCardIds.includes('c-4'),
    );
    expect(cementWithGroundCards).toBeDefined();

    // Executing cement with ground cards puts both KS and {9, 4} into House 13
    const nextState = SeepEngine.applyMove(state, cementWithGroundCards!);
    const updatedHouse = nextState.floor.houses[0]!;
    expect(updatedHouse.cards.map((c) => c.id)).toEqual(
      expect.arrayContaining(['ks', 'c-9', 'c-4']),
    );
    expect(nextState.floor.looseCards).toHaveLength(0);
  });
});


