import React, { useState } from 'react';
import type { Card as CardType, Rank, Suit } from '@cards/engine';
import { Card } from '../shared/Card';

export interface CardFanProps {
  cards: readonly CardType[];
  selectedCardIds: readonly string[];
  legalCardIds?: readonly string[];
  maxSelectable?: number;
  onCardClick: (cardId: string) => void;
  disabled?: boolean;
}

const RANK_ORDER_MAP: Record<Rank, number> = {
  A: 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
  '9': 8,
  T: 9,
  J: 10,
  Q: 11,
  K: 12,
};

const SUIT_ORDER_MAP: Record<Suit, number> = {
  S: 0,
  H: 1,
  C: 2,
  D: 3,
};

export const CardFan: React.FC<CardFanProps> = ({
  cards,
  selectedCardIds,
  legalCardIds,
  maxSelectable = 4,
  onCardClick,
  disabled = false,
}) => {
  const [viewMode, setViewMode] = useState<'fan' | 'grid'>('fan');
  const [sortMode, setSortMode] = useState<'rank' | 'suit'>('rank');
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  if (cards.length === 0) {
    return (
      <div
        style={{
          padding: '16px 24px',
          color: '#94a3b8',
          fontSize: '0.9rem',
          fontStyle: 'italic',
        }}
      >
        No cards in hand
      </div>
    );
  }

  // Sort cards based on active sort mode
  const sortedCards = [...cards].sort((a, b) => {
    if (sortMode === 'rank') {
      const diff = RANK_ORDER_MAP[a.rank] - RANK_ORDER_MAP[b.rank];
      if (diff !== 0) return diff;
      return SUIT_ORDER_MAP[a.suit] - SUIT_ORDER_MAP[b.suit];
    } else {
      const diff = SUIT_ORDER_MAP[a.suit] - SUIT_ORDER_MAP[b.suit];
      if (diff !== 0) return diff;
      return RANK_ORDER_MAP[a.rank] - RANK_ORDER_MAP[b.rank];
    }
  });

  // Only consider selected IDs that are actually present in the provided cards
  const validSelectedIds = selectedCardIds.filter((id) => cards.some((c) => c.id === id));

  const total = sortedCards.length;
  const maxSpreadWidth = Math.min(1080, window.innerWidth - 60);
  const cardWidth = 78;
  const availableSpace = maxSpreadWidth - cardWidth;
  const overlapSpacing = total > 1 ? Math.min(64, Math.max(38, availableSpace / (total - 1))) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 6 }}>
      {/* Hand Controls: Sort and View mode toggles */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: maxSpreadWidth,
          padding: '0 8px',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>
            Hand ({cards.length}) • Selected: {validSelectedIds.length}/{maxSelectable}
          </span>
          {disabled && (
            <span style={{ color: '#64748b', fontStyle: 'italic' }}>
              (Inspect only — not your play turn)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setSortMode(sortMode === 'rank' ? 'suit' : 'rank')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: '0.72rem',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            Sort: {sortMode === 'rank' ? 'By Rank (A-K)' : 'By Suit (♠♥♣♦)'}
          </button>

          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'fan' ? 'grid' : 'fan')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: '0.72rem',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            {viewMode === 'fan' ? '⊞ Flat View' : '⌒ Fan View'}
          </button>
        </div>
      </div>

      {/* Grid View — Every card completely visible with zero obstruction */}
      {viewMode === 'grid' ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            maxWidth: maxSpreadWidth,
            padding: '8px 12px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {sortedCards.map((card) => {
            const isSelected = validSelectedIds.includes(card.id);
            const canSelectThisCard = maxSelectable === 1 || isSelected || validSelectedIds.length < maxSelectable;
            const isCardLegal = !legalCardIds || legalCardIds.includes(card.id);
            const isCardDisabled = disabled || !canSelectThisCard || !isCardLegal;

            return (
              <div
                key={card.id}
                style={{
                  transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: isSelected ? 'translateY(-10px) scale(1.05)' : 'none',
                }}
              >
                <Card
                  card={card}
                  selected={isSelected}
                  disabled={isCardDisabled}
                  onClick={() => {
                    if (!disabled && canSelectThisCard && isCardLegal) {
                      onCardClick(card.id);
                    }
                  }}
                  size="md"
                />
              </div>
            );
          })}
        </div>
      ) : (
        /* Fan View — Curved casino arc with smart hover peek */
        <div
          className="card-fan-responsive"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            position: 'relative',
            height: 120,
            padding: '4px 16px 0 16px',
            maxWidth: maxSpreadWidth,
            margin: '0 auto',
          }}
        >
          {sortedCards.map((card, index) => {
            const isSelected = validSelectedIds.includes(card.id);
            const isCardLegal = !legalCardIds || legalCardIds.includes(card.id);
            const isHovered = hoveredCardId === card.id && isCardLegal;
            const canSelectThisCard = maxSelectable === 1 || isSelected || validSelectedIds.length < maxSelectable;
            const isCardDisabled = disabled || !canSelectThisCard || !isCardLegal;

            // Arc geometry
            const midpoint = (total - 1) / 2;
            const normalizedOffset = total > 1 ? (index - midpoint) / midpoint : 0;
            const rotationDeg = normalizedOffset * 6;
            const arcY = Math.abs(normalizedOffset) * 6;

            // When selected or hovered, lift and expand so card below is totally visible
            const liftY = isSelected ? -16 : isHovered ? -20 : arcY;
            const scale = isSelected || isHovered ? 1.05 : 1;
            const zIndex = isHovered ? 120 : isSelected ? 80 : index + 10;

            return (
              <div
                key={card.id}
                onMouseEnter={() => setHoveredCardId(card.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                style={{
                  position: 'relative',
                  marginLeft: index === 0 ? 0 : -cardWidth + overlapSpacing,
                  transform: `rotate(${rotationDeg}deg) translateY(${liftY}px) scale(${scale})`,
                  transformOrigin: 'bottom center',
                  zIndex,
                  transition:
                    'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), margin 0.2s ease, z-index 0.1s ease',
                }}
              >
                <Card
                  card={card}
                  selected={isSelected}
                  disabled={isCardDisabled}
                  onClick={() => {
                    if (!disabled && canSelectThisCard && isCardLegal) {
                      onCardClick(card.id);
                    }
                  }}
                  size="md"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
