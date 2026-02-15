/**
 * View Transitions API Service
 * Provides smooth, native-like transitions between views
 * Fallback for browsers without support
 */

export interface ViewTransitionOptions {
  name?: string;
  type?: 'fade' | 'slide' | 'scale' | 'custom';
  duration?: number;
}

/**
 * Check if View Transitions API is supported
 */
export const supportsViewTransitions = (): boolean => {
  return 'startViewTransition' in document;
};

/**
 * Execute a view transition with fallback
 * @param callback - Function to execute during transition
 * @param options - Transition options
 */
export const transitionView = async (
  callback: () => void | Promise<void>,
  options: ViewTransitionOptions = {}
): Promise<void> => {
  if (!supportsViewTransitions()) {
    // Fallback: just execute the callback
    await callback();
    return;
  }

  const transition = (document as any).startViewTransition(async () => {
    await callback();
  });

  // Wait for transition to complete
  try {
    await transition.finished;
  } catch (error) {
    console.warn('View transition failed:', error);
  }
};

/**
 * Navigate with view transition
 * @param navigateFn - Navigation function from router
 * @param path - Path to navigate to
 * @param options - Transition options
 */
export const transitionNavigate = async (
  navigateFn: (path: string) => void,
  path: string,
  options: ViewTransitionOptions = {}
): Promise<void> => {
  await transitionView(() => {
    navigateFn(path);
  }, options);
};

/**
 * Update state with view transition
 * @param updateFn - State update function
 * @param options - Transition options
 */
export const transitionState = async <T>(
  updateFn: (prev: T) => T,
  currentState: T,
  setState: (state: T) => void,
  options: ViewTransitionOptions = {}
): Promise<void> => {
  await transitionView(() => {
    setState(updateFn(currentState));
  }, options);
};

/**
 * Assign view transition name to element
 * Useful for custom transitions on specific elements
 */
export const setViewTransitionName = (
  element: HTMLElement | null,
  name: string
): void => {
  if (element && supportsViewTransitions()) {
    element.style.viewTransitionName = name;
  }
};

/**
 * Remove view transition name from element
 */
export const removeViewTransitionName = (
  element: HTMLElement | null
): void => {
  if (element) {
    element.style.viewTransitionName = '';
  }
};

/**
 * React Hook for View Transitions
 */
export const useViewTransition = () => {
  const transition = async (
    callback: () => void | Promise<void>
  ): Promise<void> => {
    await transitionView(callback);
  };

  return {
    transition,
    isSupported: supportsViewTransitions(),
  };
};

/**
 * Presets for common transitions
 */
export const transitionPresets = {
  fade: { type: 'fade' as const, duration: 300 },
  slideLeft: { type: 'slide' as const, duration: 350 },
  slideRight: { type: 'slide' as const, duration: 350 },
  scaleUp: { type: 'scale' as const, duration: 250 },
  scaleDown: { type: 'scale' as const, duration: 250 },
};

/**
 * Example usage in React component:
 * 
 * import { transitionView } from './services/viewTransitions';
 * 
 * const handleViewChange = async () => {
 *   await transitionView(() => {
 *     setCurrentView('knowledgeBase');
 *   });
 * };
 */
