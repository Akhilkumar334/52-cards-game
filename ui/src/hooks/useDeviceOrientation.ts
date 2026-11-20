import { useState, useEffect, useCallback } from 'react';

export interface DeviceOrientationState {
  isMobile: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  isShortScreen: boolean; // height <= 520px (e.g. phone in landscape)
  forceLandscape: boolean;
  isPromptDismissed: boolean;
  toggleForceLandscape: () => void;
  requestLandscapeFullscreen: () => Promise<boolean>;
  dismissPrompt: () => void;
}

export function useDeviceOrientation(): DeviceOrientationState {
  const [dimensions, setDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  const [forceLandscape, setForceLandscape] = useState<boolean>(() => {
    try {
      return localStorage.getItem('52cards_force_landscape') === 'true';
    } catch {
      return false;
    }
  });

  const [isPromptDismissed, setIsPromptDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('52cards_dismiss_rotate_prompt') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    if (screen?.orientation?.addEventListener) {
      screen.orientation.addEventListener('change', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (screen?.orientation?.removeEventListener) {
        screen.orientation.removeEventListener('change', handleResize);
      }
    };
  }, []);

  // Update body class for forced landscape styling
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (forceLandscape && dimensions.height > dimensions.width) {
      document.body.classList.add('force-landscape-active');
    } else {
      document.body.classList.remove('force-landscape-active');
    }
  }, [forceLandscape, dimensions]);

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches);

  const isMobile = isTouchDevice || dimensions.width <= 900 || dimensions.height <= 520;
  const isPortrait = dimensions.height > dimensions.width;
  const isLandscape = !isPortrait;
  const isShortScreen = dimensions.height <= 520;

  const toggleForceLandscape = useCallback(() => {
    setForceLandscape((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('52cards_force_landscape', String(next));
      } catch {}
      return next;
    });
  }, []);

  const dismissPrompt = useCallback(() => {
    setIsPromptDismissed(true);
    try {
      sessionStorage.setItem('52cards_dismiss_rotate_prompt', 'true');
    } catch {}
  }, []);

  const requestLandscapeFullscreen = useCallback(async (): Promise<boolean> => {
    let succeeded = false;

    // 1. Try requesting full screen
    try {
      const docEl = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };

      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen().catch(() => {});
      }
    } catch {}

    // 2. Try native Screen Orientation Lock
    try {
      const screenAny = screen as unknown as {
        orientation?: {
          lock?: (orientation: string) => Promise<void>;
        };
        lockOrientation?: (orientation: string) => boolean;
        mozLockOrientation?: (orientation: string) => boolean;
        msLockOrientation?: (orientation: string) => boolean;
      };

      if (screenAny.orientation?.lock) {
        await screenAny.orientation.lock('landscape');
        succeeded = true;
      } else if (screenAny.lockOrientation) {
        succeeded = screenAny.lockOrientation('landscape');
      }
    } catch (e) {
      console.log('[Orientation] Native orientation lock not supported or blocked:', e);
    }

    // 3. Fallback: If native orientation lock is not supported (e.g. iOS Safari),
    // activate virtual force-landscape immediately so the screen rotates sideways!
    if (!succeeded) {
      setForceLandscape(true);
      try {
        localStorage.setItem('52cards_force_landscape', 'true');
      } catch {}
      succeeded = true;
    }

    return succeeded;
  }, []);

  return {
    isMobile,
    isPortrait,
    isLandscape,
    isShortScreen,
    forceLandscape,
    isPromptDismissed,
    toggleForceLandscape,
    requestLandscapeFullscreen,
    dismissPrompt,
  };
}
