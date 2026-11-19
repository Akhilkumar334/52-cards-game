import React from 'react';
import type { Card as CardType, Suit, Rank } from '@cards/engine';

export interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
  badge?: string;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

const SUIT_NAMES: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
};

const SUIT_COLORS: Record<Suit, string> = {
  S: '#1e293b',
  H: '#dc2626',
  D: '#dc2626',
  C: '#1e293b',
};

const DISPLAY_RANKS: Record<Rank, string> = {
  A: 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
};

export const Card: React.FC<CardProps> = ({
  card,
  faceDown = false,
  selected = false,
  disabled = false,
  size = 'md',
  onClick,
  className = '',
  badge,
}) => {
  const sizeStyles = {
    sm: { width: 56, height: 80, fontSize: '0.75rem', cornerPad: '3px 4px' },
    md: { width: 78, height: 114, fontSize: '0.95rem', cornerPad: '4px 6px' },
    lg: { width: 96, height: 140, fontSize: '1.15rem', cornerPad: '6px 8px' },
  }[size];

  if (faceDown || !card) {
    return (
      <div
        onClick={!disabled ? onClick : undefined}
        style={{
          width: sizeStyles.width,
          height: sizeStyles.height,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)',
          border: '2px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onClick && !disabled ? 'pointer' : 'default',
          userSelect: 'none',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        className={className}
      >
        <div
          style={{
            width: '84%',
            height: '86%',
            border: '1px dashed rgba(245, 197, 66, 0.6)',
            borderRadius: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'radial-gradient(circle, rgba(245, 197, 66, 0.15) 10%, transparent 10%) 0 0/10px 10px',
          }}
        >
          <span style={{ color: '#d4af37', fontSize: '1.2rem', opacity: 0.8 }}>♠</span>
        </div>
        {badge && (
          <span
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              background: '#e63946',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            }}
          >
            {badge}
          </span>
        )}
      </div>
    );
  }

  const isRed = card.suit === 'H' || card.suit === 'D';
  const color = isRed ? '#d90429' : '#111827';
  const symbol = SUIT_SYMBOLS[card.suit];
  const rankStr = DISPLAY_RANKS[card.rank];

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      style={{
        width: sizeStyles.width,
        height: sizeStyles.height,
        borderRadius: 8,
        backgroundColor: '#fafaf9',
        border: selected ? '2px solid #f59e0b' : '1px solid #d6d3d1',
        boxShadow: selected
          ? '0 0 16px rgba(245, 158, 11, 0.8), 0 8px 16px rgba(0, 0, 0, 0.4)'
          : '0 4px 10px rgba(0, 0, 0, 0.35)',
        transform: selected ? 'translateY(-14px)' : 'translateY(0)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: sizeStyles.cornerPad,
        cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
        userSelect: 'none',
        opacity: disabled ? 0.38 : 1,
        filter: disabled ? 'grayscale(55%) brightness(0.88)' : 'none',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, opacity 0.2s ease',
      }}
      className={className}
      title={`${rankStr} of ${SUIT_NAMES[card.suit]}`}
    >
      {/* Top Left Corner */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
        <span style={{ fontSize: sizeStyles.fontSize, fontWeight: 700, color }}>{rankStr}</span>
        <span style={{ fontSize: sizeStyles.fontSize, color }}>{symbol}</span>
      </div>

      {/* Center Emblem */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: size === 'lg' ? '2.4rem' : size === 'md' ? '1.8rem' : '1.2rem',
          color,
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      >
        {symbol}
      </div>

      {/* Bottom Right Corner (inverted) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1,
          transform: 'rotate(180deg)',
        }}
      >
        <span style={{ fontSize: sizeStyles.fontSize, fontWeight: 700, color }}>{rankStr}</span>
        <span style={{ fontSize: sizeStyles.fontSize, color }}>{symbol}</span>
      </div>

      {badge && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            background: '#e63946',
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 10,
            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
};
