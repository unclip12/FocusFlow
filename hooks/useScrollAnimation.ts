// 🆕 Feature #13: Intersection Observer for Scroll Animations
import { useEffect, useRef } from 'react';
import { useIntersectionObserver } from './useIntersectionObserver';

/**
 * Hook to automatically animate elements when they scroll into view
 * Uses Intersection Observer API (Feature #13)
 * 
 * Usage:
 * ```tsx
 * const ref = useScrollAnimation();
 * <div ref={ref} className="scroll-fade-in">Content</div>
 * ```
 */
export const useScrollAnimation = (options?: IntersectionObserverInit) => {
  const [ref, isVisible] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '50px',
    ...options
  });

  useEffect(() => {
    if (ref.current && isVisible) {
      ref.current.classList.add('animate-fade-in-up');
    }
  }, [isVisible, ref]);

  return ref;
};

/**
 * Initialize scroll animations for all elements with 'scroll-fade-in' class
 * Call this once on component mount
 */
export const initScrollAnimations = () => {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in-up');
          // Optional: unobserve after animation
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '50px'
    }
  );

  // Observe all elements with scroll-fade-in class
  document.querySelectorAll('.scroll-fade-in').forEach((el) => {
    observer.observe(el);
  });

  return () => observer.disconnect();
};
