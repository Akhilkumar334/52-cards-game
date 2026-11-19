// ---------------------------------------------------------------------------
// Floor Partition Solver Unit Tests
// Tests exact floor partitioning: 5+5, 6+4, 2+2+2+4, houses as single items,
// impossible partitions, and large floors.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import type { FloorItem, SeepHouse } from '../state';
import { canPartitionIntoTarget } from '../helpers';
import type { Card } from '../../core/types';

function mkCardItem(rank: Card['rank'], id: string): FloorItem {
  return {
    type: 'loose',
    id,
    card: { id, suit: 'H', rank, deckIndex: 0 },
  };
}

function mkHouseItem(buildValue: number, id: string): FloorItem {
  const house: SeepHouse = {
    id,
    buildValue,
    ownerPlayerIndex: 0,
    ownerTeamIndex: 0,
    cards: [],
    isCemented: false,
  };
  return {
    type: 'house',
    id,
    house,
  };
}

describe('Floor Partition Solver', () => {
  it('partitions 5 + 5 into target 10', () => {
    const items = [mkCardItem('5', 'c1'), mkCardItem('5', 'c2')];
    expect(canPartitionIntoTarget(items, 10)).toBe(true);
  });

  it('partitions 6 + 4 into target 10', () => {
    const items = [mkCardItem('6', 'c1'), mkCardItem('4', 'c2')];
    expect(canPartitionIntoTarget(items, 10)).toBe(true);
  });

  it('partitions 2 + 2 + 2 + 4 into target 10', () => {
    const items = [
      mkCardItem('2', 'c1'),
      mkCardItem('2', 'c2'),
      mkCardItem('2', 'c3'),
      mkCardItem('4', 'c4'),
    ];
    expect(canPartitionIntoTarget(items, 10)).toBe(true);
  });

  it('partitions multiple groups: 5+5 and 6+4 into target 10', () => {
    const items = [
      mkCardItem('5', 'c1'),
      mkCardItem('5', 'c2'),
      mkCardItem('6', 'c3'),
      mkCardItem('4', 'c4'),
    ];
    expect(canPartitionIntoTarget(items, 10)).toBe(true);
  });

  it('treats houses as single atomic items with their house value', () => {
    // Floor has a House of 10 and two 5s
    const items = [
      mkHouseItem(10, 'h1'),
      mkCardItem('5', 'c1'),
      mkCardItem('5', 'c2'),
    ];
    expect(canPartitionIntoTarget(items, 10)).toBe(true);

    // Floor has a House of 12 and two 6s for target 12
    const items12 = [
      mkHouseItem(12, 'h2'),
      mkCardItem('6', 'c3'),
      mkCardItem('6', 'c4'),
    ];
    expect(canPartitionIntoTarget(items12, 12)).toBe(true);
  });

  it('rejects impossible partitions where sum is not a multiple of target', () => {
    // 3 + 4 + 5 = 12 (not a multiple of 10)
    const items = [
      mkCardItem('3', 'c1'),
      mkCardItem('4', 'c2'),
      mkCardItem('5', 'c3'),
    ];
    expect(canPartitionIntoTarget(items, 10)).toBe(false);

    // 7 + 7 = 14
    const items2 = [mkCardItem('7', 'c1'), mkCardItem('7', 'c2')];
    expect(canPartitionIntoTarget(items2, 10)).toBe(false);
  });

  it('rejects impossible partitions where sum is a multiple but groups cannot be formed', () => {
    // 8 + 8 + 4 = 20 (sum 20 is multiple of 10, but cannot make two 10s from [8, 8, 4])
    const items = [
      mkCardItem('8', 'c1'),
      mkCardItem('8', 'c2'),
      mkCardItem('4', 'c3'),
    ];
    expect(canPartitionIntoTarget(items, 10)).toBe(false);
  });

  it('rejects partitions containing items strictly greater than target', () => {
    // Target 9, but floor contains a 10
    const items = [mkCardItem('T', 'c1'), mkCardItem('8', 'c2')];
    expect(canPartitionIntoTarget(items, 9)).toBe(false);
  });

  it('efficiently solves large floors (10+ items)', () => {
    // 10 items forming 5 groups of 10:
    // Group 1: 5 + 5 = 10
    // Group 2: 6 + 4 = 10
    // Group 3: 7 + 3 = 10
    // Group 4: 8 + 2 = 10
    // Group 5: 9 + 1 = 10
    const items = [
      mkCardItem('5', 'c1'),
      mkCardItem('5', 'c2'),
      mkCardItem('6', 'c3'),
      mkCardItem('4', 'c4'),
      mkCardItem('7', 'c5'),
      mkCardItem('3', 'c6'),
      mkCardItem('8', 'c7'),
      mkCardItem('2', 'c8'),
      mkCardItem('9', 'c9'),
      mkCardItem('A', 'c10'), // Ace = 1
    ];
    expect(canPartitionIntoTarget(items, 10)).toBe(true);

    // With a house mixed in:
    const itemsWithHouse = [
      mkHouseItem(10, 'h1'),
      mkCardItem('6', 'c3'),
      mkCardItem('4', 'c4'),
      mkCardItem('7', 'c5'),
      mkCardItem('3', 'c6'),
      mkCardItem('8', 'c7'),
      mkCardItem('2', 'c8'),
      mkCardItem('9', 'c9'),
      mkCardItem('A', 'c10'),
    ];
    expect(canPartitionIntoTarget(itemsWithHouse, 10)).toBe(true);
  });
});
