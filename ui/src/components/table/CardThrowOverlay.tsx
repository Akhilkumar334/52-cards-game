import React from 'react';
import type { Card as CardType } from '@cards/engine';
import { Card } from '../shared/Card';

export interface CardThrowAction {
  id: string;
  // Thrower details
  throwerName: string;
  throwerAvatar?: string;
  throwerPosition: 'bottom' | 'top' | 'left' | 'right';
  cards: readonly CardType[];
  faceDown?: boolean;
  declaredRank?: string;
  actionText: string;

  // Eating details
  isEating?: boolean;
  eaterName?: string;
  eaterPosition?: 'bottom' | 'top' | 'left' | 'right';
  eaterTitle?: string;
  eatenCards?: readonly CardType[];
  isSeepClear?: boolean;

  // Challenge / Show reveal details
  isChallengeReveal?: boolean;
  wasLying?: boolean;
  unrevealedPileCount?: number;

  // Current animation phase
  phase: 'throwing' | 'eating' | 'vanishing';
}

export interface CardThrowOverlayProps {
  action: CardThrowAction | null;
}

export const CardThrowOverlay: React.FC<CardThrowOverlayProps> = ({ action }) => {
  if (!action) return null;

  const {
    throwerName,
    throwerAvatar = '🤖',
    throwerPosition,
    cards,
    faceDown,
    declaredRank,
    actionText,
    isEating,
    eaterName,
    eaterPosition = throwerPosition,
    eaterTitle,
    eatenCards = [],
    isSeepClear,
    isChallengeReveal,
    wasLying,
    unrevealedPileCount,
    phase,
  } = action;

  // Determine throw animation
  let throwAnim = 'throwFromTop 0.38s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards';
  if (throwerPosition === 'bottom') {
    throwAnim = 'throwFromBottom 0.38s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards';
  } else if (throwerPosition === 'left') {
    throwAnim = 'throwFromLeft 0.38s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards';
  } else if (throwerPosition === 'right') {
    throwAnim = 'throwFromRight 0.38s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards';
  }

  // Determine vanish animation
  let vanishAnim = 'eatVanishToTop 0.42s ease-in forwards';
  if (eaterPosition === 'bottom') {
    vanishAnim = 'eatVanishToBottom 0.42s ease-in forwards';
  } else if (eaterPosition === 'left') {
    vanishAnim = 'eatVanishToLeft 0.42s ease-in forwards';
  } else if (eaterPosition === 'right') {
    vanishAnim = 'eatVanishToRight 0.42s ease-in forwards';
  }

  const containerAnim =
    phase === 'vanishing' ? vanishAnim : phase === 'throwing' ? throwAnim : 'comicPop 0.3s ease-out forwards';

  // Total cards in eating cluster (avoid duplicates if thrown card is already in eatenCards)
  const allEatenCards: CardType[] = [...cards];
  for (const c of eatenCards) {
    if (!allEatenCards.some((item) => item.id === c.id)) {
      allEatenCards.push(c);
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 90,
      }}
    >
      <div
        key={`${action.id}-${phase}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          animation: containerAnim,
        }}
      >
        {/* 1. EATING / REVEAL STAGE */}
        {phase !== 'throwing' && isEating ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              background: isChallengeReveal
                ? wasLying
                  ? 'linear-gradient(135deg, rgba(30, 10, 15, 0.98) 0%, rgba(127, 29, 29, 0.98) 100%)'
                  : 'linear-gradient(135deg, rgba(6, 40, 25, 0.98) 0%, rgba(6, 78, 59, 0.98) 100%)'
                : isSeepClear
                ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.95) 0%, rgba(180, 83, 9, 0.95) 100%)'
                : 'linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(6, 78, 59, 0.96) 100%)',
              border: isChallengeReveal
                ? wasLying
                  ? '3px solid #ef4444'
                  : '3px solid #10b981'
                : isSeepClear
                ? '3px solid #fde047'
                : '2px solid rgba(250, 204, 21, 0.8)',
              borderRadius: 22,
              padding: isChallengeReveal ? '14px 28px' : '12px 24px',
              boxShadow: isChallengeReveal
                ? wasLying
                  ? '0 0 50px rgba(239, 68, 68, 0.85), 0 10px 30px rgba(0,0,0,0.85)'
                  : '0 0 50px rgba(16, 185, 129, 0.85), 0 10px 30px rgba(0,0,0,0.85)'
                : isSeepClear
                ? '0 0 50px rgba(245, 158, 11, 0.9), 0 10px 30px rgba(0,0,0,0.8)'
                : '0 0 35px rgba(16, 185, 129, 0.7), 0 8px 25px rgba(0,0,0,0.8)',
            }}
          >
            {/* Eating Banner Header */}
            <div
              style={{
                color: isChallengeReveal
                  ? wasLying
                    ? '#fca5a5'
                    : '#86efac'
                  : isSeepClear
                  ? '#fff'
                  : '#facc15',
                fontWeight: 900,
                fontSize: isSeepClear || isChallengeReveal ? '1.18rem' : '1.05rem',
                letterSpacing: '0.04em',
                textShadow: '0 2px 6px rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{isChallengeReveal ? (wasLying ? '🚨' : '✅') : isSeepClear ? '🌟' : '🍽️'}</span>
              <span>{eaterTitle ?? `${eaterName ?? throwerName} EATS ${allEatenCards.length} Cards!`}</span>
            </div>

            {/* Display Cluster of Cards */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                maxWidth: 480,
              }}
            >
              {allEatenCards.slice(0, 8).map((c, idx) => (
                <div
                  key={c.id ?? idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      transform: isChallengeReveal
                        ? 'scale(1.05)'
                        : `rotate(${((idx * 11) % 15) - 7}deg) scale(0.92)`,
                      filter: isChallengeReveal
                        ? wasLying
                          ? 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.8))'
                          : 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.8))'
                        : 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))',
                    }}
                  >
                    <Card card={c} size={isChallengeReveal ? 'md' : 'sm'} />
                  </div>
                  {isChallengeReveal && declaredRank && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: c.rank === declaredRank ? '#86efac' : '#fca5a5',
                        background: 'rgba(0,0,0,0.7)',
                        padding: '2px 6px',
                        borderRadius: 6,
                        border: `1px solid ${c.rank === declaredRank ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                      }}
                    >
                      {c.rank === declaredRank ? '✓ Matched Claim' : `✗ Actually ${c.rank}`}
                    </span>
                  )}
                </div>
              ))}

              {allEatenCards.length > 8 && (
                <div
                  style={{
                    background: '#facc15',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    padding: '4px 8px',
                    borderRadius: 12,
                  }}
                >
                  +{allEatenCards.length - 8} more
                </div>
              )}

              {/* If there were older unrevealed cards in the pile, show them face-down */}
              {isChallengeReveal && unrevealedPileCount !== undefined && unrevealedPileCount > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    marginLeft: 6,
                  }}
                >
                  <div
                    style={{
                      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))',
                      transform: 'scale(0.88)',
                    }}
                  >
                    <Card faceDown size="sm" />
                  </div>
                  <span
                    style={{
                      background: 'rgba(0, 0, 0, 0.75)',
                      color: '#cbd5e1',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: 10,
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    +{unrevealedPileCount} hidden pile card{unrevealedPileCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 2. THROWING STAGE (Visible thrower pill + thrown cards) */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {/* Thrower Badge Pill */}
            <div
              style={{
                background:
                  throwerPosition === 'bottom'
                    ? 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)'
                    : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#fff',
                border: '2px solid rgba(250, 204, 21, 0.8)',
                boxShadow: '0 0 25px rgba(250, 204, 21, 0.6), 0 6px 18px rgba(0,0,0,0.6)',
                padding: '6px 18px',
                borderRadius: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.88rem',
                fontWeight: 800,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{throwerAvatar}</span>
              <span>{throwerName}</span>
              <span style={{ color: '#fef08a', fontWeight: 700 }}>{actionText}</span>
            </div>

            {/* Thrown Card(s) */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.7))',
              }}
            >
              {cards.map((c, idx) => (
                <div
                  key={c.id ?? idx}
                  style={{
                    transform: `rotate(${((idx * 9) % 15) - 7}deg)`,
                  }}
                >
                  <Card card={c} faceDown={faceDown} size="md" />
                </div>
              ))}
            </div>

            {/* Declared Rank in Bluff */}
            {declaredRank && (
              <div
                style={{
                  background: 'rgba(0,0,0,0.85)',
                  border: '1px solid #facc15',
                  color: '#facc15',
                  padding: '2px 10px',
                  borderRadius: 12,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                }}
              >
                Declared as {declaredRank === 'T' ? '10' : declaredRank}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
