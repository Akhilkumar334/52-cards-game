// ---------------------------------------------------------------------------
// Seep Move Types — pure TypeScript discriminated union
// Fully supports Phase 3 moves: DECLARE_BID, CAPTURE, BUILD, TRAIL,
// CEMENT_HOUSE, REDEAL_COURT, and REDEAL_BID.
// ---------------------------------------------------------------------------

import type { CardId, PlayerId } from '../core/types';

export type SeepMove =
  | {
      readonly type: 'DECLARE_BID';
      readonly playerId: PlayerId;
      readonly houseValue: number; // 9 to 13
    }
  | {
      readonly type: 'BID'; // Legacy/Direct combined bid move
      readonly playerId: PlayerId;
      readonly houseValue: number; // 9 to 13
      readonly handCardId: CardId;
      readonly floorCardIds: readonly CardId[];
    }
  | {
      readonly type: 'CAPTURE';
      readonly playerId: PlayerId;
      readonly handCardId: CardId;
      readonly itemIds?: readonly string[]; // FloorItem IDs (card or house)
      readonly capturedLooseCardIds?: readonly CardId[];
      readonly capturedHouseIds?: readonly string[];
    }
  | {
      readonly type: 'BUILD';
      readonly playerId: PlayerId;
      readonly handCardId: CardId;
      readonly targetValue: number; // 9 to 13
      readonly floorItemIds: readonly string[];
      readonly extendHouseId?: string;
    }
  | {
      readonly type: 'BUILD_HOUSE'; // Alias for BUILD
      readonly playerId: PlayerId;
      readonly handCardId: CardId;
      readonly targetValue: number;
      readonly floorCardIds: readonly CardId[];
    }
  | {
      readonly type: 'TRAIL';
      readonly playerId: PlayerId;
      readonly cardId: CardId;
    }
  | {
      readonly type: 'THROW'; // Alias for TRAIL
      readonly playerId: PlayerId;
      readonly cardId: CardId;
    }
  | {
      readonly type: 'CEMENT_HOUSE';
      readonly playerId: PlayerId;
      readonly handCardId: CardId;
      readonly houseId: string;
      readonly additionalFloorCardIds: readonly CardId[];
    }
  | {
      readonly type: 'REDEAL_COURT';
      readonly playerId: PlayerId;
    }
  | {
      readonly type: 'REDEAL_BID';
      readonly playerId: PlayerId;
    };
