import { useEffect, useRef, useState, RefObject } from 'react';

/**
 * Intersection Observer Hook
 * Detects when an element enters/exits the viewport
 * https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
 */

export interface UseIntersectionObserverOptions {
    threshold?: number | number[];
    root?: Element | null;
    rootMargin?: string;
    freezeOnceVisible?: boolean;
}

export const useIntersectionObserver = (
    options: UseIntersectionObserverOptions = {}
): [RefObject<HTMLDivElement>, boolean, IntersectionObserverEntry | null] => {
    const {
        threshold = 0.1,
        root = null,
        rootMargin = '0px',
        freezeOnceVisible = false,
    } = options;

    const elementRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
    const frozen = useRef(false);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        // Check if already frozen
        if (frozen.current) return;

        // Create observer
        const observer = new IntersectionObserver(
            ([entry]) => {
                setEntry(entry);
                const isIntersecting = entry.isIntersecting;

                setIsVisible(isIntersecting);

                // Freeze if option enabled and element is visible
                if (freezeOnceVisible && isIntersecting) {
                    frozen.current = true;
                    observer.disconnect();
                }
            },
            { threshold, root, rootMargin }
        );

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [threshold, root, rootMargin, freezeOnceVisible]);

    return [elementRef, isVisible, entry];
};

/**
 * Lazy load images hook
 */
export const useLazyLoadImage = (src: string) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [ref, isVisible] = useIntersectionObserver({
        threshold: 0.1,
        freezeOnceVisible: true,
    });

    useEffect(() => {
        if (isVisible && !imageSrc) {
            setImageSrc(src);
        }
    }, [isVisible, src, imageSrc]);

    return { ref, imageSrc, isLoaded: !!imageSrc };
};

/**
 * Infinite scroll hook
 */
export const useInfiniteScroll = (callback: () => void) => {
    const [ref, isVisible] = useIntersectionObserver({
        threshold: 0.1,
        rootMargin: '100px', // Trigger 100px before element is visible
    });

    useEffect(() => {
        if (isVisible) {
            callback();
        }
    }, [isVisible, callback]);

    return ref;
};
