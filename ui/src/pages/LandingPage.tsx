import React, { useState } from 'react';
import type { GameType } from '../network/types';

interface LandingPageProps {
  onSelectGame: (
    game: GameType,
    mode: 'bots' | 'room',
    roomAction?: 'create' | 'join',
    roomCode?: string,
  ) => void;
  onOpenHowToPlay: (game: GameType) => void;
}

interface GameCardInfo {
  id: GameType;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  gradient: string;
  badge: string;
  players: string;
  description: string;
  features: string[];
}

const GAMES: GameCardInfo[] = [
  {
    id: 'bluff',
    title: 'Bluff',
    subtitle: 'Cheat / I Doubt It / 420',
    icon: '🃏',
    accentColor: '#f59e0b',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(180, 83, 9, 0.1) 100%)',
    badge: 'Deception & Mind Games',
    players: '3–8 Players (Default 4)',
    description:
      'Place your cards face-down and declare their rank. Are you telling the truth or executing a brilliant bluff? Challenge opponents and make them swallow the entire pile!',
    features: ['Classic Table-Clear Rules', 'Sequential Rank Cycle', 'In-Turn & Out-of-Turn Calls'],
  },
  {
    id: 'thulla',
    title: 'Thulla',
    subtitle: 'Bhabhi / Get Away',
    icon: '⚡',
    accentColor: '#3b82f6',
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(29, 78, 216, 0.1) 100%)',
    badge: 'Fast Trick-Taking & Survival',
    players: '3–5 Players (Default 4)',
    description:
      'Shed all your cards to escape the table! Strictly follow suit; if void, slap a devastating Thulla penalty onto the trick leader. The last player left holding cards is crowned the Bhabhi!',
    features: ['Ace is High (A=14)', 'Thulla Penalty Slaps', 'Multi-Escape Finishes'],
  },
  {
    id: 'seep',
    title: 'Seep',
    subtitle: 'Sweep / 100-Point Partnership',
    icon: '🏰',
    accentColor: '#10b981',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(4, 120, 87, 0.1) 100%)',
    badge: 'North Indian Royal Classic',
    players: '2, 3 or 4 Players (2v2 Partnership)',
    description:
      'The authentic 100-point card accounting master game. Build and cement houses (9–13), score sweeps (+25/+50 pts), capture all 13 Spades and the precious 10 of Diamonds to reach 350 points!',
    features: ['Exact 100-Point Rule', 'House Building & Cementing', 'Compulsory Sweep Takedowns'],
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectGame, onOpenHowToPlay }) => {
  const [quickCodeInput, setQuickCodeInput] = useState('');
  const [hoveredCard, setHoveredCard] = useState<GameType | null>(null);

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
        maxWidth: 1280,
        margin: '0 auto',
        padding: '24px 20px 60px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 36,
      }}
    >
      {/* Hero Header */}
      <div
        style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          paddingTop: 16,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 16px',
            borderRadius: 20,
            background: 'rgba(212, 175, 55, 0.12)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            color: '#facc15',
            fontSize: '0.8rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          <span>♠</span>
          <span>THE ROYAL CASINO SUITE</span>
          <span>♠</span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
            fontWeight: 800,
            color: '#f8fafc',
            letterSpacing: '0.02em',
            lineHeight: 1.15,
            margin: 0,
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
          }}
        >
          Select Your Card Game
        </h1>

        <p
          style={{
            maxWidth: 680,
            color: '#94a3b8',
            fontSize: 'clamp(0.95rem, 1.6vw, 1.1rem)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Experience authentic Indian and casino card classics powered by pure deterministic engines.
          Play solo against smart AI bots or create a private room to challenge friends in real time.
        </p>
      </div>

      {/* Direct Room Code Quick Join Bar */}
      <div
        className="glass-panel"
        style={{
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.6) 100%)',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.4rem' }}>🎟️</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>
              Have a Room Code?
            </span>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Enter code from a friend to join their table instantly
            </span>
          </div>
        </div>

        <form onSubmit={handleQuickJoin} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={quickCodeInput}
            onChange={(e) => setQuickCodeInput(e.target.value.toUpperCase())}
            placeholder="e.g. BLUFF-784"
            maxLength={14}
            style={{
              background: '#0a0f18',
              border: '1px solid #334155',
              color: '#60a5fa',
              padding: '7px 12px',
              borderRadius: 6,
              fontSize: '0.9rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              width: 140,
              textAlign: 'center',
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
              padding: '7px 14px',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 700,
              boxShadow: quickCodeInput.trim() ? '0 2px 10px rgba(59, 130, 246, 0.4)' : 'none',
            }}
          >
            Join Table ➔
          </button>
        </form>
      </div>

      {/* 3 Game Selection Showcase Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
        }}
      >
        {GAMES.map((game) => {
          const isHovered = hoveredCard === game.id;

          return (
            <div
              key={game.id}
              className="glass-panel"
              onMouseEnter={() => setHoveredCard(game.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                borderRadius: 16,
                padding: '24px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                background: game.gradient,
                border: isHovered
                  ? `2px solid ${game.accentColor}`
                  : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: isHovered
                  ? `0 16px 40px rgba(0, 0, 0, 0.6), 0 0 30px ${game.accentColor}33`
                  : '0 8px 24px rgba(0, 0, 0, 0.35)',
                transform: isHovered ? 'translateY(-4px)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Header: Icon, Title, Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 12,
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: `1px solid ${game.accentColor}55`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.8rem',
                    }}
                  >
                    {game.icon}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: '#f8fafc',
                        margin: 0,
                      }}
                    >
                      {game.title}
                    </h2>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{game.subtitle}</span>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '3px 8px',
                    borderRadius: 12,
                    background: `${game.accentColor}22`,
                    color: game.accentColor,
                    border: `1px solid ${game.accentColor}44`,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {game.badge}
                </span>
              </div>

              {/* Player Count & Details */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: '0.78rem',
                  color: '#cbd5e1',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '6px 12px',
                  borderRadius: 8,
                }}
              >
                <span>👥 {game.players}</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => onOpenHowToPlay(game.id)}
                  style={{
                    background: 'transparent',
                    color: game.accentColor,
                    fontSize: '0.76rem',
                    textDecoration: 'underline',
                    padding: 0,
                    fontWeight: 600,
                  }}
                >
                  📖 Rules & Guide
                </button>
              </div>

              {/* Description */}
              <p
                style={{
                  fontSize: '0.86rem',
                  color: '#cbd5e1',
                  lineHeight: 1.5,
                  margin: 0,
                  flex: 1,
                }}
              >
                {game.description}
              </p>

              {/* Feature Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {game.features.map((feat) => (
                  <span
                    key={feat}
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      color: '#94a3b8',
                    }}
                  >
                    ✓ {feat}
                  </span>
                ))}
              </div>

              {/* Primary Action Buttons: Play with Bots vs Create Room */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  marginTop: 6,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {/* 1. Play with Bots Button */}
                <button
                  onClick={() => onSelectGame(game.id, 'bots')}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    cursor: 'pointer',
                  }}
                >
                  <span>🤖</span>
                  <span>Play with Bots</span>
                </button>

                {/* 2. Create / Join Room Button */}
                <button
                  onClick={() => onSelectGame(game.id, 'room', 'create')}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: '#fff',
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    cursor: 'pointer',
                  }}
                >
                  <span>🌐</span>
                  <span>Create Room</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature Highlights Banner */}
      <div
        className="glass-panel"
        style={{
          marginTop: 10,
          padding: '24px 28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20,
          border: '1px solid rgba(212, 175, 55, 0.2)',
          background: 'rgba(15, 23, 42, 0.6)',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ fontSize: '1.8rem' }}>🧠</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h4 style={{ margin: 0, color: '#facc15', fontSize: '0.95rem' }}>Deterministic AI Bots</h4>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.4 }}>
              Heuristics-driven bots inspecting only public visible state. Realistic thinking timers and table reaction bubbles.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ fontSize: '1.8rem' }}>⚡</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h4 style={{ margin: 0, color: '#60a5fa', fontSize: '0.95rem' }}>Instant Multiplayer</h4>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.4 }}>
              Zero-install Hybrid Transport. Play across multiple tabs or separate devices on your LAN with simple 4-character room codes.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ fontSize: '1.8rem' }}>🛡️</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h4 style={{ margin: 0, color: '#4ade80', fontSize: '0.95rem' }}>Strict Engine Invariants</h4>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.4 }}>
              52-card conservation across all zones, exact 100-point Seep accounting, and Mulberry32 seeded reproducibility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
