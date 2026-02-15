import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for managing native Popover API state
 * Provides imperative control over popover modals
 */

export const usePopover = (defaultOpen = false) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const popoverIdRef = useRef(`popover-${Math.random().toString(36).slice(2, 9)}`);

    const open = useCallback(() => {
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
    }, []);

    const toggle = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    return {
        id: popoverIdRef.current,
        isOpen,
        open,
        close,
        toggle,
    };
};

/**
 * Hook for checking Popover API support
 */
export const usePopoverSupport = () => {
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        // Check if browser supports Popover API
        const supported = typeof HTMLElement !== 'undefined' && 
                         'popover' in HTMLElement.prototype;
        setIsSupported(supported);
        
        if (!supported) {
            console.info('📢 Popover API not supported, using fallback modals');
        }
    }, []);

    return isSupported;
};
