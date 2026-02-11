import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Deep Link Service
 * Handles app URL schemes and universal links
 * Supports routes like focusflow://today, focusflow://page/123, etc.
 */

export type DeepLinkRoute = 
    | { type: 'DASHBOARD' }
    | { type: 'TODAY' }
    | { type: 'TIMER' }
    | { type: 'LOG' }
    | { type: 'PAGE', pageNumber: string }
    | { type: 'REVISION' }
    | { type: 'KNOWLEDGE_BASE' }
    | { type: 'PLANNER', date?: string }
    | { type: 'CHAT' }
    | { type: 'SETTINGS' }
    | { type: 'UNKNOWN', url: string };

export type DeepLinkHandler = (route: DeepLinkRoute) => void;

let handler: DeepLinkHandler | null = null;
let isInitialized = false;

/**
 * Initialize deep link service
 * @param onDeepLink Callback to handle deep link routes
 */
export async function initDeepLinkService(onDeepLink: DeepLinkHandler): Promise<void> {
    if (isInitialized) {
        console.warn('Deep link service already initialized');
        return;
    }

    handler = onDeepLink;

    if (Capacitor.isNativePlatform()) {
        // Listen for app URL events (native platforms)
        App.addListener('appUrlOpen', (event) => {
            console.log('Deep link opened:', event.url);
            const route = parseDeepLink(event.url);
            handler?.(route);
        });

        // Check if app was opened with a URL
        const launchUrl = await App.getLaunchUrl();
        if (launchUrl?.url) {
            console.log('App launched with URL:', launchUrl.url);
            const route = parseDeepLink(launchUrl.url);
            handler?.(route);
        }
    } else {
        // Web: Handle hash-based routing or query parameters
        const handleWebDeepLink = () => {
            const hash = window.location.hash.slice(1); // Remove #
            if (hash) {
                console.log('Web deep link:', hash);
                const route = parseDeepLink(`focusflow://${hash}`);
                handler?.(route);
            }
        };

        // Check on load
        handleWebDeepLink();

        // Listen for hash changes
        window.addEventListener('hashchange', handleWebDeepLink);
    }

    isInitialized = true;
    console.log('Deep link service initialized');
}

/**
 * Parse a deep link URL into a route object
 * @param url The deep link URL (e.g., focusflow://today, focusflow://page/123)
 * @returns Parsed route
 */
export function parseDeepLink(url: string): DeepLinkRoute {
    try {
        // Handle both custom scheme (focusflow://) and https URLs
        let path = '';
        
        if (url.startsWith('focusflow://')) {
            path = url.replace('focusflow://', '');
        } else if (url.startsWith('https://')) {
            // Universal links: https://focusflow.app/today
            const urlObj = new URL(url);
            path = urlObj.pathname.slice(1); // Remove leading /
        } else {
            return { type: 'UNKNOWN', url };
        }

        // Remove trailing slash
        path = path.replace(/\/$/, '');

        // Parse the path
        const segments = path.split('/');
        const action = segments[0]?.toLowerCase();

        switch (action) {
            case '':
            case 'dashboard':
            case 'home':
                return { type: 'DASHBOARD' };

            case 'today':
            case 'plan':
                return { type: 'TODAY' };

            case 'timer':
            case 'focus':
                return { type: 'TIMER' };

            case 'log':
            case 'session':
                return { type: 'LOG' };

            case 'page':
                if (segments[1]) {
                    return { type: 'PAGE', pageNumber: segments[1] };
                }
                return { type: 'KNOWLEDGE_BASE' };

            case 'revision':
            case 'revise':
                return { type: 'REVISION' };

            case 'kb':
            case 'knowledge':
                return { type: 'KNOWLEDGE_BASE' };

            case 'planner':
                return { type: 'PLANNER', date: segments[1] };

            case 'chat':
            case 'ai':
                return { type: 'CHAT' };

            case 'settings':
            case 'config':
                return { type: 'SETTINGS' };

            default:
                return { type: 'UNKNOWN', url };
        }
    } catch (error) {
        console.error('Failed to parse deep link:', error);
        return { type: 'UNKNOWN', url };
    }
}

/**
 * Create a deep link URL for sharing
 * @param route The route to link to
 * @returns Shareable deep link URL
 */
export function createDeepLink(route: DeepLinkRoute): string {
    const baseUrl = 'focusflow://';

    switch (route.type) {
        case 'DASHBOARD':
            return `${baseUrl}dashboard`;

        case 'TODAY':
            return `${baseUrl}today`;

        case 'TIMER':
            return `${baseUrl}timer`;

        case 'LOG':
            return `${baseUrl}log`;

        case 'PAGE':
            return `${baseUrl}page/${route.pageNumber}`;

        case 'REVISION':
            return `${baseUrl}revision`;

        case 'KNOWLEDGE_BASE':
            return `${baseUrl}knowledge`;

        case 'PLANNER':
            if (route.date) {
                return `${baseUrl}planner/${route.date}`;
            }
            return `${baseUrl}planner`;

        case 'CHAT':
            return `${baseUrl}chat`;

        case 'SETTINGS':
            return `${baseUrl}settings`;

        default:
            return baseUrl;
    }
}

/**
 * Open a deep link (for testing or internal navigation)
 * @param route The route to open
 */
export function openDeepLink(route: DeepLinkRoute): void {
    if (handler) {
        handler(route);
    } else {
        console.warn('Deep link handler not initialized');
    }
}

/**
 * Test if deep linking is supported on this platform
 */
export function isDeepLinkSupported(): boolean {
    return Capacitor.isNativePlatform() || typeof window !== 'undefined';
}

/**
 * Clean up deep link service
 */
export function cleanupDeepLinkService(): void {
    if (Capacitor.isNativePlatform()) {
        App.removeAllListeners();
    }
    handler = null;
    isInitialized = false;
    console.log('Deep link service cleaned up');
}

/**
 * Get example deep links for documentation/testing
 */
export function getExampleDeepLinks(): { label: string; url: string }[] {
    return [
        { label: 'Dashboard', url: 'focusflow://dashboard' },
        { label: "Today's Plan", url: 'focusflow://today' },
        { label: 'Focus Timer', url: 'focusflow://timer' },
        { label: 'Log Session', url: 'focusflow://log' },
        { label: 'View Page 123', url: 'focusflow://page/123' },
        { label: 'Revision Hub', url: 'focusflow://revision' },
        { label: 'Knowledge Base', url: 'focusflow://knowledge' },
        { label: 'Planner', url: 'focusflow://planner' },
        { label: 'AI Chat', url: 'focusflow://chat' },
        { label: 'Settings', url: 'focusflow://settings' },
    ];
}
