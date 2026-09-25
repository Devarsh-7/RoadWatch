import { useEffect, useRef } from 'react';

/**
 * useIdleTimer — Monitors user interaction (mouse, keyboard, scroll, touch)
 * and invokes onIdle when inactive for timeoutMs (default: 15 minutes).
 */
export function useIdleTimer({ onIdle, timeoutMs = 15 * 60 * 1000, enabled = true }) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;

    let timerId = null;
    let lastActivity = Date.now();

    const resetTimer = () => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        if (onIdleRef.current) {
          onIdleRef.current();
        }
      }, timeoutMs);
    };

    const handleActivity = () => {
      const now = Date.now();
      // Throttle activity checks to once per second to prevent event spam
      if (now - lastActivity > 1000) {
        lastActivity = now;
        resetTimer();
      }
    };

    resetTimer();

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleActivity, { passive: true });
    });

    return () => {
      if (timerId) clearTimeout(timerId);
      events.forEach((evt) => {
        window.removeEventListener(evt, handleActivity);
      });
    };
  }, [timeoutMs, enabled]);
}
