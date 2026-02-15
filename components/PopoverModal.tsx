import React, { useEffect, useRef } from 'react';

/**
 * Native Popover API Modal Wrapper
 * Uses the browser's native popover attribute for better performance and accessibility
 * https://developer.mozilla.org/en-US/docs/Web/API/Popover_API
 */

interface PopoverModalProps {
    id: string;
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
}

export const PopoverModal: React.FC<PopoverModalProps> = ({ 
    id, 
    isOpen, 
    onClose, 
    children, 
    className = '' 
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const popover = popoverRef.current;
        if (!popover) return;

        // Show/hide popover using native API
        if (isOpen) {
            try {
                if (!popover.matches(':popover-open')) {
                    popover.showPopover();
                }
            } catch (e) {
                // Fallback for browsers without popover support
                console.warn('Popover API not supported, using fallback');
            }
        } else {
            try {
                if (popover.matches(':popover-open')) {
                    popover.hidePopover();
                }
            } catch (e) {
                // Fallback
            }
        }

        // Handle native popover close event
        const handleToggle = (e: Event) => {
            const toggleEvent = e as ToggleEvent;
            if (toggleEvent.newState === 'closed') {
                onClose();
            }
        };

        popover.addEventListener('toggle', handleToggle);
        return () => popover.removeEventListener('toggle', handleToggle);
    }, [isOpen, onClose]);

    return (
        <div
            ref={popoverRef}
            id={id}
            // @ts-ignore - popover attribute is experimental
            popover="auto"
            className={`popover-modal ${className}`}
            style={{
                border: 'none',
                padding: 0,
                margin: 'auto',
                maxWidth: '90vw',
                maxHeight: '90vh',
                pointerEvents: 'auto', // FIXED: Ensure clicks work inside popover
            }}
        >
            <div style={{ pointerEvents: 'auto' }}>
                {children}
            </div>
        </div>
    );
};

/**
 * Popover Modal Trigger Button
 * Use this to trigger a popover modal
 */
interface PopoverTriggerProps {
    targetId: string;
    children: React.ReactNode;
    className?: string;
}

export const PopoverTrigger: React.FC<PopoverTriggerProps> = ({ 
    targetId, 
    children, 
    className = '' 
}) => {
    return (
        <button
            // @ts-ignore - popovertarget is experimental
            popovertarget={targetId}
            className={className}
        >
            {children}
        </button>
    );
};
