// ---------------------------------------------------------------------------
// Even deal — distributes items round-robin across players.
// Works for any player count; handles non-divisible totals gracefully.
// ---------------------------------------------------------------------------

/**
 * Distribute `items` round-robin into `playerCount` arrays.
 * Player 0 gets items 0, playerCount, 2*playerCount, …
 * Player 1 gets items 1, playerCount+1, …
 *
 * With a 52-card deck and 3 players the distribution is 18-17-17.
 */
export function dealEvenly<T>(items: readonly T[], playerCount: number): T[][] {
  if (playerCount <= 0) throw new Error('playerCount must be positive');
  const hands: T[][] = Array.from({ length: playerCount }, () => []);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item !== undefined) {
      hands[i % playerCount]!.push(item);
    }
  }
  return hands;
}
