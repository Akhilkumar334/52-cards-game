import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  BluffEngine,
  DEFAULT_BLUFF_RULESET,
  type BluffGameState,
  type BluffMove,
  type BluffRuleset,
  type PlayerConfig,
} from '@cards/engine';
import { BluffBot } from '@cards/bots';
import { BluffTable } from './BluffTable';
import { ScorePanel } from '../../components/table/ScorePanel';
import { Card } from '../../components/shared/Card';
import { type CardThrowAction } from '../../components/table/CardThrowOverlay';
import { getPlayerSeatPosition } from '../../components/table/PlayerSeat';
import { useRoomStore } from '../../network/useRoomStore';
import { RoomBanner } from '../../components/room/RoomBanner';

// Synthesize pleasant casino card sounds via Web Audio API
class SoundFx {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCardSnap() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {}
  }

  playChallenge() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.setValueAtTime(180, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch {}
  }

  playWin() {
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [261.63, 329.63, 392.0, 523.25];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.1);
        osc.stop(this.ctx.currentTime + idx * 0.1 + 0.4);
      });
    } catch {}
  }

  playDealSwoosh() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {}
  }
}

const sfx = new SoundFx();

const DEFAULT_PLAYERS: PlayerConfig[] = [
  { id: 'player-human', name: 'You', isBot: false },
  { id: 'bot-1', name: 'Karan (Bot)', isBot: true },
  { id: 'bot-2', name: 'Priya (Bot)', isBot: true },
  { id: 'bot-3', name: 'Rohan (Bot)', isBot: true },
];

const INITIAL_BLUFF_RULESET: BluffRuleset = {
  ...DEFAULT_BLUFF_RULESET,
  rankProgression: 'tableClearOnAllPass',
  whoStartsAfterChallenge: 'winner',
};

export const BluffPage: React.FC = () => {
  const { room, localPlayer, lastRemoteMove, newGameSeed, broadcastMove, restartGame } = useRoomStore();
  const isRoomMode = Boolean(room && room.status === 'playing' && localPlayer);
  const humanPlayerId = isRoomMode && localPlayer ? localPlayer.id : 'player-human';

  const activePlayers: PlayerConfig[] = useMemo(() => {
    if (isRoomMode && room) {
      return room.seats.map((seat) => ({
        id: seat.player?.id ?? `bot-${seat.seatIndex}`,
        name: seat.player?.name ?? `Bot ${seat.seatIndex}`,
        isBot: seat.player?.isBot ?? true,
      }));
    }
    return DEFAULT_PLAYERS;
  }, [isRoomMode, room]);

  const [ruleset, setRuleset] = useState<BluffRuleset>(INITIAL_BLUFF_RULESET);
  const [gameState, setGameState] = useState<BluffGameState>(() => {
    const seed = isRoomMode && room?.seed ? room.seed : Date.now();
    return BluffEngine.createGame(INITIAL_BLUFF_RULESET, activePlayers, seed);
  });

  const [isProcessingBot, setIsProcessingBot] = useState(false);
  const [botThinkingText, setBotThinkingText] = useState<string | null>(null);
  const [botThinkingPlayerName, setBotThinkingPlayerName] = useState<string | null>(null);
  const [isDealingAnimation, setIsDealingAnimation] = useState(true);
  const [showRulesetModal, setShowRulesetModal] = useState(false);
  const [playerActionBubbles, setPlayerActionBubbles] = useState<
    Record<string, { text: string; type: 'think' | 'play' | 'pass' | 'challenge' }>
  >({});

  // Instantiated bot controllers
  const botsRef = useRef<Map<string, BluffBot>>(new Map());

  // Card dealing animation on mount or new game
  const triggerDealAnimation = useCallback(() => {
    setIsDealingAnimation(true);
    let count = 0;
    const soundInterval = setInterval(() => {
      sfx.playDealSwoosh();
      count++;
      if (count > 6) clearInterval(soundInterval);
    }, 180);

    const timer = setTimeout(() => {
      setIsDealingAnimation(false);
      clearInterval(soundInterval);
    }, 1800);

    return () => {
      clearTimeout(timer);
      clearInterval(soundInterval);
    };
  }, []);

  useEffect(() => {
    triggerDealAnimation();
  }, [triggerDealAnimation]);

  const getBot = useCallback((id: string) => {
    let bot = botsRef.current.get(id);
    if (!bot) {
      bot = new BluffBot({ seed: Math.floor(Math.random() * 1_000_000) });
      botsRef.current.set(id, bot);
    }
    return bot;
  }, []);

  const [activeThrowAction, setActiveThrowAction] = useState<CardThrowAction | null>(null);

  const startNewGame = useCallback(
    (customRuleset?: BluffRuleset, customSeed?: number, customPlayers?: PlayerConfig[]) => {
      const activeRuleset = customRuleset ?? ruleset;
      const playersToUse = customPlayers ?? activePlayers;
      botsRef.current.clear();
      const newSeed = customSeed ?? Math.floor(Math.random() * 1_000_000);
      const initial = BluffEngine.createGame(activeRuleset, playersToUse, newSeed);
      setGameState(initial);
      setBotThinkingText(null);
      setBotThinkingPlayerName(null);
      setActiveThrowAction(null);
      triggerDealAnimation();
    },
    [ruleset, activePlayers, triggerDealAnimation],
  );

  // Sync game when room starts or re-deals
  useEffect(() => {
    if (isRoomMode && room?.seed) {
      startNewGame(ruleset, room.seed, activePlayers);
    }
  }, [isRoomMode, room?.seed]);

  useEffect(() => {
    if (isRoomMode && newGameSeed !== null) {
      startNewGame(ruleset, newGameSeed, activePlayers);
    }
  }, [newGameSeed, isRoomMode]);

  const handleApplyMove = useCallback(
    (move: BluffMove, isRemote = false) => {
      try {
        if (move.type === 'PLAY') sfx.playCardSnap();
        if (move.type === 'CHALLENGE') sfx.playChallenge();

        const prev = gameState;
        const humanIndex = prev.players.findIndex((p) => p.id === humanPlayerId);

        // Show immediate table action bubble for the acting player
        let actionText = 'Action';
        let actionType: 'play' | 'pass' | 'challenge' = 'play';
        if (move.type === 'PLAY') {
          const rankStr = move.declaredRank === 'T' ? '10' : move.declaredRank;
          actionText = `🃏 Added ${move.cardIds.length} ${rankStr}(s)`;
          actionType = 'play';

          const playerIndex = prev.players.findIndex((p) => p.id === move.playerId);
          const player = prev.players[playerIndex]!;
          const throwerPos = getPlayerSeatPosition(playerIndex, humanIndex, prev.players.length);
          const throwerAvatar =
            player.id === humanPlayerId
              ? isRoomMode && localPlayer
                ? localPlayer.avatar
                : '🤠'
              : player.isBot
              ? '🤖'
              : '👤';

          setActiveThrowAction({
            id: String(Date.now()),
            throwerName: player.name,
            throwerAvatar,
            throwerPosition: throwerPos,
            cards: move.cardIds.map((_, i) => ({
              id: `bluff-${i}`,
              suit: 'S' as const,
              rank: move.declaredRank,
              deckIndex: 0,
            })),
            faceDown: true,
            declaredRank: rankStr,
            actionText: `threw ${move.cardIds.length} card(s) as ${rankStr}`,
            phase: 'throwing',
          });
          setTimeout(() => {
            setActiveThrowAction(null);
          }, 650);
        } else if (move.type === 'PASS_TURN' || move.type === 'PASS_CHALLENGE') {
          actionText = '⏭️ Passed';
          actionType = 'pass';

          if (
            prev.ruleset.rankProgression === 'tableClearOnAllPass' &&
            prev.lastPlayedPlayerIndex !== null &&
            prev.currentPlayerIndex === prev.lastPlayedPlayerIndex &&
            prev.pile.length > 0
          ) {
            // All players have now skipped their turn: table is cleared!
            const clearingPlayer = prev.players[prev.currentPlayerIndex]!;
            const clearingPos = getPlayerSeatPosition(
              prev.currentPlayerIndex,
              humanIndex,
              prev.players.length,
            );
            setActiveThrowAction({
              id: String(Date.now()),
              throwerName: clearingPlayer.name,
              throwerAvatar:
                clearingPlayer.id === humanPlayerId
                  ? isRoomMode && localPlayer
                    ? localPlayer.avatar
                    : '🤠'
                  : clearingPlayer.isBot
                  ? '🤖'
                  : '👤',
              throwerPosition: clearingPos,
              cards: [],
              actionText: `skipped — table cleared (${prev.pile.length} cards burned)!`,
              phase: 'vanishing',
            });
            setTimeout(() => {
              setActiveThrowAction(null);
            }, 600);
          }
        } else if (move.type === 'CHALLENGE') {
          actionText = '🚨 SHOW / CHALLENGE!';
          actionType = 'challenge';

          const { lastPlay } = prev;
          if (lastPlay) {
            const challengerIdx =
              prev.ruleset.rankProgression === 'tableClearOnAllPass'
                ? prev.currentPlayerIndex
                : prev.phase.type === 'challenge' && prev.phase.pendingIndices[0] !== undefined
                ? prev.phase.pendingIndices[0]
                : prev.players.findIndex((p) => p.id === move.playerId);

            const challengedPlayer = prev.players[lastPlay.playerIndex]!;
            const challenger = prev.players[challengerIdx]!;
            const wasLying = lastPlay.cards.some((c) => c.rank !== lastPlay.declaredRank);
            const loserIdx = wasLying ? lastPlay.playerIndex : challengerIdx;
            const winnerIdx = wasLying ? challengerIdx : lastPlay.playerIndex;
            const loser = prev.players[loserIdx]!;
            const winner = prev.players[winnerIdx]!;
            const loserPos = getPlayerSeatPosition(loserIdx, humanIndex, prev.players.length);
            const loserAvatar =
              loser.id === humanPlayerId
                ? isRoomMode && localPlayer
                  ? localPlayer.avatar
                  : '🤠'
                : loser.isBot
                ? '🤖'
                : '👤';

            const nextLeader =
              prev.ruleset.whoStartsAfterChallenge === 'winner'
                ? winner
                : prev.ruleset.whoStartsAfterChallenge === 'loser'
                ? loser
                : prev.players[(lastPlay.playerIndex + 1) % prev.players.length]!;

            const unrevealedPileCount = Math.max(0, prev.pile.length - lastPlay.cards.length);
            const declaredRankDisplay = lastPlay.declaredRank;

            const eaterTitle = wasLying
              ? `🚨 ${challengedPlayer.name} was BLUFFING! (${loser.name} picks up ${prev.pile.length} cards · 👉 ${nextLeader.name} leads next)`
              : `✅ ${challengedPlayer.name} told the TRUTH! (${loser.name} picks up ${prev.pile.length} cards · 👉 ${nextLeader.name} leads next)`;

            setActiveThrowAction({
              id: String(Date.now()),
              throwerName: challenger.name,
              throwerAvatar:
                challenger.id === humanPlayerId
                  ? isRoomMode && localPlayer
                    ? localPlayer.avatar
                    : '🤠'
                  : challenger.isBot
                  ? '🤖'
                  : '👤',
              throwerPosition: getPlayerSeatPosition(challengerIdx, humanIndex, prev.players.length),
              cards: lastPlay.cards,
              actionText: wasLying ? 'caught the bluff!' : 'bluff call failed!',
              isEating: true,
              isChallengeReveal: true,
              wasLying,
              declaredRank: declaredRankDisplay,
              unrevealedPileCount,
              eaterName: loser.name,
              eaterPosition: loserPos,
              eaterTitle,
              eatenCards: lastPlay.cards,
              phase: 'eating',
            });

            setTimeout(() => {
              setActiveThrowAction((act) => (act ? { ...act, phase: 'vanishing' } : null));
              setTimeout(() => {
                setActiveThrowAction(null);
              }, 550);
            }, 1800);
          }
        }

        setPlayerActionBubbles((prevB) => ({
          ...prevB,
          [move.playerId]: { text: actionText, type: actionType },
        }));

        // Auto-clear this action bubble after 2.8s
        setTimeout(() => {
          setPlayerActionBubbles((prevB) => {
            const nextB = { ...prevB };
            delete nextB[move.playerId];
            return nextB;
          });
        }, 2800);

        setGameState((prevS) => {
          const next = BluffEngine.applyMove(prevS, move);
          if (BluffEngine.isGameOver(next)) {
            sfx.playWin();
          }
          return next;
        });

        // Broadcast move to other players in room if played locally
        if (isRoomMode && !isRemote) {
          broadcastMove(move, prev.turnNumber);
        }
      } catch (err) {
        console.error('Failed to apply move:', err);
      }
    },
    [gameState, humanPlayerId, isRoomMode, localPlayer, broadcastMove],
  );

  // Listen for remote moves from other players/host
  useEffect(() => {
    if (!isRoomMode || !lastRemoteMove) return;
    if (lastRemoteMove.senderId === humanPlayerId) return;
    handleApplyMove(lastRemoteMove.move, true);
  }, [lastRemoteMove, isRoomMode, humanPlayerId, handleApplyMove]);

  // Bot Turn Loop with human-paced thinking & live status updates in the chat
  useEffect(() => {
    if (isDealingAnimation) return;
    if (BluffEngine.isGameOver(gameState)) {
      setBotThinkingText(null);
      return;
    }

    let activeActorId: string | null = null;
    let turnActionType: 'play' | 'challenge' = 'play';

    if (gameState.phase.type === 'play') {
      activeActorId = gameState.players[gameState.currentPlayerIndex]?.id ?? null;
      turnActionType = 'play';
    } else if (gameState.phase.type === 'challenge') {
      const pendingIdx = gameState.phase.pendingIndices[0];
      if (pendingIdx !== undefined) {
        activeActorId = gameState.players[pendingIdx]?.id ?? null;
        turnActionType = 'challenge';
      }
    }

    if (!activeActorId) {
      setBotThinkingText(null);
      return;
    }

    const actorPlayer = gameState.players.find((p) => p.id === activeActorId);
    if (!actorPlayer || !actorPlayer.isBot) {
      setIsProcessingBot(false);
      setBotThinkingText(null);
      setBotThinkingPlayerName(null);
      return;
    }

    // In Room Mode: ONLY the Host executes bot logic to prevent multiple tabs firing moves!
    if (isRoomMode && localPlayer && !localPlayer.isHost) {
      setIsProcessingBot(true);
      setBotThinkingPlayerName(actorPlayer.name);
      return;
    }

    setIsProcessingBot(true);
    setBotThinkingPlayerName(actorPlayer.name);

    // Show table thought bubble on the bot seat
    const thinkBubbleText =
      turnActionType === 'play'
        ? gameState.lastPlay
          ? '💭 Deciding cards or show...'
          : '💭 Choosing cards to lead...'
        : '💭 Evaluating bluff call...';
    setPlayerActionBubbles((prev) => ({
      ...prev,
      [activeActorId!]: { text: thinkBubbleText, type: 'think' },
    }));

    // Initial thinking message
    if (turnActionType === 'play') {
      if (gameState.lastPlay) {
        const rankStr = gameState.currentRank === 'T' ? '10' : gameState.currentRank;
        setBotThinkingText(`Evaluating: Show previous play, Pass, or play ${rankStr}'s...`);
      } else {
        setBotThinkingText(`Leading new round: selecting rank & cards...`);
      }
    } else {
      const lastPlay = gameState.lastPlay;
      const lastRank = lastPlay ? (lastPlay.declaredRank === 'T' ? '10' : lastPlay.declaredRank) : '';
      setBotThinkingText(`Evaluating claim of ${lastPlay?.cardCount ?? 1} ${lastRank}(s)...`);
    }

    // Mid-thought message after 750ms
    const thoughtTimer = setTimeout(() => {
      if (turnActionType === 'play') {
        if (gameState.lastPlay) {
          setBotThinkingText(`Deciding between placing cards, skipping, or calling bluff...`);
        } else {
          setBotThinkingText(`Choosing cards to lead...`);
        }
      } else {
        setBotThinkingText(`Considering call or pass...`);
      }
    }, 750);

    // Final move applied after 1500ms - 2000ms for realistic game flow
    const executeTimer = setTimeout(() => {
      try {
        const visibleState = BluffEngine.getVisibleState(gameState, activeActorId!);
        const legalMoves = BluffEngine.getLegalMoves(visibleState, activeActorId!);

        if (legalMoves.length > 0) {
          const bot = getBot(activeActorId!);
          const chosenMove = bot.chooseMove(visibleState, legalMoves);
          handleApplyMove(chosenMove);
        }
      } catch (e) {
        console.error('Bot turn failed:', e);
      } finally {
        setIsProcessingBot(false);
        setBotThinkingText(null);
        setBotThinkingPlayerName(null);
      }
    }, 1600);

    return () => {
      clearTimeout(thoughtTimer);
      clearTimeout(executeTimer);
    };
  }, [gameState, getBot, handleApplyMove, isDealingAnimation, isRoomMode, localPlayer]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 16px',
        maxWidth: 1440,
        margin: '0 auto',
        gap: 6,
        height: 'calc(100vh - 48px)',
        maxHeight: 'calc(100vh - 48px)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Live Room Banner if in Room Mode */}
      {isRoomMode && <RoomBanner />}

      {/* Top Bar / Controls */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.25rem',
              color: '#facc15',
              letterSpacing: '0.02em',
              margin: 0,
            }}
          >
            Bluff (Cheat)
          </h2>
          <span
            style={{
              fontSize: '0.72rem',
              color: '#94a3b8',
              background: 'rgba(255, 255, 255, 0.06)',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            {ruleset.rankProgression === 'tableClearOnAllPass'
              ? 'Classic Indian Bluff (Table-Clear)'
              : 'Sequential Cycle (A→K)'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowRulesetModal(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: '0.8rem',
              fontWeight: 600,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              cursor: 'pointer',
            }}
          >
            ⚙️ Ruleset Config
          </button>
          <button
            onClick={() => {
              if (isRoomMode) {
                if (localPlayer?.isHost) {
                  restartGame();
                }
              } else {
                startNewGame();
              }
            }}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: '0.8rem',
              fontWeight: 700,
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
              cursor: 'pointer',
            }}
          >
            {isRoomMode
              ? localPlayer?.isHost
                ? '🔄 Next Round (Host)'
                : '🟢 Room Active'
              : '🔄 New Game & Re-deal'}
          </button>
        </div>
      </div>

      {/* Main Game Arena */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          gap: 12,
          alignItems: 'stretch',
          position: 'relative',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Dealing Cards Overlay Animation */}
        {isDealingAnimation && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(3px)',
              zIndex: 80,
              borderRadius: 220,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={{ position: 'relative', width: 90, height: 130 }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  animation: 'dealFlyTop 0.8s ease-out infinite alternate',
                }}
              >
                <Card faceDown size="md" />
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  animation: 'dealFlyLeft 0.8s ease-out infinite alternate 0.2s',
                }}
              >
                <Card faceDown size="md" />
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  animation: 'dealFlyRight 0.8s ease-out infinite alternate 0.4s',
                }}
              >
                <Card faceDown size="md" />
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  animation: 'dealFlyBottom 0.8s ease-out infinite alternate 0.6s',
                }}
              >
                <Card faceDown size="md" />
              </div>
            </div>

            <div
              style={{
                marginTop: 24,
                color: '#facc15',
                fontSize: '1.1rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              }}
            >
              Shuffling & Distributing 52 Cards...
            </div>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0 }}>
          <BluffTable
            gameState={gameState}
            humanPlayerId={humanPlayerId}
            onMove={(move) => handleApplyMove(move, false)}
            isProcessingBot={isProcessingBot}
            playerActionBubbles={playerActionBubbles}
            activeThrowAction={activeThrowAction}
          />
        </div>

        {/* Live Metrics & Chat / Event Log Sidebar */}
        <ScorePanel
          currentRank={gameState.currentRank}
          pileCount={gameState.pile.length}
          turnNumber={gameState.turnNumber}
          log={gameState.log}
          botThinkingText={botThinkingText}
          botThinkingPlayerName={botThinkingPlayerName}
        />
      </div>

      {/* Ruleset Configuration Modal */}
      {showRulesetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setShowRulesetModal(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: 460,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.2rem', color: '#facc15' }}>Bluff Ruleset Configuration</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Engine reads all rule knobs from schema. Changes apply on New Game.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.85rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Game Mode / Rank Rule:</span>
                <select
                  value={ruleset.rankProgression}
                  onChange={(e) =>
                    setRuleset({
                      ...ruleset,
                      rankProgression: e.target.value as 'tableClearOnAllPass' | 'cycle',
                    })
                  }
                  style={{
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #475569',
                    padding: '4px 8px',
                    borderRadius: 6,
                    maxWidth: 220,
                  }}
                >
                  <option value="tableClearOnAllPass">Table Clear on Pass (Indian Bluff)</option>
                  <option value="cycle">Sequential Cycle (A→2→…→K)</option>
                </select>
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Deck Count:</span>
                <select
                  value={ruleset.deckCount}
                  onChange={(e) => {
                    const newCount = Number(e.target.value) as 1 | 2;
                    setRuleset({
                      ...ruleset,
                      deckCount: newCount,
                      maxCardsPerPlay: newCount === 1 ? Math.min(4, ruleset.maxCardsPerPlay) : 8,
                    });
                  }}
                  style={{
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #475569',
                    padding: '4px 8px',
                    borderRadius: 6,
                  }}
                >
                  <option value={1}>1 Deck (52 cards — Max 4 per play)</option>
                  <option value={2}>2 Decks (104 cards — Max 8 per play)</option>
                </select>
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Max Cards Per Play:</span>
                <input
                  type="number"
                  min={1}
                  max={ruleset.deckCount === 1 ? 4 : 8}
                  value={ruleset.maxCardsPerPlay}
                  onChange={(e) => {
                    const limit = ruleset.deckCount === 1 ? 4 : 8;
                    const val = Math.min(limit, Math.max(1, Number(e.target.value)));
                    setRuleset({ ...ruleset, maxCardsPerPlay: val });
                  }}
                  style={{
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #475569',
                    padding: '4px 8px',
                    borderRadius: 6,
                    width: 70,
                  }}
                />
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Who Starts After Challenge:</span>
                <select
                  value={ruleset.whoStartsAfterChallenge}
                  onChange={(e) =>
                    setRuleset({
                      ...ruleset,
                      whoStartsAfterChallenge: e.target.value as 'loser' | 'winner' | 'sequence',
                    })
                  }
                  style={{
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #475569',
                    padding: '4px 8px',
                    borderRadius: 6,
                  }}
                >
                  <option value="loser">Loser (Picks up pile)</option>
                  <option value="winner">Winner of Challenge</option>
                  <option value="sequence">Next in Sequence</option>
                </select>
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Must Survive Last Play Call:</span>
                <input
                  type="checkbox"
                  checked={ruleset.mustSurviveCallOnLastPlay}
                  onChange={(e) =>
                    setRuleset({ ...ruleset, mustSurviveCallOnLastPlay: e.target.checked })
                  }
                  style={{ width: 18, height: 18, accentColor: '#f59e0b' }}
                />
              </label>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Allow Turn Pass:</span>
                <input
                  type="checkbox"
                  checked={ruleset.allowPass}
                  onChange={(e) => setRuleset({ ...ruleset, allowPass: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: '#f59e0b' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setShowRulesetModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: 6,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRulesetModal(false);
                  startNewGame(ruleset);
                }}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#fff',
                  padding: '8px 18px',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                Apply & Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
