// ---------------------------------------------------------------------------
// Seeded RNG — mulberry32 algorithm.
// Zero external dependencies. Games inject this through createGame(seed).
// Using an injected RNG makes every game fully reproducible from its seed.
// ---------------------------------------------------------------------------

export interface SeededRng {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number;
}

/**
 * Create a mulberry32 PRNG from a 32-bit integer seed.
 * Reference: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 */
export function createRng(seed: number): SeededRng {
  let s = seed >>> 0; // coerce to uint32

  function next(): number {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  function nextInt(min: number, max: number): number {
    return min + Math.floor(next() * (max - min + 1));
  }

  return { next, nextInt };
}
