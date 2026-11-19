// ---------------------------------------------------------------------------
// Thulla moves — discriminated union of all legal moves in Thulla.
// ---------------------------------------------------------------------------

import type { PlayerId } from '../core/types';

export type ThullaMove = {
  readonly type: 'PLAY_CARD';
  readonly playerId: PlayerId;
  readonly cardId: string;
};
