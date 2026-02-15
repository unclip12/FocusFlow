// 🆕 Feature #12: Web Share API Integration
import React, { useState } from 'react';
import { shareContent } from '../services/webShare';
import { bounce } from '../services/webAnimations';

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Reusable Share Button Component
 * Uses Web Share API (Feature #12) with Web Animations (Feature #14) feedback
 */
export const ShareButton: React.FC<ShareButtonProps> = ({ 
  title, 
  text, 
  url, 
  className = '', 
  children 
}) => {
  const [shared, setShared] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleShare = async () => {
    const success = await shareContent({ title, text, url });
    
    if (success) {
      setShared(true);
      
      // 🆕 Feature #14: Bounce animation on success
      if (buttonRef.current) {
        bounce(buttonRef.current, { duration: 600 });
      }
      
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleShare}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors ${className}`}
      title="Share via native share sheet"
    >
      {shared ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Shared!</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          {children || <span>Share</span>}
        </>
      )}
    </button>
  );
};

/**
 * Share Icon Button (compact version)
 */
export const ShareIconButton: React.FC<Omit<ShareButtonProps, 'children'>> = (props) => {
  const [shared, setShared] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleShare = async () => {
    const success = await shareContent({ 
      title: props.title, 
      text: props.text, 
      url: props.url 
    });
    
    if (success && buttonRef.current) {
      setShared(true);
      bounce(buttonRef.current);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleShare}
      className={`p-2 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors ${props.className}`}
      title="Share"
    >
      {shared ? (
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      )}
    </button>
  );
};
