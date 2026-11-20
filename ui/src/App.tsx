import React, { useState, useEffect } from 'react';
import { BluffPage } from './games/bluff/BluffPage';
import { ThullaPage } from './games/thulla/ThullaPage';
import { SeepPage } from './games/seep/SeepPage';
import { RoomModal } from './components/room/RoomModal';
import { RoomLobby } from './components/room/RoomLobby';
import { LandingPage } from './pages/LandingPage';
import { useRoomStore } from './network/useRoomStore';
import type { GameType } from './network/types';
import { useDeviceOrientation } from './hooks/useDeviceOrientation';
import { LandscapePrompt } from './components/mobile/LandscapePrompt';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'home' | 'game'>('home');
  const [activeTab, setActiveTab] = useState<GameType>('bluff');
  const [playMode, setPlayMode] = useState<'bots' | 'room'>('bots');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [howToPlayGame, setHowToPlayGame] = useState<GameType>('bluff');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [initialRoomCode, setInitialRoomCode] = useState('');

  const { room, leaveRoom } = useRoomStore();
  const orientation = useDeviceOrientation();

  // Detect ?room=CODE in URL query params on load (e.g. from shared invite links)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        const cleanCode = roomParam.toUpperCase().trim();
        let targetGame: GameType = 'bluff';
        if (cleanCode.startsWith('THULLA')) targetGame = 'thulla';
        else if (cleanCode.startsWith('SEEP')) targetGame = 'seep';

        setActiveTab(targetGame);
        setInitialRoomCode(cleanCode);
        setPlayMode('room');
        setCurrentView('game');
        setShowRoomModal(true);
      }
    } catch {}
  }, []);

  // When room changes, keep activeTab in sync with room game and view in game/lobby mode
  useEffect(() => {
    if (room) {
      setPlayMode('room');
      setActiveTab(room.game);
      setCurrentView('game');
    }
  }, [room]);

  const handleSelectGame = (
    game: GameType,
    mode: 'bots' | 'room',
    roomAction: 'create' | 'join' = 'create',
    code?: string,
  ) => {
    setActiveTab(game);
    setHowToPlayGame(game);
    setPlayMode(mode);

    if (mode === 'bots') {
      // If currently in a room, prompt to leave
      if (room) {
        const confirmLeave = window.confirm(
          `Leave multiplayer room ${room.code} to play with bots?`,
        );
        if (confirmLeave) {
          leaveRoom();
        } else {
          return;
        }
      }
      setCurrentView('game');
    } else {
      // Room Mode: open RoomModal with chosen game & action
      setInitialRoomCode(code ?? '');
      setShowRoomModal(true);
      setCurrentView('game');
    }
  };

  const handleOpenHowToPlay = (game: GameType) => {
    setHowToPlayGame(game);
    setShowHowToPlay(true);
  };

  const handleBotsModeClick = () => {
    if (room) {
      const confirmLeave = window.confirm(
        `You are currently in multiplayer room ${room.code}. Leave room to play offline with bots?`,
      );
      if (confirmLeave) {
        leaveRoom();
        setPlayMode('bots');
      }
    } else {
      setPlayMode('bots');
    }
  };

  const handleRoomModeClick = () => {
    setPlayMode('room');
    if (!room) {
      setShowRoomModal(true);
    }
  };

  const isLobbyActive = playMode === 'room' && room && room.status === 'lobby';
  const isMobileGameView = orientation.isMobile && currentView === 'game';

  return (
    <div
      className={orientation.forceLandscape && orientation.isPortrait ? 'force-landscape-container' : ''}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Mobile Landscape Guidance Modal */}
      <LandscapePrompt orientation={orientation} />

      {/* Platform Navigation Header */}
      <header
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(10, 14, 20, 0.95)',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          padding: '0 max(12px, env(safe-area-inset-left))',
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: '0 auto',
            height: isMobileGameView ? 38 : 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          {/* Brand & Home Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setCurrentView('home')}
              title="Return to Home / Game Selector"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: '1.25rem', color: '#facc15' }}>♠</span>
              {!isMobileGameView && (
                <h1
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: '#f8fafc',
                    letterSpacing: '0.04em',
                    margin: 0,
                  }}
                >
                  52 CARDS PLATFORM
                </h1>
              )}
            </button>

            {currentView === 'game' && (
              <button
                onClick={() => setCurrentView('home')}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                <span>←</span>
                <span>{isMobileGameView ? 'Home' : 'All Games'}</span>
              </button>
            )}

            {isMobileGameView && (
              <span
                style={{
                  color:
                    activeTab === 'bluff'
                      ? '#f59e0b'
                      : activeTab === 'thulla'
                        ? '#38bdf8'
                        : '#10b981',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  marginLeft: 4,
                }}
              >
                {activeTab === 'bluff' ? '🃏 Bluff' : activeTab === 'thulla' ? '⚡ Thulla' : '🏰 Seep'}
              </span>
            )}
          </div>

          {/* Center Navigation Controls (Desktop only in game view) */}
          {!isMobileGameView && currentView === 'game' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Mode Switcher: Play with Bots vs Create/Join Room */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(255, 255, 255, 0.06)',
                  padding: 3,
                  borderRadius: 20,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <button
                  onClick={handleBotsModeClick}
                  style={{
                    background:
                      playMode === 'bots'
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'transparent',
                    color: playMode === 'bots' ? '#fff' : '#94a3b8',
                    padding: '5px 14px',
                    borderRadius: 16,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>🤖 Play with Bots</span>
                  {playMode === 'bots' && <span style={{ fontSize: '0.65rem' }}>●</span>}
                </button>

                <button
                  onClick={handleRoomModeClick}
                  style={{
                    background:
                      playMode === 'room'
                        ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                        : 'transparent',
                    color: playMode === 'room' ? '#fff' : '#94a3b8',
                    padding: '5px 14px',
                    borderRadius: 16,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>🌐 {room ? `Room: ${room.code}` : 'Create / Join Room'}</span>
                  {playMode === 'room' && (
                    <span style={{ fontSize: '0.65rem', color: room ? '#4ade80' : '#fff' }}>●</span>
                  )}
                </button>
              </div>

              {/* Game Switcher Tabs */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: 4,
                  borderRadius: 10,
                  gap: 4,
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <button
                  onClick={() => {
                    if (!room) setActiveTab('bluff');
                  }}
                  style={{
                    background:
                      activeTab === 'bluff'
                        ? 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)'
                        : 'transparent',
                    color: activeTab === 'bluff' ? '#fff' : '#94a3b8',
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    opacity: room && room.game !== 'bluff' ? 0.4 : 1,
                    cursor: room && room.game !== 'bluff' ? 'not-allowed' : 'pointer',
                  }}
                  title={room && room.game !== 'bluff' ? `Current room is for ${room.game}` : ''}
                >
                  🃏 Bluff
                </button>

                <button
                  onClick={() => {
                    if (!room) setActiveTab('thulla');
                  }}
                  style={{
                    background:
                      activeTab === 'thulla'
                        ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                        : 'transparent',
                    color: activeTab === 'thulla' ? '#fff' : '#94a3b8',
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    opacity: room && room.game !== 'thulla' ? 0.4 : 1,
                    cursor: room && room.game !== 'thulla' ? 'not-allowed' : 'pointer',
                  }}
                  title={room && room.game !== 'thulla' ? `Current room is for ${room.game}` : ''}
                >
                  ⚡ Thulla
                </button>

                <button
                  onClick={() => {
                    if (!room) setActiveTab('seep');
                  }}
                  style={{
                    background:
                      activeTab === 'seep'
                        ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
                        : 'transparent',
                    color: activeTab === 'seep' ? '#fff' : '#94a3b8',
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    opacity: room && room.game !== 'seep' ? 0.4 : 1,
                    cursor: room && room.game !== 'seep' ? 'not-allowed' : 'pointer',
                  }}
                  title={room && room.game !== 'seep' ? `Current room is for ${room.game}` : ''}
                >
                  🏰 Seep
                </button>
              </div>
            </div>
          )}

          {/* Right Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Mobile Orientation Toggle */}
            {orientation.isMobile && (
              <button
                type="button"
                onClick={() => {
                  if (orientation.isPortrait) {
                    orientation.toggleForceLandscape();
                  } else {
                    orientation.requestLandscapeFullscreen();
                  }
                }}
                title="Toggle Landscape / Sideways Mode"
                style={{
                  background: orientation.forceLandscape ? '#f59e0b' : 'rgba(255, 255, 255, 0.08)',
                  color: orientation.forceLandscape ? '#000' : '#e2e8f0',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>📱</span>
                <span>{orientation.forceLandscape ? 'Sideways ON' : 'Rotate'}</span>
              </button>
            )}

            {currentView === 'home' && (
              <button
                onClick={() => {
                  setInitialRoomCode('');
                  setShowRoomModal(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: '#fff',
                  padding: '5px 14px',
                  borderRadius: 16,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span>🌐 Create / Join Room</span>
              </button>
            )}

            {/* Help Button */}
            <button
              onClick={() => handleOpenHowToPlay(activeTab)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                padding: isMobileGameView ? '4px 8px' : '6px 14px',
                borderRadius: 8,
                fontSize: isMobileGameView ? '0.76rem' : '0.85rem',
                fontWeight: 600,
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              {isMobileGameView ? '📖 Rules' : '📖 How to Play'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          padding:
            isMobileGameView || isLobbyActive || currentView === 'home' || orientation.isShortScreen
              ? '0'
              : '20px 0',
        }}
      >
        {currentView === 'home' ? (
          <LandingPage onSelectGame={handleSelectGame} onOpenHowToPlay={handleOpenHowToPlay} />
        ) : isLobbyActive ? (
          <div style={{ padding: '20px 0' }}>
            <RoomLobby />
          </div>
        ) : (
          <>
            {activeTab === 'bluff' && <BluffPage />}
            {activeTab === 'thulla' && <ThullaPage />}
            {activeTab === 'seep' && <SeepPage />}
          </>
        )}
      </main>

      {/* Footer (Hide on mobile in-game to allow full table view) */}
      {!isMobileGameView && (
        <footer
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '14px 24px',
            color: '#64748b',
            fontSize: '0.75rem',
            textAlign: 'center',
          }}
        >
          Pure TypeScript Engine • Real-time Multiplayer (BroadcastChannel & WebSocket) • Seeded Mulberry32 RNG
        </footer>
      )}

      {/* Multiplayer Room Modal (Create / Join Room) */}
      <RoomModal
        isOpen={showRoomModal}
        onClose={() => setShowRoomModal(false)}
        initialGame={activeTab}
        initialCode={initialRoomCode}
      />

      {/* How to Play Modal */}
      {showHowToPlay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setShowHowToPlay(false)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: 540,
              width: '100%',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {howToPlayGame === 'seep' ? (
              <>
                <h3 style={{ fontSize: '1.4rem', color: '#10b981' }}>How to Play Seep (Sweep)</h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    fontSize: '0.88rem',
                    color: '#cbd5e1',
                    lineHeight: 1.5,
                  }}
                >
                  <p>
                    <strong>🎯 Objective:</strong> Score points by capturing valuable cards and scoring{' '}
                    <strong>Seeps (+50 pts)</strong> in 2v2 partnerships (You + North vs East + West) to reach 350
                    points!
                  </p>
                  <p>
                    <strong>💯 100 Card Points Per Round:</strong>
                    <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                      <li>
                        <strong>All 13 Spades (♠):</strong> A♠ (1 pt), 2–10♠ (face value), J♠ (11), Q♠ (12), K♠ (13).
                        Total Spades = 91 pts!
                      </li>
                      <li>
                        <strong>The other 3 Aces (A♥, A♦, A♣):</strong> 1 point each (3 pts).
                      </li>
                      <li>
                        <strong>10 of Diamonds (10♦) "Bada Patta":</strong> 6 points!
                      </li>
                    </ul>
                  </p>
                  <p>
                    <strong>🏗️ Building Houses:</strong> Combine a card from your hand with cards on the table summing to
                    9–13 (e.g. 7 + 3 = 10-house). You MUST hold a card matching that house value to capture it later!
                  </p>
                  <p>
                    <strong>🔒 Cemented Houses:</strong> Adding duplicate items of the same value locks the house so
                    opponents cannot build it higher!
                  </p>
                </div>
              </>
            ) : howToPlayGame === 'thulla' ? (
              <>
                <h3 style={{ fontSize: '1.4rem', color: '#3b82f6' }}>How to Play Thulla (Bhabhi)</h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    fontSize: '0.88rem',
                    color: '#cbd5e1',
                    lineHeight: 1.5,
                  }}
                >
                  <p>
                    <strong>🎯 Objective:</strong> Get rid of all your cards! The last player holding cards is the loser
                    (the <strong>Bhabhi</strong>).
                  </p>
                  <p>
                    <strong>⚡ The Thulla Penalty:</strong> Players must strictly follow the led suit. If you do not have
                    cards of that suit, you can hit a <strong>THULLA</strong> by playing any off-suit card!
                  </p>
                  <p>
                    <strong>💥 Penalty Pickup:</strong> When a Thulla is played, the trick stops immediately, and the
                    player who played the <strong>highest card of the led suit</strong> must pick up the entire trick!
                  </p>
                  <p>
                    <strong>👑 Ace is Highest:</strong> A (14) &gt; K (13) &gt; Q (12) &gt; J (11) &gt; 10 &gt; … &gt; 2.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: '1.4rem', color: '#f59e0b' }}>How to Play Bluff (Cheat)</h3>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    fontSize: '0.88rem',
                    color: '#cbd5e1',
                    lineHeight: 1.5,
                  }}
                >
                  <p>
                    <strong>🎯 Objective:</strong> Be the first player to empty your entire hand.
                  </p>
                  <p>
                    <strong>🃏 Playing Cards:</strong> Place 1 to 4 cards face-down onto the table and declare their rank.
                    You can tell the truth or <strong>BLUFF</strong>!
                  </p>
                  <p>
                    <strong>🚨 Calling Bluff:</strong> Other players can call "Bluff / Show". If the player lied, they
                    must pick up the entire pile! If they told the truth, the challenger picks up the pile!
                  </p>
                  <p>
                    <strong>🌐 Multiplayer Rooms:</strong> Create a room, share the code with friends, and play in real
                    time across windows or devices!
                  </p>
                </div>
              </>
            )}

            <button
              onClick={() => setShowHowToPlay(false)}
              style={{
                alignSelf: 'flex-end',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#fff',
                padding: '8px 20px',
                borderRadius: 8,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
