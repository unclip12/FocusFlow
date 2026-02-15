/**
 * Web Animations API Service
 * Programmatic animations using native browser API
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API
 */

export interface AnimationConfig {
    duration?: number;
    easing?: string;
    fill?: FillMode;
    iterations?: number;
    delay?: number;
}

/**
 * Check if Web Animations API is supported
 */
export const isWebAnimationsSupported = (): boolean => {
    return typeof Element !== 'undefined' && 'animate' in Element.prototype;
};

/**
 * Fade in animation
 */
export const fadeIn = (
    element: HTMLElement,
    config: AnimationConfig = {}
): Animation | null => {
    if (!isWebAnimationsSupported()) return null;

    const { duration = 300, easing = 'ease-out', fill = 'forwards' } = config;

    return element.animate(
        [
            { opacity: 0, transform: 'translateY(20px)' },
            { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration, easing, fill }
    );
};

/**
 * Fade out animation
 */
export const fadeOut = (
    element: HTMLElement,
    config: AnimationConfig = {}
): Animation | null => {
    if (!isWebAnimationsSupported()) return null;

    const { duration = 300, easing = 'ease-in', fill = 'forwards' } = config;

    return element.animate(
        [
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0.95)' },
        ],
        { duration, easing, fill }
    );
};

/**
 * Slide in from left
 */
export const slideInLeft = (
    element: HTMLElement,
    config: AnimationConfig = {}
): Animation | null => {
    if (!isWebAnimationsSupported()) return null;

    const { duration = 400, easing = 'ease-out', fill = 'forwards' } = config;

    return element.animate(
        [
            { transform: 'translateX(-100%)', opacity: 0 },
            { transform: 'translateX(0)', opacity: 1 },
        ],
        { duration, easing, fill }
    );
};

/**
 * Slide in from right
 */
export const slideInRight = (
    element: HTMLElement,
    config: AnimationConfig = {}
): Animation | null => {
    if (!isWebAnimationsSupported()) return null;

    const { duration = 400, easing = 'ease-out', fill = 'forwards' } = config;

    return element.animate(
        [
            { transform: 'translateX(100%)', opacity: 0 },
            { transform: 'translateX(0)', opacity: 1 },
        ],
        { duration, easing, fill }
    );
};

/**
 * Bounce animation
 */
export const bounce = (
    element: HTMLElement,
    config: AnimationConfig = {}
): Animation | null => {
    if (!isWebAnimationsSupported()) return null;

    const { duration = 600, iterations = 1 } = config;

    return element.animate(
        [
            { transform: 'translateY(0)' },
            { transform: 'translateY(-30px)', offset: 0.3 },
            { transform: 'translateY(0)', offset: 0.5 },
            { transform: 'translateY(-15px)', offset: 0.7 },
            { transform: 'translateY(0)' },
        ],
        { duration, iterations, easing: 'ease-out' }
    );
};

/**
 * Pulse animation (scale up and down)
 */
export const pulse = (
    element: HTMLElement,
    config: AnimationConfig = {}
): Animation | null => {
    if (!isWebAnimationsSupported()) return null;

    const { duration = 500, iterations = Infinity } = config;

    return element.animate(
        [
            { transform: 'scale(1)' },
            { transform: 'scale(1.05)' },
            { transform: 'scale(1)' },
        ],
        { duration, iterations, easing: 'ease-in-out' }
    );
};

/**
 * Shake animation
 */
export const shake = (
    element: HTMLElement,
    config: AnimationConfig = {}
): Animation | null => {
    if (!isWebAnimationsSupported()) return null;

    const { duration = 500 } = config;

    return element.animate(
        [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(0)' },
        ],
        { duration, easing: 'ease-in-out' }
    );
};

/**
 * Rotate animation
 */
export const rotate = (
    element: HTMLElement,
    config: AnimationConfig = {}
): Animation | null => {
    if (!isWebAnimationsSupported()) return null;

    const { duration = 600, iterations = 1 } = config;

    return element.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        { duration, iterations, easing: 'ease-in-out' }
    );
};

/**
 * Flash animation (for notifications)
 */
export const flash = (
    element: HTMLElement,
    config: AnimationConfig = {}
): Animation | null => {
    if (!isWebAnimationsSupported()) return null;

    const { duration = 500, iterations = 2 } = config;

    return element.animate(
        [{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }],
        { duration, iterations, easing: 'ease-in-out' }
    );
};

/**
 * Success checkmark animation
 */
export const successCheckmark = (
    element: HTMLElement,
    config: AnimationConfig = {}
): Animation | null => {
    if (!isWebAnimationsSupported()) return null;

    const { duration = 400 } = config;

    return element.animate(
        [
            { transform: 'scale(0) rotate(-45deg)', opacity: 0 },
            { transform: 'scale(1.2) rotate(-45deg)', opacity: 1, offset: 0.7 },
            { transform: 'scale(1) rotate(0deg)', opacity: 1 },
        ],
        { duration, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', fill: 'forwards' }
    );
};
