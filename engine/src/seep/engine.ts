// ---------------------------------------------------------------------------
// Seep (Sweep) Game Engine — implements GameEngine<SeepGameState, SeepMove, SeepRuleset>
// Pure TypeScript. Zero DOM, zero React. Fully deterministic seeded RNG.
// Supports 2, 3, and 4 players, partnerships, floor partition solver,
// persistent opening bid banner, compulsory rules, takedowns, and 100-point accounting.
// ---------------------------------------------------------------------------

import type { GameEngine } from '../interface';
import { GameError } from '../interface';
import type { Card, CardId, PlayerConfig, PlayerId } from '../core/types';
import { buildDeck, shuffle } from '../core/deck';
import { createRng } from '../core/rng';
import { SeepRulesetSchema, type SeepRuleset } from './schema';
import type {
  FloorItem,
  OpeningBidInfo,
  SeepFloor,
  SeepGameState,
  SeepHouse,
  SeepPlayer,
  SeepTeam,
} from './state';
import type { SeepMove } from './moves';
import {
  canPartitionIntoTarget,
  countCapturedCardPoints,
  createFloor,
  findCapturableItems,
  findSubsetsSummingTo,
  getCardNumericValue,
  getCardPointValue,
  getCompulsoryRestriction,
  getSeepForcedMoveReason,
  getFloorItemId,
  getFloorItemValue,
  getSeepVisibleState,
  isFullFloorSeep,
  isTableCleared,
} from './helpers';

// Helper to remove cards from hand
function removeCardFromHand(hand: readonly Card[], cardId: CardId): Card[] {
  return hand.filter((c) => c.id !== cardId);
}

// ─── createGame ─────────────────────────────────────────────────────────────

function createGame(
  rulesetInput: SeepRuleset,
  playersConfig: PlayerConfig[],
  seed: number,
): SeepGameState {
  const ruleset = SeepRulesetSchema.parse(rulesetInput);
  const numPlayers = playersConfig.length;

  if (numPlayers < 2 || numPlayers > 4) {
    throw new GameError('Seep requires 2, 3, or 4 players', 'BAD_PLAYER_COUNT');
  }

  const rng = createRng(seed);
  let fullDeck = shuffle(buildDeck(1), rng);

  // Handle court cards on initial floor (J, Q, K)
  const isCourt = (c: Card) => ['J', 'Q', 'K'].includes(c.rank);
  if (ruleset.courtCardsOnInitialFloor === 'redeal') {
    let attempts = 0;
    while (fullDeck.slice(0, 4).some(isCourt) && attempts < 100) {
      fullDeck = shuffle(fullDeck, rng);
      attempts++;
    }
  } else if (ruleset.courtCardsOnInitialFloor === 'bottom_of_deck') {
    const floorCandidates = fullDeck.slice(0, 4);
    const nonCourtFloor = floorCandidates.filter((c) => !isCourt(c));
    const courtFloor = floorCandidates.filter(isCourt);
    const rest = fullDeck.slice(4);
    fullDeck = [...nonCourtFloor, ...rest, ...courtFloor];
  }

  // 4 cards to the initial floor
  const initialFloorCards = fullDeck.slice(0, 4);
  let deckPointer = 4;

  // 4 cards to each player for the opening round
  const players: SeepPlayer[] = playersConfig.map((p, idx) => {
    const hand = fullDeck.slice(deckPointer, deckPointer + 4);
    deckPointer += 4;
    const teamIndex = numPlayers === 4 ? (idx % 2 === 0 ? 0 : 1) : idx;
    return {
      ...p,
      teamIndex,
      hand,
    };
  });

  const undealtDeck = fullDeck.slice(deckPointer);

  // Teams configuration
  const teams: SeepTeam[] =
    numPlayers === 4
      ? [
          {
            teamIndex: 0,
            name: `${playersConfig[0]!.name} & ${playersConfig[2]!.name}`,
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
            name: `${playersConfig[1]!.name} & ${playersConfig[3]!.name}`,
            playerIndices: [1, 3],
            capturedCards: [],
            permanentSeep: false,
            activeSeeps: 0,
            downedSeeps: 0,
            seepCount: 0,
            roundScore: 0,
            totalScore: 0,
          },
        ]
      : playersConfig.map((p, idx) => ({
          teamIndex: idx,
          name: p.name,
          playerIndices: [idx],
          capturedCards: [],
          permanentSeep: false,
          activeSeeps: 0,
          downedSeeps: 0,
          seepCount: 0,
          roundScore: 0,
          totalScore: 0,
        }));

  const floor = createFloor(initialFloorCards, []);

  const state: SeepGameState = {
    ruleset,
    players,
    teams,
    currentPlayerIndex: 0,
    bidderIndex: 0,
    floor,
    phase: { type: 'bidding' },
    openingBid: null,
    firstSeepOccurred: false,
    lastCapturePlayerIndex: null,
    lastActionAnnouncement: 'Bidding phase: Player 0 must declare an opening bid (9–13).',
    forcedReason: null,
    roundNumber: 1,
    turnNumber: 0,
    log: [
      `Match started with ${numPlayers} players. 4 cards dealt to floor and 4 to each player.`,
    ],
    undealtDeck,
  };

  return state;
}

// ─── getLegalMoves ──────────────────────────────────────────────────────────

function getLegalMoves(state: SeepGameState, playerId: PlayerId): SeepMove[] {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1 || playerIndex !== state.currentPlayerIndex) {
    return [];
  }

  const player = state.players[playerIndex]!;
  const hand = player.hand;
  const floor = state.floor;
  const ruleset = state.ruleset;

  // 1. BIDDING PHASE
  if (state.phase.type === 'bidding') {
    // Stage 1: Player must DECLARE_BID
    if (!state.openingBid) {
      const allowedHouseValues = [9, 10, 11, 12, 13];
      const heldBidValues = Array.from(
        new Set(
          hand
            .map((c) => getCardNumericValue(c))
            .filter((v) => allowedHouseValues.includes(v)),
        ),
      );

      if (heldBidValues.length === 0) {
        return [{ type: 'REDEAL_BID', playerId }];
      }

      const moves: SeepMove[] = heldBidValues.map((val) => ({
        type: 'DECLARE_BID',
        playerId,
        houseValue: val,
      }));

      // Also support legacy/direct BID moves for compatibility
      for (const val of heldBidValues) {
        const matchingCard = hand.find((c) => getCardNumericValue(c) === val);
        if (matchingCard) {
          moves.push({
            type: 'BID',
            playerId,
            houseValue: val,
            handCardId: matchingCard.id,
            floorCardIds: [],
          });
        }
      }

      return moves;
    }

    // Stage 2: After bid declared, Bidder executes opening move (CAPTURE, BUILD, or TRAIL)
    const bidVal = state.openingBid.houseValue;
    const bidCard = hand.find((c) => getCardNumericValue(c) === bidVal);
    const openingMoves: SeepMove[] = [];

    // A. CAPTURE with the bid card
    if (bidCard) {
      const capturable = findCapturableItems(floor.items, bidVal);
      if (capturable.length > 0) {
        openingMoves.push({
          type: 'CAPTURE',
          playerId,
          handCardId: bidCard.id,
          itemIds: capturable.map((i) => i.id),
          capturedLooseCardIds: capturable.filter((i) => i.type === 'loose').map((i) => i.id),
          capturedHouseIds: capturable.filter((i) => i.type === 'house').map((i) => i.id),
        });
      }
    }

    // B. BUILD house of bidVal (combining another card from hand with floor items)
    // Must hold another card of bidVal in hand, under max houses limit, and no house of bidVal exists
    if (floor.houses.length < ruleset.maxHousesOnFloor && !floor.houses.some((h) => h.buildValue === bidVal)) {
      for (const hCard of hand) {
        const cardVal = getCardNumericValue(hCard);
        if (cardVal < bidVal) {
          const hasOtherMatching = hand.some((c) => c.id !== hCard.id && getCardNumericValue(c) === bidVal);
          if (hasOtherMatching) {
            const needed = bidVal - cardVal;
            const combinations = findSubsetsSummingTo(floor.looseCards, needed, 4);
            for (const comb of combinations) {
              openingMoves.push({
                type: 'BUILD',
                playerId,
                handCardId: hCard.id,
                targetValue: bidVal,
                floorItemIds: comb.map((c) => c.id),
              });
            }
          }
        }
      }
    }

    // C. TRAIL: only if cannot capture or build (or if openingTrailOnlyIfCannotBuild is false)
    if (!ruleset.openingTrailOnlyIfCannotBuild || openingMoves.length === 0) {
      for (const c of hand) {
        openingMoves.push({
          type: 'TRAIL',
          playerId,
          cardId: c.id,
        });
      }
    }

    return openingMoves;
  }

  // 2. PLAYING PHASE
  if (state.phase.type === 'playing') {
    // Check compulsory restrictions (Compulsory Takedown, Compulsory First Seep, Compulsory Capture)
    // In Seep, compulsory first seep ONLY applies if at least one card in hand can capture the ENTIRE floor.
    const restriction = getCompulsoryRestriction(state, playerId);
    if (restriction.forcedMoves && restriction.forcedMoves.length > 0) {
      return [...restriction.forcedMoves];
    }

    const rawMoves: SeepMove[] = [];

    // Compute all possible CAPTURE moves
    const captureMoves: Extract<SeepMove, { type: 'CAPTURE' }>[] = [];
    for (const hCard of hand) {
      const cardVal = getCardNumericValue(hCard);
      const capturable = findCapturableItems(floor.items, cardVal);
      if (capturable.length > 0) {
        captureMoves.push({
          type: 'CAPTURE',
          playerId,
          handCardId: hCard.id,
          itemIds: capturable.map((i) => i.id),
          capturedLooseCardIds: capturable.filter((i) => i.type === 'loose').map((i) => i.id),
          capturedHouseIds: capturable.filter((i) => i.type === 'house').map((i) => i.id),
        });
      }
    }

    rawMoves.push(...captureMoves);

    // BUILD moves (values 9 to 13)
    const allowedHouseValues = [9, 10, 11, 12, 13];
    for (const hCard of hand) {
      const cardVal = getCardNumericValue(hCard);
      const otherCards = hand.filter((c) => c.id !== hCard.id);

      for (const targetVal of allowedHouseValues) {
        // Player MUST hold another card of targetVal in hand
        const holdsMatchingCard = otherCards.some((c) => getCardNumericValue(c) === targetVal);
        if (!holdsMatchingCard) continue;

        // Multiple houses check
        if (!ruleset.multipleHousesAllowed) {
          const teamHasHouse = floor.houses.some(
            (h) => h.ownerTeamIndex === player.teamIndex && h.buildValue === targetVal,
          );
          if (teamHasHouse) continue;
        }

        // A. Form new house combining hCard + floor items
        // In Seep, at most maxHousesOnFloor houses can exist on the table, and no duplicate house values
        if (floor.houses.length < ruleset.maxHousesOnFloor && !floor.houses.some((h) => h.buildValue === targetVal)) {
          if (cardVal < targetVal) {
            const needed = targetVal - cardVal;
            const combinations = findSubsetsSummingTo(floor.looseCards, needed, 4);
            for (const comb of combinations) {
              rawMoves.push({
                type: 'BUILD',
                playerId,
                handCardId: hCard.id,
                targetValue: targetVal,
                floorItemIds: comb.map((c) => c.id),
              });
              // Also allow collecting additional loose card subsets from ground that sum to targetVal
              const remainingLoose = floor.looseCards.filter((c) => !comb.some((cc) => cc.id === c.id));
              const extraSubsets = findSubsetsSummingTo(remainingLoose, targetVal, 4);
              for (const extra of extraSubsets) {
                rawMoves.push({
                  type: 'BUILD',
                  playerId,
                  handCardId: hCard.id,
                  targetValue: targetVal,
                  floorItemIds: [...comb, ...extra].map((c) => c.id),
                });
              }
            }
          } else if (cardVal === targetVal) {
            // Player holds another card of targetVal in hand, and is building a house of targetVal
            // by playing this card onto floor card(s) that sum to targetVal (e.g. King on King, or King on 9+4)
            const targetSubsets = findSubsetsSummingTo(floor.looseCards, targetVal, 4);
            for (const comb of targetSubsets) {
              rawMoves.push({
                type: 'BUILD',
                playerId,
                handCardId: hCard.id,
                targetValue: targetVal,
                floorItemIds: comb.map((c) => c.id),
              });
              // Also if there is another disjoint subset of targetVal on the floor, allow collecting both
              const remainingLoose = floor.looseCards.filter((c) => !comb.some((cc) => cc.id === c.id));
              const extraSubsets = findSubsetsSummingTo(remainingLoose, targetVal, 4);
              for (const extra of extraSubsets) {
                rawMoves.push({
                  type: 'BUILD',
                  playerId,
                  handCardId: hCard.id,
                  targetValue: targetVal,
                  floorItemIds: [...comb, ...extra].map((c) => c.id),
                });
              }
            }
          }
        }

        // B. Extend/Break existing uncemented house
        for (const house of floor.houses) {
          if (house.isCemented) continue;
          // Cannot extend to a value that duplicates another existing house on floor
          if (floor.houses.some((h) => h.id !== house.id && h.buildValue === targetVal)) {
            continue;
          }
          if (house.buildValue + cardVal === targetVal) {
            rawMoves.push({
              type: 'BUILD',
              playerId,
              handCardId: hCard.id,
              targetValue: targetVal,
              floorItemIds: [],
              extendHouseId: house.id,
            });
          }
        }
      }

      // CEMENT_HOUSE moves: only legal if the player retains/holds a card equal to house.buildValue
      if (ruleset.cementedHouses) {
        for (const house of floor.houses) {
          const houseVal = house.buildValue;
          const isOwnHouse = house.ownerTeamIndex === player.teamIndex;
          const partnerIsOwner = isOwnHouse && house.ownerPlayerIndex !== playerIndex;
          const matchingCardsInHand = hand.filter((c) => getCardNumericValue(c) === houseVal);

          // Direct contribution of matching card (cardVal === houseVal)
          if (cardVal === houseVal) {
            // If partner is owner, partner already holds the house card for the team.
            // Otherwise (player is owner or an opponent is owner), player MUST keep another matching card in hand!
            const canPlay = partnerIsOwner ? matchingCardsInHand.length >= 1 : matchingCardsInHand.length >= 2;
            if (canPlay) {
              rawMoves.push({
                type: 'CEMENT_HOUSE',
                playerId,
                handCardId: hCard.id,
                houseId: house.id,
                additionalFloorCardIds: [],
              });
              // Also allow collecting loose card subsets from ground that sum to houseVal (e.g. 9+4=13 onto House 13)
              const targetSubsets = findSubsetsSummingTo(floor.looseCards, houseVal, 4);
              for (const comb of targetSubsets) {
                rawMoves.push({
                  type: 'CEMENT_HOUSE',
                  playerId,
                  handCardId: hCard.id,
                  houseId: house.id,
                  additionalFloorCardIds: comb.map((c) => c.id),
                });
              }
            }
          }

          // Contribution combining hCard + floor loose cards (cardVal < houseVal)
          if (cardVal < houseVal) {
            // Player is playing hCard (which is NOT houseVal) + loose cards that sum to houseVal.
            // - If partner is owner, partner holds the house card.
            // - Otherwise (player is owner or an opponent is owner), player MUST hold at least 1 card of houseVal in hand!
            const hasHouseCardInHand = partnerIsOwner || matchingCardsInHand.length >= 1;
            if (hasHouseCardInHand) {
              const needed = houseVal - cardVal;
              const combinations = findSubsetsSummingTo(floor.looseCards, needed, 4);
              for (const comb of combinations) {
                rawMoves.push({
                  type: 'CEMENT_HOUSE',
                  playerId,
                  handCardId: hCard.id,
                  houseId: house.id,
                  additionalFloorCardIds: comb.map((c) => c.id),
                });
                // Also allow collecting additional loose card subsets from ground that sum to houseVal
                const remainingLoose = floor.looseCards.filter((c) => !comb.some((cc) => cc.id === c.id));
                const extraSubsets = findSubsetsSummingTo(remainingLoose, houseVal, 4);
                for (const extra of extraSubsets) {
                  rawMoves.push({
                    type: 'CEMENT_HOUSE',
                    playerId,
                    handCardId: hCard.id,
                    houseId: house.id,
                    additionalFloorCardIds: [...comb, ...extra].map((c) => c.id),
                  });
                }
              }
            }
          }
        }
      }
    }

    // TRAIL moves: legal when trailAlwaysAllowed is true or when no capture/build exists
    const hasCaptureOrBuild = rawMoves.length > 0;
    if (ruleset.trailAlwaysAllowed || !hasCaptureOrBuild) {
      for (const c of hand) {
        const cVal = getCardNumericValue(c);
        // If player's team owns (or co-owns) a house of this value on the floor, player must retain at least 1 card
        // matching the house in hand until it is captured or broken
        const ownHouse = floor.houses.find(
          (h) =>
            (h.ownerTeamIndex === player.teamIndex || h.coOwnerTeamIndex === player.teamIndex) &&
            h.buildValue === cVal,
        );
        if (ownHouse) {
          const matchingCount = hand.filter((hc) => getCardNumericValue(hc) === cVal).length;
          if (matchingCount <= 1) {
            continue;
          }
        }

        rawMoves.push({
          type: 'TRAIL',
          playerId,
          cardId: c.id,
        });
      }
    }

    // Failsafe: A player must never be stuck with 0 legal moves on their turn
    if (rawMoves.length === 0) {
      for (const c of hand) {
        rawMoves.push({
          type: 'TRAIL',
          playerId,
          cardId: c.id,
        });
      }
    }

    return rawMoves;
  }

  return [];
}

// ─── applyMove ─────────────────────────────────────────────────────────────

function applyMove(state: SeepGameState, move: SeepMove): SeepGameState {
  const playerIndex = state.players.findIndex((p) => p.id === move.playerId);
  if (playerIndex === -1 || playerIndex !== state.currentPlayerIndex) {
    throw new GameError(`Not player ${move.playerId}'s turn`, 'ILLEGAL_MOVE');
  }

  const player = state.players[playerIndex]!;
  const teamIndex = player.teamIndex;
  const ruleset = state.ruleset;

  // 0. REDEAL_BID
  if (move.type === 'REDEAL_BID') {
    if (state.phase.type !== 'bidding') {
      throw new GameError('Cannot redeal outside bidding phase', 'ILLEGAL_MOVE');
    }

    const rng = createRng((state.turnNumber + 1) * 7919 + 43);
    const allCards = [
      ...player.hand,
      ...state.floor.looseCards,
      ...(state.undealtDeck ?? []),
    ];
    const shuffled = shuffle(allCards.length === 52 ? allCards : buildDeck(1), rng);

    const initialFloorCards = shuffled.slice(0, 4);
    let ptr = 4;
    const updatedPlayers = state.players.map((p) => {
      const hand = shuffled.slice(ptr, ptr + 4);
      ptr += 4;
      return { ...p, hand };
    });

    const newFloor = createFloor(initialFloorCards, []);
    return {
      ...state,
      players: updatedPlayers,
      floor: newFloor,
      phase: { type: 'bidding' },
      openingBid: null,
      lastActionAnnouncement: `${player.name} held no 9–13 (Raddi). Cards re-dealt!`,
      turnNumber: state.turnNumber + 1,
      log: [...state.log, `🔄 ${player.name} had no valid bid cards. Hand re-dealt.`],
      undealtDeck: shuffled.slice(ptr),
    };
  }

  // 1. DECLARE_BID
  if (move.type === 'DECLARE_BID') {
    if (state.phase.type !== 'bidding' || state.openingBid !== null) {
      throw new GameError('Opening bid already declared or not in bidding phase', 'ILLEGAL_MOVE');
    }

    const holdsBidCard = player.hand.some((c) => getCardNumericValue(c) === move.houseValue);
    if (!holdsBidCard) {
      throw new GameError(
        `Cannot declare bid ${move.houseValue} without holding a card of value ${move.houseValue}`,
        'ILLEGAL_MOVE',
      );
    }

    const openingBid: OpeningBidInfo = {
      playerId: player.id,
      playerIndex,
      houseValue: move.houseValue,
      isCaptured: false,
      active: true,
    };

    const logEntry = `👑 ${player.name} declared opening bid: House of ${move.houseValue}`;
    return {
      ...state,
      openingBid,
      lastActionAnnouncement: `${player.name} bid ${move.houseValue}`,
      turnNumber: state.turnNumber + 1,
      log: [...state.log, logEntry],
    };
  }

  // 2. LEGACY / DIRECT BID
  if (move.type === 'BID') {
    const handCard = player.hand.find((c) => c.id === move.handCardId);
    if (!handCard) {
      throw new GameError('Card not in hand', 'ILLEGAL_MOVE');
    }
    if (getCardNumericValue(handCard) !== move.houseValue) {
      throw new GameError('Bid card does not match house value', 'ILLEGAL_MOVE');
    }

    const newHouse: SeepHouse = {
      id: `house-${Date.now()}-${move.houseValue}`,
      buildValue: move.houseValue,
      ownerPlayerIndex: playerIndex,
      ownerTeamIndex: teamIndex,
      isCemented: true,
      cards: [handCard],
    };

    const openingBid: OpeningBidInfo = {
      playerId: player.id,
      playerIndex,
      houseValue: move.houseValue,
      isCaptured: false,
      active: true,
    };

    const newFloor = createFloor(state.floor.looseCards, [newHouse]);
    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, hand: removeCardFromHand(p.hand, handCard.id) } : p,
    );

    return advanceTurnOrEndRound({
      ...state,
      players: updatedPlayers,
      floor: newFloor,
      phase: { type: 'playing' },
      openingBid,
      lastActionAnnouncement: `${player.name} bid ${move.houseValue}`,
      turnNumber: state.turnNumber + 1,
      log: [...state.log, `👑 ${player.name} bid house of ${move.houseValue}`],
    });
  }

  // 3. CAPTURE
  if (move.type === 'CAPTURE') {
    const handCard = player.hand.find((c) => c.id === move.handCardId);
    if (!handCard) {
      throw new GameError('Card not in hand', 'ILLEGAL_MOVE');
    }

    const cardVal = getCardNumericValue(handCard);
    const itemIds = move.itemIds ?? [
      ...(move.capturedLooseCardIds ?? []),
      ...(move.capturedHouseIds ?? []),
    ];
    const itemIdSet = new Set(itemIds);

    const capturedItems = state.floor.items.filter((i) => itemIdSet.has(i.id));
    if (capturedItems.length === 0) {
      throw new GameError('No valid floor items captured', 'ILLEGAL_MOVE');
    }

    // Partition verification: captured items must cleanly partition into cardVal
    if (!canPartitionIntoTarget(capturedItems, cardVal)) {
      throw new GameError(`Captured items do not partition into ${cardVal}`, 'ILLEGAL_MOVE');
    }

    const remainingItems = state.floor.items.filter((i) => !itemIdSet.has(i.id));
    const capturedLoose = capturedItems.filter((i) => i.type === 'loose').map((i) => i.card);
    const capturedHouses = capturedItems.filter((i) => i.type === 'house').map((i) => i.house);
    const houseCards = capturedHouses.flatMap((h) => h.cards);
    const allCapturedCards = [handCard, ...capturedLoose, ...houseCards];

    // Check Seep (floor cleared completely)
    const isRoundEndTurn = state.players.every((p, idx) =>
      idx === playerIndex ? p.hand.length === 1 : p.hand.length === 0,
    );
    const wasSeep = remainingItems.length === 0 && !isRoundEndTurn;

    // Check Opening Seep
    const isOpeningMove = state.phase.type === 'bidding';
    const isOpeningSeep = wasSeep && isOpeningMove;

    // Seep & Takedown Accounting
    let updatedTeams = [...state.teams];
    let seepAnnouncement = '';

    if (wasSeep) {
      const currentTeam = updatedTeams[teamIndex]!;

      if (isOpeningSeep && ruleset.openingSeepPermanent) {
        // Permanent opening seep
        updatedTeams[teamIndex] = {
          ...currentTeam,
          permanentSeep: true,
          seepCount: currentTeam.seepCount + 1,
          roundScore: currentTeam.roundScore + ruleset.openingSeepBonus,
        };
        seepAnnouncement = ` 🌟 OPENING SEEP! (+${ruleset.openingSeepBonus} pts permanent)`;
      } else {
        // Takedown check: cancel opponent's active seep if takedown is enabled
        let isTakedown = false;
        let downedAnnouncement = '';

        if (ruleset.takedownEnabled) {
          for (let ti = 0; ti < updatedTeams.length; ti++) {
            if (ti !== teamIndex && updatedTeams[ti]!.activeSeeps > 0) {
              const opp = updatedTeams[ti]!;
              updatedTeams[ti] = {
                ...opp,
                activeSeeps: opp.activeSeeps - 1,
                downedSeeps: opp.downedSeeps + 1,
                roundScore: opp.roundScore - ruleset.laterSeepBonus,
                seepCount: opp.seepCount - 1,
              };
              isTakedown = true;
              downedAnnouncement = ` 💥 TAKEDOWN! Cancelled ${opp.name}'s seep! No seep awarded to either team.`;
              if (ruleset.takedownAwardsBonus) {
                updatedTeams[teamIndex] = {
                  ...updatedTeams[teamIndex]!,
                  roundScore: updatedTeams[teamIndex]!.roundScore + ruleset.laterSeepBonus,
                };
              }
              break;
            }
          }
        }

        if (isTakedown) {
          // If a takedown occurred, it cancelled the opponent's seep.
          // In Seep, the downing team does NOT receive a new seep — both teams now have 0 active seeps.
          seepAnnouncement = downedAnnouncement;
        } else {
          // Normal Seep (only awarded when opponent had no active seep to down)
          const teamAfterTakedown = updatedTeams[teamIndex]!;
          if (teamAfterTakedown.activeSeeps < ruleset.maxAdditionalSeeps) {
            updatedTeams[teamIndex] = {
              ...teamAfterTakedown,
              activeSeeps: teamAfterTakedown.activeSeeps + 1,
              seepCount: teamAfterTakedown.seepCount + 1,
              roundScore: teamAfterTakedown.roundScore + ruleset.laterSeepBonus,
            };
            seepAnnouncement = ` 🌟 SEEP! (+${ruleset.laterSeepBonus} pts)`;
          } else if (ruleset.thirdSeepDownsBoth && teamAfterTakedown.activeSeeps >= 2) {
            // 3rd Seep Penalty: Attempting a 3rd seep with 2 active seeps downs BOTH active seeps!
            const bonusDeduction = 2 * ruleset.laterSeepBonus;
            updatedTeams[teamIndex] = {
              ...teamAfterTakedown,
              activeSeeps: 0,
              downedSeeps: teamAfterTakedown.downedSeeps + 2,
              seepCount: Math.max(0, teamAfterTakedown.seepCount - 2),
              roundScore: teamAfterTakedown.roundScore - bonusDeduction,
            };
            seepAnnouncement = ` 💥 3RD SEEP PENALTY! ${teamAfterTakedown.name} attempted a 3rd seep with 2 active seeps — both seeps are downed! (-${bonusDeduction} pts)`;
          } else {
            seepAnnouncement = ` 🌟 Floor cleared! (Seep cap reached)`;
          }
        }
      }
    }

    // Add captured cards to team pile
    updatedTeams[teamIndex] = {
      ...updatedTeams[teamIndex]!,
      capturedCards: [...updatedTeams[teamIndex]!.capturedCards, ...allCapturedCards],
    };

    // Check if the opening bid house was captured
    let updatedOpeningBid = state.openingBid;
    if (state.openingBid && capturedHouses.some((h) => h.buildValue === state.openingBid!.houseValue)) {
      updatedOpeningBid = {
        ...state.openingBid,
        isCaptured: true,
        active: false,
      };
    }

    const remainingLoose = remainingItems.filter((i) => i.type === 'loose').map((i) => i.card);
    const remainingHouses = remainingItems.filter((i) => i.type === 'house').map((i) => i.house);
    const newFloor = createFloor(remainingLoose, remainingHouses);

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, hand: removeCardFromHand(p.hand, handCard.id) } : p,
    );

    const logEntry = `🃏 ${player.name} captured ${allCapturedCards.length} cards with ${handCard.rank}${handCard.suit}.${seepAnnouncement}`;

    return advanceTurnOrEndRound({
      ...state,
      players: updatedPlayers,
      teams: updatedTeams,
      floor: newFloor,
      phase: { type: 'playing' },
      openingBid: updatedOpeningBid,
      firstSeepOccurred: state.firstSeepOccurred || wasSeep,
      lastCapturePlayerIndex: playerIndex,
      lastActionAnnouncement: `${player.name} captured ${allCapturedCards.length} cards!${seepAnnouncement}`,
      forcedReason: null,
      turnNumber: state.turnNumber + 1,
      log: [...state.log, logEntry],
    });
  }

  // 4. BUILD / BUILD_HOUSE
  if (move.type === 'BUILD' || move.type === 'BUILD_HOUSE') {
    const handCard = player.hand.find((c) => c.id === move.handCardId);
    if (!handCard) {
      throw new GameError('Card not in hand', 'ILLEGAL_MOVE');
    }

    const targetVal = move.targetValue;
    const floorItemIds = 'floorItemIds' in move ? move.floorItemIds : move.floorCardIds;
    const floorItemIdSet = new Set(floorItemIds);

    const chosenFloorItems = state.floor.items.filter((i) => floorItemIdSet.has(i.id));
    const chosenCards = chosenFloorItems
      .filter((i) => i.type === 'loose')
      .map((i) => (i as { type: 'loose'; card: Card }).card);

    let houseCards = [handCard, ...chosenCards];
    let remainingHouses = state.floor.houses;

    // Check extending an existing house
    if ('extendHouseId' in move && move.extendHouseId) {
      const houseToExtend = state.floor.houses.find((h) => h.id === move.extendHouseId);
      if (!houseToExtend) {
        throw new GameError('House to extend not found', 'ILLEGAL_MOVE');
      }
      if (houseToExtend.isCemented) {
        throw new GameError('Cannot extend a cemented house', 'ILLEGAL_MOVE');
      }
      if (state.floor.houses.some((h) => h.id !== move.extendHouseId && h.buildValue === targetVal)) {
        throw new GameError(`A house of ${targetVal} already exists on the table`, 'ILLEGAL_MOVE');
      }
      houseCards = [...houseToExtend.cards, handCard];
      remainingHouses = state.floor.houses.filter((h) => h.id !== move.extendHouseId);
    } else {
      // In Seep, at most ruleset.maxHousesOnFloor houses can be built at once on the table
      if (state.floor.houses.length >= ruleset.maxHousesOnFloor) {
        throw new GameError(`At most ${ruleset.maxHousesOnFloor} houses can be built at once on the table`, 'ILLEGAL_MOVE');
      }
      if (state.floor.houses.some((h) => h.buildValue === targetVal)) {
        throw new GameError(`A house of ${targetVal} already exists on the table`, 'ILLEGAL_MOVE');
      }
    }

    const cardVal = getCardNumericValue(handCard);
    const chosenSum = chosenCards.reduce((s, c) => s + getCardNumericValue(c), 0);
    const isCemented =
      (cardVal === targetVal && chosenCards.length > 0) ||
      (cardVal + chosenSum >= targetVal * 2);

    const newHouse: SeepHouse = {
      id: `house-${Date.now()}-${targetVal}`,
      buildValue: targetVal,
      ownerPlayerIndex: playerIndex,
      ownerTeamIndex: teamIndex,
      isCemented: isCemented || (chosenCards.length === 0 && !('extendHouseId' in move && move.extendHouseId)),
      cards: houseCards,
    };

    const remainingLoose = state.floor.looseCards.filter((c) => !floorItemIdSet.has(c.id));
    const newFloor = createFloor(remainingLoose, [...remainingHouses, newHouse]);

    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, hand: removeCardFromHand(p.hand, handCard.id) } : p,
    );

    const logEntry = isCemented
      ? `🏠 ${player.name} built and cemented a house of ${targetVal}!`
      : `🏠 ${player.name} built a house of ${targetVal}.`;
    return advanceTurnOrEndRound({
      ...state,
      players: updatedPlayers,
      floor: newFloor,
      phase: { type: 'playing' },
      lastActionAnnouncement: `${player.name} built house of ${targetVal}`,
      forcedReason: null,
      turnNumber: state.turnNumber + 1,
      log: [...state.log, logEntry],
    });
  }

  // 5. CEMENT_HOUSE
  if (move.type === 'CEMENT_HOUSE') {
    const handCard = player.hand.find((c) => c.id === move.handCardId);
    if (!handCard) {
      throw new GameError('Card not in hand', 'ILLEGAL_MOVE');
    }

    const targetHouse = state.floor.houses.find((h) => h.id === move.houseId);
    if (!targetHouse) {
      throw new GameError('Target house not found', 'ILLEGAL_MOVE');
    }

    const houseVal = targetHouse.buildValue;
    const isOwnHouse = targetHouse.ownerTeamIndex === teamIndex;
    const partnerIsOwner = isOwnHouse && targetHouse.ownerPlayerIndex !== playerIndex;
    const matchingCardsInHand = player.hand.filter((c) => getCardNumericValue(c) === houseVal);
    const cardVal = getCardNumericValue(handCard);

    if (cardVal === houseVal) {
      const minRequired = partnerIsOwner ? 1 : 2;
      if (matchingCardsInHand.length < minRequired) {
        throw new GameError(`Must retain a card of ${houseVal} in hand to cement this house`, 'ILLEGAL_MOVE');
      }
    } else if (cardVal < houseVal) {
      const hasHouseCard = partnerIsOwner || matchingCardsInHand.length >= 1;
      if (!hasHouseCard) {
        throw new GameError(`Cannot contribute to house of ${houseVal} without holding that card in hand`, 'ILLEGAL_MOVE');
      }
    } else {
      throw new GameError(`Card value ${cardVal} exceeds house value ${houseVal}`, 'ILLEGAL_MOVE');
    }

    const additionalCards = (move.additionalFloorCardIds ?? [])
      .map((id) => state.floor.looseCards.find((c) => c.id === id))
      .filter((c): c is Card => c !== undefined);

    if (cardVal === houseVal) {
      if (additionalCards.length > 0) {
        const floorItemsForCheck = additionalCards.map((c) => ({ type: 'loose' as const, id: c.id, card: c }));
        if (!canPartitionIntoTarget(floorItemsForCheck, houseVal)) {
          throw new GameError(`Additional floor cards must sum to multiples of ${houseVal}`, 'ILLEGAL_MOVE');
        }
      }
    } else if (cardVal < houseVal) {
      const additionalSum = additionalCards.reduce((s, c) => s + getCardNumericValue(c), 0);
      const totalContributed = cardVal + additionalSum;
      if (totalContributed < houseVal || totalContributed % houseVal !== 0) {
        throw new GameError(`Played card and floor cards must sum to ${houseVal}`, 'ILLEGAL_MOVE');
      }
    }

    const updatedHouses = state.floor.houses.map((h) =>
      h.id === move.houseId
        ? {
            ...h,
            isCemented: true,
            cards: [...h.cards, handCard, ...additionalCards],
            ...(!isOwnHouse ? { coOwnerPlayerIndex: playerIndex, coOwnerTeamIndex: teamIndex } : {}),
          }
        : h,
    );

    const remainingLooseCards = state.floor.looseCards.filter(
      (c) => !(move.additionalFloorCardIds ?? []).includes(c.id),
    );

    const newFloor = createFloor(remainingLooseCards, updatedHouses);
    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, hand: removeCardFromHand(p.hand, handCard.id) } : p,
    );

    const logEntry = `🔒 ${player.name} contributed ${handCard.rank}${handCard.suit} to and cemented house of ${targetHouse.buildValue}!`;
    return advanceTurnOrEndRound({
      ...state,
      players: updatedPlayers,
      floor: newFloor,
      phase: { type: 'playing' },
      lastActionAnnouncement: `${player.name} cemented house of ${targetHouse.buildValue}!`,
      forcedReason: null,
      turnNumber: state.turnNumber + 1,
      log: [...state.log, logEntry],
    });
  }

  // 6. TRAIL / THROW
  if (move.type === 'TRAIL' || move.type === 'THROW') {
    const cardToTrail = player.hand.find((c) => c.id === move.cardId);
    if (!cardToTrail) {
      throw new GameError('Card not in hand', 'ILLEGAL_MOVE');
    }

    const newFloor = createFloor([...state.floor.looseCards, cardToTrail], state.floor.houses);
    const updatedPlayers = state.players.map((p, idx) =>
      idx === playerIndex ? { ...p, hand: removeCardFromHand(p.hand, move.cardId) } : p,
    );

    const logEntry = `⬇️ ${player.name} trailed ${cardToTrail.rank}${cardToTrail.suit} to the floor.`;
    return advanceTurnOrEndRound({
      ...state,
      players: updatedPlayers,
      floor: newFloor,
      phase: { type: 'playing' },
      lastActionAnnouncement: `${player.name} trailed ${cardToTrail.rank}${cardToTrail.suit}`,
      forcedReason: null,
      turnNumber: state.turnNumber + 1,
      log: [...state.log, logEntry],
    });
  }

  throw new GameError('Unknown move type', 'ILLEGAL_MOVE');
}

// ─── Turn Advance & Batch Deal / Round End ──────────────────────────────────

function advanceTurnOrEndRound(state: SeepGameState): SeepGameState {
  const numPlayers = state.players.length;
  const undealt = state.undealtDeck ?? [];

  // Deal all remaining cards immediately after the first move if dealRemainingCards is 'after_first_move'
  if (
    state.ruleset.dealRemainingCards === 'after_first_move' &&
    undealt.length > 0 &&
    state.phase.type === 'playing'
  ) {
    const cardsPerPlayer = Math.floor(undealt.length / numPlayers);
    let ptr = 0;
    const updatedPlayers = state.players.map((p) => {
      const moreCards = undealt.slice(ptr, ptr + cardsPerPlayer);
      ptr += cardsPerPlayer;
      return { ...p, hand: [...p.hand, ...moreCards] };
    });

    const nextUndealt = undealt.slice(ptr);
    const nextPlayer = (state.currentPlayerIndex + 1) % numPlayers;

    return {
      ...state,
      players: updatedPlayers,
      currentPlayerIndex: nextPlayer,
      undealtDeck: nextUndealt,
      log: [
        ...state.log,
        `🃏 Remaining cards dealt to all players (${cardsPerPlayer} cards each, ${updatedPlayers[0]?.hand.length} in hand). Full hands ready!`,
      ],
    };
  }

  const allHandsEmpty = state.players.every((p) => p.hand.length === 0);

  // If all hands are empty:
  if (allHandsEmpty) {
    // 1. If remaining cards exist in undealt deck, deal the next batch of 4 to each player (batches_of_four mode)
    if (undealt.length >= numPlayers * 4) {
      let ptr = 0;
      const updatedPlayers = state.players.map((p) => {
        const nextBatch = undealt.slice(ptr, ptr + 4);
        ptr += 4;
        return { ...p, hand: nextBatch };
      });

      const nextUndealt = undealt.slice(ptr);
      const nextPlayer = (state.currentPlayerIndex + 1) % numPlayers;

      return {
        ...state,
        players: updatedPlayers,
        currentPlayerIndex: nextPlayer,
        undealtDeck: nextUndealt,
        log: [
          ...state.log,
          `🃏 Next batch of 4 cards dealt to all ${numPlayers} players (${nextUndealt.length} cards remaining in deck).`,
        ],
      };
    }

    // 2. Otherwise, Hand/Round is over! All 52 cards played.
    // Award leftover floor cards to last capturing team
    let finalTeams = [...state.teams];
    let leftoverLog = '';

    if (state.ruleset.leftoverFloorGoesToLastCapturer) {
      const lastPlayer =
        state.lastCapturePlayerIndex !== null
          ? state.players[state.lastCapturePlayerIndex]!
          : state.players[numPlayers - 1]!;
      const lastTeamIdx = lastPlayer.teamIndex;
      const allLeftoverCards = [
        ...state.floor.looseCards,
        ...state.floor.houses.flatMap((h) => h.cards),
      ];

      if (allLeftoverCards.length > 0) {
        finalTeams[lastTeamIdx] = {
          ...finalTeams[lastTeamIdx]!,
          capturedCards: [...finalTeams[lastTeamIdx]!.capturedCards, ...allLeftoverCards],
        };
        leftoverLog = ` 🧹 ${allLeftoverCards.length} leftover table cards collected by ${lastPlayer.name} (${finalTeams[lastTeamIdx]!.name}) for eating the last hand.`;
      }
    }

    // Calculate final scores for the round
    // Total card points across all teams MUST be exactly 100
    finalTeams = finalTeams.map((team) => {
      const cardPoints = countCapturedCardPoints(team.capturedCards);
      const totalRoundScore = cardPoints + team.roundScore; // card points + net seep bonus
      return {
        ...team,
        roundScore: totalRoundScore,
        totalScore: team.totalScore + totalRoundScore,
      };
    });

    // Check if match won
    const target = state.ruleset.targetScore;
    const winningTeam = finalTeams.find((t) => t.totalScore >= target);

    const emptyFloor = createFloor([], []);

    if (winningTeam) {
      return {
        ...state,
        teams: finalTeams,
        floor: emptyFloor,
        phase: { type: 'game_over', matchWinnerTeamIndex: winningTeam.teamIndex },
        lastActionAnnouncement: `🏆 Match Over! ${winningTeam.name} won with ${winningTeam.totalScore} points!`,
        log: [
          ...state.log,
          `🏁 Match completed!${leftoverLog} Winner: ${winningTeam.name} (${winningTeam.totalScore} pts).`,
        ],
      };
    }

    const roundLeader = [...finalTeams].sort((a, b) => b.roundScore - a.roundScore)[0]!;
    return {
      ...state,
      teams: finalTeams,
      floor: emptyFloor,
      phase: { type: 'round_over', winnerTeamIndex: roundLeader.teamIndex },
      lastActionAnnouncement: `Round finished! ${roundLeader.name} scored ${roundLeader.roundScore} pts!`,
      log: [...state.log, `🏁 Round finished!${leftoverLog}`],
    };
  }

  // Normal turn advance (clockwise)
  const nextPlayer = (state.currentPlayerIndex + 1) % numPlayers;
  return {
    ...state,
    currentPlayerIndex: nextPlayer,
  };
}

// ─── Exported Engine Interface ──────────────────────────────────────────────

export function startNextRound(state: SeepGameState, seed?: number): SeepGameState {
  const numPlayers = state.players.length;
  const nextOpeningBidderIndex = (state.bidderIndex + 1) % numPlayers;

  // Fresh 52 card deck
  const rng = createRng(seed ?? (Date.now() + nextOpeningBidderIndex));
  let fullDeck = shuffle(buildDeck(1), rng);

  // Court cards floor handling
  const isCourt = (c: Card) => ['J', 'Q', 'K'].includes(c.rank);
  if (state.ruleset.courtCardsOnInitialFloor === 'redeal') {
    let attempts = 0;
    while (fullDeck.slice(0, 4).some(isCourt) && attempts < 100) {
      fullDeck = shuffle(fullDeck, rng);
      attempts++;
    }
  }

  const initialFloorCards = fullDeck.slice(0, 4);
  let deckPointer = 4;

  const players: SeepPlayer[] = state.players.map((p) => {
    const hand = fullDeck.slice(deckPointer, deckPointer + 4);
    deckPointer += 4;
    return {
      ...p,
      hand,
    };
  });

  const undealtDeck = fullDeck.slice(deckPointer);

  const teams: SeepTeam[] = state.teams.map((t) => ({
    ...t,
    capturedCards: [],
    permanentSeep: false,
    activeSeeps: 0,
    downedSeeps: 0,
    seepCount: 0,
    roundScore: 0,
  }));

  const floor = createFloor(initialFloorCards, []);

  return {
    ...state,
    players,
    teams,
    currentPlayerIndex: nextOpeningBidderIndex,
    bidderIndex: nextOpeningBidderIndex,
    floor,
    phase: { type: 'bidding' },
    openingBid: null,
    firstSeepOccurred: false,
    lastCapturePlayerIndex: null,
    lastActionAnnouncement: `Round ${state.roundNumber + 1}: ${state.players[nextOpeningBidderIndex]!.name} must declare an opening bid (9–13).`,
    forcedReason: null,
    roundNumber: state.roundNumber + 1,
    turnNumber: 0,
    log: [
      ...state.log,
      `🔄 Round ${state.roundNumber + 1} started! ${state.players[nextOpeningBidderIndex]!.name} bids opening house.`,
    ],
    undealtDeck,
  };
}

export const SeepEngine: GameEngine<SeepGameState, SeepMove, SeepRuleset> & {
  getVisibleState: (state: SeepGameState, forPlayerId: PlayerId) => SeepGameState;
  startNextRound: (state: SeepGameState, seed?: number) => SeepGameState;
} = {
  createGame,
  getLegalMoves,
  applyMove,
  isGameOver: (state: SeepGameState) => state.phase.type === 'game_over',
  getScores: (state: SeepGameState) => {
    const scores: Record<PlayerId, number> = {};
    for (const p of state.players) {
      scores[p.id] = state.teams[p.teamIndex]?.totalScore ?? 0;
    }
    return scores;
  },
  getVisibleState: getSeepVisibleState,
  startNextRound,
};
