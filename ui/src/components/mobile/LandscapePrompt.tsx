import React from 'react';
import type { DeviceOrientationState } from '../../hooks/useDeviceOrientation';

interface LandscapePromptProps {
  orientation: DeviceOrientationState;
}

export const LandscapePrompt: React.FC<LandscapePromptProps> = ({ orientation }) => {
  const {
    isMobile,
    isPortrait,
    forceLandscape,
    isPromptDismissed,
    requestLandscapeFullscreen,
    toggleForceLandscape,
    dismissPrompt,
  } = orientation;

  // Only show when on mobile and in portrait mode without forceLandscape active
  const shouldShow = isMobile && isPortrait && !forceLandscape && !isPromptDismissed;

  if (!shouldShow) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'radial-gradient(ellipse at center, rgba(15, 30, 22, 0.98) 0%, rgba(6, 11, 16, 0.99) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        color: '#f8fafc',
        textAlign: 'center',
        animation: 'fadeInUp 0.3s ease-out',
      }}
    >
      {/* Decorative Casino Glow */}
      <div
        style={{
          position: 'absolute',
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* 3D Animated Rotating Smartphone Icon */}
      <div
        style={{
          position: 'relative',
          width: 80,
          height: 80,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 52,
            height: 74,
            borderRadius: 10,
            border: '3px solid #facc15',
            background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.15) 0%, rgba(16, 185, 129, 0.2) 100%)',
            boxShadow: '0 0 25px rgba(250, 204, 21, 0.5), inset 0 0 15px rgba(250, 204, 21, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'phoneRotate3D 2.6s ease-in-out infinite',
            position: 'relative',
          }}
        >
          {/* Phone Screen Card Suit */}
          <span style={{ fontSize: '1.6rem', color: '#facc15' }}>♠</span>
          {/* Home indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              width: 18,
              height: 2,
              borderRadius: 2,
              background: '#facc15',
              opacity: 0.8,
            }}
          />
        </div>

        {/* Rotation Arrows Indicator */}
        <div
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: '50%',
            border: '2px dashed rgba(250, 204, 21, 0.4)',
            animation: 'spinSlow 10s linear infinite',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Headline */}
      <h2
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.45rem',
          fontWeight: 700,
          color: '#facc15',
          margin: '0 0 8px 0',
          letterSpacing: '0.03em',
          textShadow: '0 2px 10px rgba(0, 0, 0, 0.7)',
        }}
      >
        Rotate Your Phone
      </h2>

      {/* Subtitle */}
      <p
        style={{
          color: '#cbd5e1',
          fontSize: '0.92rem',
          lineHeight: 1.45,
          maxWidth: 320,
          margin: '0 0 24px 0',
        }}
      >
        Card tables are designed wide for multiplayer seats, card piles, and your hand. Please rotate your phone to{' '}
        <strong style={{ color: '#fff' }}>Landscape mode</strong> for the true casino experience!
      </p>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: '100%',
          maxWidth: 290,
        }}
      >
        <button
          type="button"
          onClick={() => requestLandscapeFullscreen()}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#000',
            fontWeight: 800,
            fontSize: '0.96rem',
            padding: '12px 18px',
            borderRadius: 12,
            boxShadow: '0 4px 18px rgba(245, 158, 11, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span>📱</span>
          <span>Rotate & Fullscreen</span>
        </button>

        <button
          type="button"
          onClick={() => toggleForceLandscape()}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.9rem',
            padding: '10px 18px',
            borderRadius: 12,
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span>🔄</span>
          <span>Force Sideways (Landscape View)</span>
        </button>

        <button
          type="button"
          onClick={() => dismissPrompt()}
          style={{
            background: 'transparent',
            color: '#94a3b8',
            fontSize: '0.82rem',
            padding: '8px 12px',
            borderRadius: 8,
            border: 'none',
            textDecoration: 'underline',
            marginTop: 4,
          }}
        >
          Continue in portrait anyway
        </button>
      </div>
    </div>
  );
};
