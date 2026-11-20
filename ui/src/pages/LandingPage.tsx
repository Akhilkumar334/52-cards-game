import React, { useState } from 'react';
import type { GameType } from '../network/types';

interface LandingPageProps {
  onSelectGame: (
    game: GameType,
    mode: 'bots' | 'room',
    roomAction?: 'create' | 'join',
    roomCode?: string,
  ) => void;
  onOpenHowToPlay?: (game: GameType) => void;
}

interface GameOption {
  id: GameType;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bgGradient: string;
}

const GAMES: GameOption[] = [
  {
    id: 'bluff',
    title: 'Bluff',
    subtitle: 'Cheat / 420',
    icon: '🃏',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(180, 83, 9, 0.08) 100%)',
  },
  {
    id: 'thulla',
    title: 'Thulla',
    subtitle: 'Bhabhi / Get Away',
    icon: '⚡',
    color: '#38bdf8',
    bgGradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(14, 116, 144, 0.08) 100%)',
  },
  {
    id: 'seep',
    title: 'Seep',
    subtitle: 'Sweep / 100-Point',
    icon: '🏰',
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(4, 120, 87, 0.08) 100%)',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectGame }) => {
  const [quickCodeInput, setQuickCodeInput] = useState('');

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickCodeInput.trim().toUpperCase();
    if (!clean) return;

    let targetGame: GameType = 'bluff';
    if (clean.startsWith('THULLA')) targetGame = 'thulla';
    else if (clean.startsWith('SEEP')) targetGame = 'seep';

    onSelectGame(targetGame, 'room', 'join', clean);
  };

  return (
    <div
      style={{
        maxWidth: 1040,
        margin: '0 auto',
        padding: '24px 16px 40px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
      }}
    >
      {/* Clean Minimal Header */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)',
            fontWeight: 800,
            color: '#f8fafc',
            letterSpacing: '0.04em',
            margin: 0,
          }}
        >
          ♠ 52 CARDS
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: 0 }}>
          Play offline with smart bots or create a table room for friends
        </p>
      </div>

      {/* Quick Join Table Bar */}
      <form
        onSubmit={handleQuickJoin}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(15, 23, 42, 0.7)',
          padding: '6px 10px',
          borderRadius: 24,
          border: '1px solid rgba(255, 255, 255, 0.12)',
          maxWidth: 420,
          width: '100%',
        }}
      >
        <span style={{ fontSize: '1.1rem', paddingLeft: 6 }}>🎟️</span>
        <input
          type="text"
          placeholder="Enter Room Code..."
          value={quickCodeInput}
          onChange={(e) => setQuickCodeInput(e.target.value.toUpperCase())}
          maxLength={12}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#facc15',
            fontSize: '0.88rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!quickCodeInput.trim()}
          style={{
            background: quickCodeInput.trim()
              ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
              : 'rgba(255, 255, 255, 0.08)',
            color: quickCodeInput.trim() ? '#fff' : '#64748b',
            padding: '7px 16px',
            borderRadius: 18,
            fontSize: '0.82rem',
            fontWeight: 700,
            border: 'none',
            cursor: quickCodeInput.trim() ? 'pointer' : 'default',
          }}
        >
          Join Table
        </button>
      </form>

      {/* 3 Plain & Clear Game Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 18,
          width: '100%',
          maxWidth: 960,
        }}
      >
        {GAMES.map((game) => (
          <div
            key={game.id}
            className="glass-panel"
            style={{
              borderRadius: 16,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 16,
              background: game.bgGradient,
              border: `1px solid ${game.color}33`,
            }}
          >
            {/* Game Icon & Title */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  fontSize: '2.5rem',
                  lineHeight: 1,
                  filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))',
                }}
              >
                {game.icon}
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.45rem',
                  fontWeight: 700,
                  color: '#f8fafc',
                  margin: 0,
                }}
              >
                {game.title}
              </h2>
              <span style={{ color: game.color, fontSize: '0.82rem', fontWeight: 600 }}>
                {game.subtitle}
              </span>
            </div>

            {/* Direct 2 Action Buttons */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                width: '100%',
                marginTop: 6,
              }}
            >
              <button
                type="button"
                onClick={() => onSelectGame(game.id, 'bots')}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  padding: '11px 16px',
                  borderRadius: 10,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <span>🤖</span>
                <span>Play with Bots</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectGame(game.id, 'room', 'create')}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: '#fff',
                  padding: '11px 16px',
                  borderRadius: 10,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <span>🌐</span>
                <span>Play with Friends (Room)</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
