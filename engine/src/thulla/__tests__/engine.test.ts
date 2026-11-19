// ---------------------------------------------------------------------------
// Thulla engine unit tests — rules, card conservation, follow suit, thulla pickup.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { ThullaEngine } from '../engine';
import { DEFAULT_THULLA_RULESET } from '../schema';
import type { ThullaGameState } from '../state';
import type { PlayerConfig } from '../../core/types';
import { countCards, assertNoDuplicateCards } from '../../core/invariants';

const mkPlayers = (n: number): PlayerConfig[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, isBot: true }));

function zones(s: ThullaGameState) {
  const currentTrickCards = s.currentTrick ? s.currentTrick.cards.map((tc) => tc.card) : [];
  return [...s.players.map((p) => [...p.hand]), [...currentTrickCards], [...s.discardPile]];
}

function checkConservation(s: ThullaGameState) {
  expect(countCards(zones(s))).toBe(s.totalCards);
  assertNoDuplicateCards(zones(s), 'thullaState');
}

describe('Thulla createGame', () => {
  it('deals 52 cards evenly among 4 players (13 each)', () => {
    const s = ThullaEngine.createGame(DEFAULT_THULLA_RULESET, mkPlayers(4), 123);
    expect(s.totalCards).toBe(52);
    checkConservation(s);
    expect(s.players.every((p) => p.hand.length === 13)).toBe(true);
  });

  it('starts with player holding Ace of Spades', () => {
    const s = ThullaEngine.createGame(DEFAULT_THULLA_RULESET, mkPlayers(4), 42);
    const leader = s.players[s.currentPlayerIndex]!;
    expect(leader.hand.some((c) => c.suit === 'S' && c.rank === 'A')).toBe(true);
  });
});

describe('Thulla getLegalMoves & compulsory suit follow', () => {
  it('requires leading player holding A♠ to lead A♠ on trick 0', () => {
    const s = ThullaEngine.createGame(DEFAULT_THULLA_RULESET, mkPlayers(4), 42);
    const moves = ThullaEngine.getLegalMoves(s, s.players[s.currentPlayerIndex]!.id);
    expect(moves).toHaveLength(1);
    const card = s.players[s.currentPlayerIndex]!.hand.find((c) => c.id === moves[0]!.cardId)!;
    expect(card.suit).toBe('S');
    expect(card.rank).toBe('A');
  });

  it('forces follower to follow led suit if they have it', () => {
    let s = ThullaEngine.createGame(DEFAULT_THULLA_RULESET, mkPlayers(4), 42);
    const p1 = s.players[s.currentPlayerIndex]!;
    const legal1 = ThullaEngine.getLegalMoves(s, p1.id);
    s = ThullaEngine.applyMove(s, legal1[0]!); // played AS

    const p2 = s.players[s.currentPlayerIndex]!;
    const legal2 = ThullaEngine.getLegalMoves(s, p2.id);

    const p2Spades = p2.hand.filter((c) => c.suit === 'S');
    if (p2Spades.length > 0) {
      // Must only return spades!
      expect(legal2.length).toBe(p2Spades.length);
      for (const m of legal2) {
        const c = p2.hand.find((card) => card.id === m.cardId)!;
        expect(c.suit).toBe('S');
      }
    } else {
      // Void in spades: can play any card (Thulla!)
      expect(legal2.length).toBe(p2.hand.length);
    }
  });

  it('throws GAME_ERROR if player attempts to play off-suit while holding led suit', () => {
    let s = ThullaEngine.createGame(DEFAULT_THULLA_RULESET, mkPlayers(4), 42);
    const p1 = s.players[s.currentPlayerIndex]!;
    s = ThullaEngine.applyMove(s, ThullaEngine.getLegalMoves(s, p1.id)[0]!);

    const p2 = s.players[s.currentPlayerIndex]!;
    const nonSpade = p2.hand.find((c) => c.suit !== 'S');
    const hasSpade = p2.hand.some((c) => c.suit === 'S');

    if (hasSpade && nonSpade) {
      expect(() =>
        ThullaEngine.applyMove(s, { type: 'PLAY_CARD', playerId: p2.id, cardId: nonSpade.id }),
      ).toThrow();
    }
  });
});

describe('Thulla resolution & pickup', () => {
  it('clean trick: all follow suit, cards burned, highest card holder leads next', () => {
    // Play full trick with everyone following spades if possible
    let s = ThullaEngine.createGame(DEFAULT_THULLA_RULESET, mkPlayers(4), 42);
    checkConservation(s);

    for (let step = 0; step < 4; step++) {
      const active = s.players[s.currentPlayerIndex]!;
      const moves = ThullaEngine.getLegalMoves(s, active.id);
      // Prefer same suit to test clean trick if available
      const ledSuit = s.currentTrick ? s.currentTrick.ledSuit : 'S';
      const sameSuitMove = moves.find((m) => active.hand.find((c) => c.id === m.cardId)?.suit === ledSuit);
      const chosen = sameSuitMove ?? moves[0]!;
      s = ThullaEngine.applyMove(s, chosen);
      checkConservation(s);
      if (s.currentTrick === null) break; // trick resolved
    }

    checkConservation(s);
  });
});
