/**
 * Screen Wake Lock API Service
 * Keeps screen awake during focus sessions
 * Perfect for Focus Timer and study sessions
 */

let wakeLock: WakeLockSentinel | null = null;

/**
 * Check if Wake Lock API is supported
 */
export const supportsWakeLock = (): boolean => {
  return 'wakeLock' in navigator;
};

/**
 * Request screen wake lock
 * @returns Promise resolving to success status
 */
export const requestWakeLock = async (): Promise<boolean> => {
  if (!supportsWakeLock()) {
    console.warn('⚠️ Wake Lock API not supported');
    return false;
  }

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    console.log('🔒 Screen wake lock activated');

    // Re-acquire wake lock when page becomes visible
    wakeLock.addEventListener('release', () => {
      console.log('🔓 Screen wake lock released');
    });

    return true;
  } catch (error) {
    console.error('❌ Failed to acquire wake lock:', error);
    return false;
  }
};

/**
 * Release screen wake lock
 */
export const releaseWakeLock = async (): Promise<void> => {
  if (wakeLock) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log('🔓 Screen wake lock released manually');
    } catch (error) {
      console.error('❌ Failed to release wake lock:', error);
    }
  }
};

/**
 * Check if wake lock is currently active
 */
export const isWakeLockActive = (): boolean => {
  return wakeLock !== null && !wakeLock.released;
};

/**
 * React Hook for Wake Lock
 */
export const useWakeLock = () => {
  const [isActive, setIsActive] = React.useState(false);

  const request = async () => {
    const success = await requestWakeLock();
    setIsActive(success);
    return success;
  };

  const release = async () => {
    await releaseWakeLock();
    setIsActive(false);
  };

  // Auto-reacquire on visibility change
  React.useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isActive) {
        await request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      release();
    };
  }, [isActive]);

  return {
    request,
    release,
    isActive,
    isSupported: supportsWakeLock(),
  };
};

// Import React for hook
import React from 'react';

/**
 * Example usage in Focus Timer:
 * 
 * import { requestWakeLock, releaseWakeLock } from './services/wakeLock';
 * 
 * const startFocusSession = async () => {
 *   await requestWakeLock(); // Keep screen on
 *   startTimer();
 * };
 * 
 * const endFocusSession = async () => {
 *   await releaseWakeLock(); // Allow screen to sleep
 *   stopTimer();
 * };
 * 
 * // Or use the hook:
 * const { request, release, isActive } = useWakeLock();
 * 
 * useEffect(() => {
 *   if (isTimerRunning) {
 *     request();
 *   } else {
 *     release();
 *   }
 * }, [isTimerRunning]);
 */
