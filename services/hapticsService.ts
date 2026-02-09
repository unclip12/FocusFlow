import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * Haptic Feedback Service for FocusFlow
 * Provides tactile feedback for user actions on native platforms
 * Automatically skips on web browsers
 */

const isNative = () => Capacitor.isNativePlatform();

export const haptic = {
  /**
   * Light impact - for subtle interactions
   * Use for: button taps, toggles, checkboxes
   */
  light: async () => {
    if (!isNative()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      console.warn('Haptic feedback failed:', e);
    }
  },

  /**
   * Medium impact - for standard interactions
   * Use for: menu navigation, modal opens, selections
   */
  medium: async () => {
    if (!isNative()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
      console.warn('Haptic feedback failed:', e);
    }
  },

  /**
   * Heavy impact - for significant interactions
   * Use for: timer start/stop, major actions, deletions
   */
  heavy: async () => {
    if (!isNative()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (e) {
      console.warn('Haptic feedback failed:', e);
    }
  },

  /**
   * Success notification - positive feedback
   * Use for: task completion, save success, goal achieved
   */
  success: async () => {
    if (!isNative()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (e) {
      console.warn('Haptic feedback failed:', e);
    }
  },

  /**
   * Warning notification - cautionary feedback
   * Use for: warnings, important alerts, caution needed
   */
  warning: async () => {
    if (!isNative()) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (e) {
      console.warn('Haptic feedback failed:', e);
    }
  },

  /**
   * Error notification - negative feedback
   * Use for: errors, failures, deletions, destructive actions
   */
  error: async () => {
    if (!isNative()) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (e) {
      console.warn('Haptic feedback failed:', e);
    }
  },

  /**
   * Selection changed - for picker/selector changes
   * Use for: date picker, dropdown selection, swipe navigation
   */
  selectionChanged: async () => {
    if (!isNative()) return;
    try {
      await Haptics.selectionChanged();
    } catch (e) {
      console.warn('Haptic feedback failed:', e);
    }
  }
};

/**
 * Vibrate device for a specific duration (milliseconds)
 * Use sparingly - can be disruptive
 */
export const vibrate = async (duration: number = 200) => {
  if (!isNative()) return;
  try {
    await Haptics.vibrate({ duration });
  } catch (e) {
    console.warn('Vibrate failed:', e);
  }
};
