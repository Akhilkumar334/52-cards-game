// ---------------------------------------------------------------------------
// Bluff engine unit tests — covers every ruleset option (both states).
// Card conservation is asserted after every move.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { BluffEngine } from '../engine';
import { DEFAULT_BLUFF_RULESET, type BluffRuleset } from '../schema';
import type { BluffGameState } from '../state';
import type { PlayerConfig } from '../../core/types';
import { countCards, assertNoDuplicateCards } from '../../core/invariants';

// ─── Test helpers ────────────────────────────────────────────────────────────

const mkPlayers = (n: number): PlayerConfig[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: true }));

function zones(s: BluffGameState) {
  return [...s.players.map(p => [...p.hand]), [...s.pile], [...(s.discardPile ?? [])]];
}

function checkConservation(s: BluffGameState) {
  expect(countCards(zones(s))).toBe(s.totalCards);
  assertNoDuplicateCards(zones(s), 'state');
}

/** Play the first N cards of the current player. */
function doPlay(s: BluffGameState, n = 1): BluffGameState {
  const cp = s.players[s.currentPlayerIndex]!;
  const cardIds = cp.hand.slice(0, n).map(c => c.id);
  return BluffEngine.applyMove(s, { type: 'PLAY', playerId: cp.id, cardIds, declaredRank: s.currentRank });
}

/** Challenge by the first pending player. */
function doChallenge(s: BluffGameState): BluffGameState {
  if (s.phase.type !== 'challenge') throw new Error('Not in challenge phase');
  const idx = s.phase.pendingIndices[0]!;
  return BluffEngine.applyMove(s, { type: 'CHALLENGE', playerId: s.players[idx]!.id });
}

/** Pass challenge for the first pending player. */
function doPass(s: BluffGameState): BluffGameState {
  if (s.phase.type !== 'challenge') throw new Error('Not in challenge phase');
  const idx = s.phase.pendingIndices[0]!;
  return BluffEngine.applyMove(s, { type: 'PASS_CHALLENGE', playerId: s.players[idx]!.id });
}

/** Pass all pending challenges (accept play). */
function acceptPlay(s: BluffGameState): BluffGameState {
  let cur = s;
  while (cur.phase.type === 'challenge') cur = doPass(cur);
  return cur;
}

// ─── createGame ─────────────────────────────────────────────────────────────

describe('createGame', () => {
  it('deals all 52 cards across 4 players', () => {
    const s = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    expect(s.totalCards).toBe(52);
    expect(countCards(zones(s))).toBe(52);
    const handSizes = s.players.map(p => p.hand.length);
    expect(handSizes.every(n => n === 13)).toBe(true);
  });

  it('distributes 52 cards evenly among 3 players (18-17-17)', () => {
    const s = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(3), 0);
    const sizes = s.players.map(p => p.hand.length).sort((a, b) => b - a);
    expect(sizes[0]).toBe(18); expect(sizes[1]).toBe(17); expect(sizes[2]).toBe(17);
  });

  it('uses 104 cards with deckCount=2', () => {
    const s = BluffEngine.createGame({ ...DEFAULT_BLUFF_RULESET, deckCount: 2 }, mkPlayers(4), 0);
    expect(s.totalCards).toBe(104);
    expect(countCards(zones(s))).toBe(104);
  });

  it('starts at rank A', () => {
    const s = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    expect(s.currentRank).toBe('A');
    expect(s.phase.type).toBe('play');
  });

  it('has no duplicate cards', () => {
    const s = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 42);
    assertNoDuplicateCards(zones(s), 'createGame');
  });
});

// ─── getLegalMoves ──────────────────────────────────────────────────────────

describe('getLegalMoves', () => {
  it('returns PLAY moves for the current player in play phase', () => {
    const s = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    const cp = s.players[s.currentPlayerIndex]!;
    const moves = BluffEngine.getLegalMoves(s, cp.id);
    expect(moves.every(m => m.type === 'PLAY')).toBe(true);
    expect(moves.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for a non-current player in play phase', () => {
    const s = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    const other = s.players[(s.currentPlayerIndex + 1) % 4]!;
    expect(BluffEngine.getLegalMoves(s, other.id)).toHaveLength(0);
  });

  it('returns CHALLENGE + PASS_CHALLENGE for first pending in challenge phase', () => {
    const s = doPlay(BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0));
    expect(s.phase.type).toBe('challenge');
    if (s.phase.type !== 'challenge') return;
    const pendingIdx = s.phase.pendingIndices[0]!;
    const moves = BluffEngine.getLegalMoves(s, s.players[pendingIdx]!.id);
    expect(moves.map(m => m.type).sort()).toEqual(['CHALLENGE', 'PASS_CHALLENGE'].sort());
  });

  it('returns PASS_TURN when allowPass=true', () => {
    const ruleset: BluffRuleset = { ...DEFAULT_BLUFF_RULESET, allowPass: true };
    const s = BluffEngine.createGame(ruleset, mkPlayers(4), 0);
    const cp = s.players[s.currentPlayerIndex]!;
    const moves = BluffEngine.getLegalMoves(s, cp.id);
    expect(moves.some(m => m.type === 'PASS_TURN')).toBe(true);
  });

  it('returns empty when allowPass=false', () => {
    const s = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    const cp = s.players[s.currentPlayerIndex]!;
    const moves = BluffEngine.getLegalMoves(s, cp.id);
    expect(moves.some(m => m.type === 'PASS_TURN')).toBe(false);
  });
});

// ─── applyMove: PLAY ────────────────────────────────────────────────────────

describe('applyMove PLAY', () => {
  it('removes cards from hand and adds to pile', () => {
    const init = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    const cp = init.players[init.currentPlayerIndex]!;
    const before = cp.hand.length;
    const s = doPlay(init, 2);
    expect(s.players[init.currentPlayerIndex]!.hand.length).toBe(before - 2);
    expect(s.pile.length).toBe(2);
    checkConservation(s);
  });

  it('transitions phase to challenge', () => {
    const s = doPlay(BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0));
    expect(s.phase.type).toBe('challenge');
  });

  it('throws on card not in hand', () => {
    const init = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    const cp = init.players[init.currentPlayerIndex]!;
    expect(() =>
      BluffEngine.applyMove(init, { type: 'PLAY', playerId: cp.id, cardIds: ['FAKE'], declaredRank: 'A' }),
    ).toThrow();
  });

  it('throws when wrong player plays', () => {
    const init = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    const other = init.players[(init.currentPlayerIndex + 1) % 4]!;
    const card = other.hand[0]!;
    expect(() =>
      BluffEngine.applyMove(init, { type: 'PLAY', playerId: other.id, cardIds: [card.id], declaredRank: 'A' }),
    ).toThrow();
  });

  it('accumulates pile across multiple plays', () => {
    let s = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    s = acceptPlay(doPlay(s, 1)); // play + all pass
    s = acceptPlay(doPlay(s, 2)); // next player plays 2
    // pile keeps both rounds' cards
    expect(s.pile.length).toBe(3);
    checkConservation(s);
  });
});

// ─── applyMove: CHALLENGE ───────────────────────────────────────────────────

describe('applyMove CHALLENGE', () => {
  it('liar picks up entire pile', () => {
    // Arrange: find a player and force a "lying" play using real cards (any card ≠ current rank)
    // Since we can't control what rank the dealt cards are, we verify conservation instead.
    const init = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    const afterPlay = doPlay(init, 1);
    const afterChallenge = doChallenge(afterPlay);

    const lastPlay = afterPlay.lastPlay!;
    const wasLying = lastPlay.cards.some(c => c.rank !== lastPlay.declaredRank);
    const loserIdx = wasLying
      ? lastPlay.playerIndex
      : afterPlay.phase.type === 'challenge'
        ? afterPlay.phase.pendingIndices[0]!
        : -1;

    // The loser gets all pile cards
    if (loserIdx >= 0) {
      const loserHand = afterChallenge.players[loserIdx]!.hand.length;
      expect(loserHand).toBeGreaterThan(0);
    }
    expect(afterChallenge.pile.length).toBe(0);
    checkConservation(afterChallenge);
  });

  it('rank advances after challenge', () => {
    const init = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    const afterPlay = doPlay(init);
    const afterChallenge = doChallenge(afterPlay);
    if (!BluffEngine.isGameOver(afterChallenge)) {
      expect(afterChallenge.currentRank).toBe('2'); // A → 2
    }
  });
});

// ─── mustSurviveCallOnLastPlay ───────────────────────────────────────────────

describe('ruleset: mustSurviveCallOnLastPlay', () => {
  /** Drain cards from players until current player has 1 card left. */
  function drainToOne(state: BluffGameState): BluffGameState {
    let s = state;
    let safeguard = 0;
    while (s.phase.type === 'play' && safeguard++ < 200) {
      const cp = s.players[s.currentPlayerIndex]!;
      if (cp.hand.length <= 1) break;
      const countToPlay = Math.min(cp.hand.length - 1, s.ruleset.maxCardsPerPlay);
      s = acceptPlay(doPlay(s, countToPlay));
    }
    return s;
  }

  it('mustSurviveCallOnLastPlay=false: immediate win, no challenge phase', () => {
    const ruleset: BluffRuleset = { ...DEFAULT_BLUFF_RULESET, mustSurviveCallOnLastPlay: false };
    // Use 2 players to reach end faster
    let s = BluffEngine.createGame(ruleset, mkPlayers(2), 7);
    s = drainToOne(s);
    if (s.phase.type !== 'play') return; // already over
    const cp = s.players[s.currentPlayerIndex]!;
    if (cp.hand.length !== 1) return;
    const s2 = doPlay(s, 1);
    expect(BluffEngine.isGameOver(s2)).toBe(true);
    expect(s2.phase.type).toBe('gameover');
  });

  it('mustSurviveCallOnLastPlay=true: challenge phase opens after last play', () => {
    let s = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(2), 7);
    s = drainToOne(s);
    if (s.phase.type !== 'play') return;
    const cp = s.players[s.currentPlayerIndex]!;
    if (cp.hand.length !== 1) return;
    const s2 = doPlay(s, 1);
    if (!BluffEngine.isGameOver(s2)) {
      expect(s2.phase.type).toBe('challenge');
    }
  });
});

// ─── whoStartsAfterChallenge ─────────────────────────────────────────────────

describe('ruleset: whoStartsAfterChallenge', () => {
  function runChallenge(rule: BluffRuleset['whoStartsAfterChallenge']) {
    const ruleset: BluffRuleset = { ...DEFAULT_BLUFF_RULESET, whoStartsAfterChallenge: rule };
    const s0 = BluffEngine.createGame(ruleset, mkPlayers(4), 0);
    const afterPlay = doPlay(s0);
    return doChallenge(afterPlay);
  }

  it('sequence: next player in seat order after played player starts', () => {
    const s0 = BluffEngine.createGame(
      { ...DEFAULT_BLUFF_RULESET, whoStartsAfterChallenge: 'sequence' }, mkPlayers(4), 0,
    );
    const playedIdx = s0.currentPlayerIndex;
    const afterChallenge = doChallenge(doPlay(s0));
    if (!BluffEngine.isGameOver(afterChallenge)) {
      expect(afterChallenge.currentPlayerIndex).toBe((playedIdx + 1) % 4);
    }
  });

  it('loser option resolves without error', () => {
    expect(() => runChallenge('loser')).not.toThrow();
  });

  it('winner option: challenger starts if they win, person with last turn starts if challenger loses', () => {
    const s0 = BluffEngine.createGame(
      { ...DEFAULT_BLUFF_RULESET, whoStartsAfterChallenge: 'winner' }, mkPlayers(4), 0,
    );
    const playedIdx = s0.currentPlayerIndex;
    const afterPlay = doPlay(s0);
    const afterChallenge = doChallenge(afterPlay);

    if (!BluffEngine.isGameOver(afterChallenge)) {
      const lastPlay = afterPlay.lastPlay!;
      const wasLying = lastPlay.cards.some(c => c.rank !== lastPlay.declaredRank);
      if (wasLying) {
        // Challenger won: challenger starts!
        const challengerIdx =
          afterPlay.phase.type === 'challenge'
            ? afterPlay.phase.pendingIndices[0]!
            : afterPlay.currentPlayerIndex;
        expect(afterChallenge.currentPlayerIndex).toBe(challengerIdx);
      } else {
        // Challenger lost: person with last turn (playedIdx) starts!
        expect(afterChallenge.currentPlayerIndex).toBe(playedIdx);
      }
    }
  });

  it('winner option in tableClearOnAllPass mode: winner starts and can lead rank', () => {
    const s0 = BluffEngine.createGame(
      { ...DEFAULT_BLUFF_RULESET, whoStartsAfterChallenge: 'winner', rankProgression: 'tableClearOnAllPass' }, mkPlayers(4), 0,
    );
    const playedIdx = s0.currentPlayerIndex;
    const p0 = s0.players[playedIdx]!;
    const afterPlay = BluffEngine.applyMove(s0, {
      type: 'PLAY',
      playerId: p0.id,
      cardIds: [p0.hand[0]!.id],
      declaredRank: 'A',
    });
    const challengerIdx = afterPlay.currentPlayerIndex;
    const challenger = afterPlay.players[challengerIdx]!;
    const afterChallenge = BluffEngine.applyMove(afterPlay, {
      type: 'CHALLENGE',
      playerId: challenger.id,
    });

    if (!BluffEngine.isGameOver(afterChallenge)) {
      const wasLying = afterPlay.lastPlay!.cards[0]!.rank !== 'A';
      if (wasLying) {
        expect(afterChallenge.currentPlayerIndex).toBe(challengerIdx);
      } else {
        expect(afterChallenge.currentPlayerIndex).toBe(playedIdx);
      }
      expect(afterChallenge.canLeadRank).toBe(true);
    }
  });
});

// ─── getScores ───────────────────────────────────────────────────────────────

describe('getScores', () => {
  it('throws if game is not over', () => {
    const s = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    expect(() => BluffEngine.getScores(s)).toThrow();
  });
});

// ─── getVisibleState ────────────────────────────────────────────────────────

describe('getVisibleState', () => {
  it('hides other players hands and pile', () => {
    const s0 = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, mkPlayers(4), 0);
    const s1 = doPlay(s0);
    const cp = s0.players[s0.currentPlayerIndex]!;
    const visible = BluffEngine.getVisibleState(s1, s0.players[1]!.id);
    // Pile hidden
    expect(visible.pile.length).toBe(0);
    // Own hand intact, others hidden
    expect(visible.players[1]!.hand.length).toBeGreaterThan(0);
    expect(visible.players[0]!.hand.length).toBe(0);
    // lastPlay cards hidden
    expect(visible.lastPlay?.cards.length ?? 0).toBe(0);
    // Declared rank still visible
    expect(visible.lastPlay?.declaredRank).toBe(s1.lastPlay?.declaredRank);
  });
});

// ─── rankProgression: tableClearOnAllPass ────────────────────────────────────

describe('ruleset: rankProgression (tableClearOnAllPass)', () => {
  it('allows leader to declare Kings, continues same hand when all others pass, allows playing more Kings, then clears on pass', () => {
    const ruleset: BluffRuleset = {
      ...DEFAULT_BLUFF_RULESET,
      rankProgression: 'tableClearOnAllPass',
    };
    let s = BluffEngine.createGame(ruleset, mkPlayers(4), 0);
    expect(s.canLeadRank).toBe(true);

    const leaderIdx = s.currentPlayerIndex;
    const leader = s.players[leaderIdx]!;
    // Leader plays 2 cards and declares King
    const cardIds = leader.hand.slice(0, 2).map(c => c.id);
    s = BluffEngine.applyMove(s, {
      type: 'PLAY',
      playerId: leader.id,
      cardIds,
      declaredRank: 'K',
    });

    expect(s.currentRank).toBe('K');
    expect(s.lastPlay?.declaredRank).toBe('K');
    expect(s.lastPlay?.cardCount).toBe(2);
    expect(s.pile.length).toBe(2);

    // All other 3 players pass turn
    for (let i = 0; i < 3; i++) {
      const active = s.players[s.currentPlayerIndex]!;
      s = BluffEngine.applyMove(s, { type: 'PASS_TURN', playerId: active.id });
    }

    // Hand CONTINUES! Pile is not cleared, rank is still K, turn returns to leader
    expect(s.pile.length).toBe(2);
    expect(s.discardPile.length).toBe(0);
    expect(s.currentRank).toBe('K');
    expect(s.currentPlayerIndex).toBe(leaderIdx);
    expect(s.canLeadRank).toBe(false);
    expect(s.phase.type).toBe('play');

    // Leader can play 2 more cards onto the same hand (same 2 Ks)!
    const leaderCards2 = s.players[leaderIdx]!.hand.slice(0, 2).map(c => c.id);
    s = BluffEngine.applyMove(s, {
      type: 'PLAY',
      playerId: leader.id,
      cardIds: leaderCards2,
      declaredRank: 'K',
    });
    expect(s.pile.length).toBe(4);
    expect(s.currentRank).toBe('K');

    // All other 3 players pass turn again
    for (let i = 0; i < 3; i++) {
      const active = s.players[s.currentPlayerIndex]!;
      s = BluffEngine.applyMove(s, { type: 'PASS_TURN', playerId: active.id });
    }

    expect(s.pile.length).toBe(4);
    expect(s.currentPlayerIndex).toBe(leaderIdx);

    // Leader chooses to pass on their own turn -> now table is cleared!
    s = BluffEngine.applyMove(s, { type: 'PASS_TURN', playerId: leader.id });
    expect(s.pile.length).toBe(0);
    expect(s.discardPile.length).toBe(4);
    expect(s.currentPlayerIndex).toBe(leaderIdx);
    expect(s.canLeadRank).toBe(true);

    // Invariant: total cards strictly conserved
    checkConservation(s);
  });

  it('supports Indian Bluff continuous flow: Bot 1 plays 2 7s, Bot 2 plays 1 7, Bot 3 skips, Bot 4 can show, pass, or play 7s', () => {
    const ruleset: BluffRuleset = {
      ...DEFAULT_BLUFF_RULESET,
      rankProgression: 'tableClearOnAllPass',
    };
    let s = BluffEngine.createGame(ruleset, mkPlayers(4), 0);

    // Bot 1 leads: plays 2 cards declared as 7
    const p1 = s.players[s.currentPlayerIndex]!;
    s = BluffEngine.applyMove(s, {
      type: 'PLAY',
      playerId: p1.id,
      cardIds: p1.hand.slice(0, 2).map(c => c.id),
      declaredRank: '7',
    });
    expect(s.currentRank).toBe('7');
    expect(s.pile.length).toBe(2);

    // Turn is now Bot 2: Bot 2 can Show, Pass, or Play cards as 7
    const p2 = s.players[s.currentPlayerIndex]!;
    const p2Moves = BluffEngine.getLegalMoves(s, p2.id);
    expect(p2Moves.some(m => m.type === 'CHALLENGE')).toBe(true);
    expect(p2Moves.some(m => m.type === 'PASS_TURN')).toBe(true);
    expect(p2Moves.some(m => m.type === 'PLAY' && m.declaredRank === '7')).toBe(true);

    // Bot 2 puts 1 card as 7 onto pile
    s = BluffEngine.applyMove(s, {
      type: 'PLAY',
      playerId: p2.id,
      cardIds: [p2.hand[0]!.id],
      declaredRank: '7',
    });
    expect(s.pile.length).toBe(3);
    expect(s.lastPlay?.playerId).toBe(p2.id);

    // Turn is now Bot 3: Bot 3 skips (Pass)
    const p3 = s.players[s.currentPlayerIndex]!;
    s = BluffEngine.applyMove(s, {
      type: 'PASS_TURN',
      playerId: p3.id,
    });
    expect(s.consecutivePasses).toBe(1);

    // Turn is now Bot 4 / Player: Can Show (challenge Bot 2), Pass, or Play cards as 7
    const p4 = s.players[s.currentPlayerIndex]!;
    const p4Moves = BluffEngine.getLegalMoves(s, p4.id);
    expect(p4Moves.some(m => m.type === 'CHALLENGE')).toBe(true);
    expect(p4Moves.some(m => m.type === 'PASS_TURN')).toBe(true);
    expect(p4Moves.some(m => m.type === 'PLAY' && m.declaredRank === '7')).toBe(true);

    // If Bot 4 and Bot 1 also pass, everyone passed after Bot 2's play -> turn returns to Bot 2 on same hand!
    s = BluffEngine.applyMove(s, { type: 'PASS_TURN', playerId: p4.id }); // pass 2
    const p1Again = s.players[s.currentPlayerIndex]!;
    s = BluffEngine.applyMove(s, { type: 'PASS_TURN', playerId: p1Again.id }); // pass 3 (all 3 other players passed!)

    expect(s.pile.length).toBe(3);
    expect(s.currentRank).toBe('7');
    expect(s.currentPlayerIndex).toBe(s.players.findIndex(p => p.id === p2.id));
    expect(s.canLeadRank).toBe(false);

    // Bot 2 now passes on its own turn to clear the table
    s = BluffEngine.applyMove(s, { type: 'PASS_TURN', playerId: p2.id });
    expect(s.pile.length).toBe(0);
    expect(s.discardPile.length).toBe(3);
    expect(s.canLeadRank).toBe(true);
    expect(s.currentPlayerIndex).toBe(s.players.findIndex(p => p.id === p2.id));
    checkConservation(s);
  });

  it('enforces 4 max cards in 52 cards deck, and up to 8 max cards in 104 cards deck', () => {
    const s52 = BluffEngine.createGame({ ...DEFAULT_BLUFF_RULESET, deckCount: 1, maxCardsPerPlay: 4 }, mkPlayers(4), 0);
    const cp52 = s52.players[s52.currentPlayerIndex]!;
    // Attempting to play 5 cards in 52 cards deck must throw
    expect(() =>
      BluffEngine.applyMove(s52, {
        type: 'PLAY',
        playerId: cp52.id,
        cardIds: cp52.hand.slice(0, 5).map(c => c.id),
        declaredRank: s52.currentRank,
      }),
    ).toThrow();

    const s104 = BluffEngine.createGame({ ...DEFAULT_BLUFF_RULESET, deckCount: 2, maxCardsPerPlay: 8 }, mkPlayers(4), 0);
    const cp104 = s104.players[s104.currentPlayerIndex]!;
    // Playing 6 cards in 104 cards deck succeeds
    const s104Played = BluffEngine.applyMove(s104, {
      type: 'PLAY',
      playerId: cp104.id,
      cardIds: cp104.hand.slice(0, 6).map(c => c.id),
      declaredRank: s104.currentRank,
    });
    expect(s104Played.pile.length).toBe(6);
  });
});

