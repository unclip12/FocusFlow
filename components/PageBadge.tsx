import React from 'react';
import { Attachment } from '../types';
import { ArrowPathIcon } from './Icons';

interface PageBadgeProps {
  pageNumber: string;
  attachments?: Attachment[];
  revisionCount?: number;
  progress?: number; // 0 to 100 representing completion (subtopics or page status)
  onClick: () => void;
  className?: string;
}

export const PageBadge: React.FC<PageBadgeProps> = ({ pageNumber, attachments = [], revisionCount = 0, progress = 0, onClick, className = '' }) => {
  const hasImages = attachments.some(a => a.type === 'IMAGE');
  
  // Ensure progress is clamped 0-100
  const fillPercent = Math.min(100, Math.max(0, progress));
  const isComplete = fillPercent === 100;
  const isUntouched = fillPercent === 0;

  // Text color based on progress:
  // - If 0% (red bg): WHITE text
  // - If 1-49% (green liquid filling): DARK text (visible on light green/white)
  // - If 50-100% (mostly green): WHITE text (visible on dark green)
  const getTextColor = () => {
    if (isUntouched) return 'text-white'; // White on red
    if (fillPercent < 50) return 'text-slate-800 dark:text-slate-900'; // Dark on light green
    return 'text-white'; // White on dark green
  };

  return (
    <div 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`group relative flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all overflow-hidden border border-slate-200 dark:border-slate-700 ${className}`}
      style={{
          width: '64px',
          minWidth: '64px',
          maxWidth: '64px',
          height: '56px',
          flexShrink: 0,
          boxShadow: isComplete 
            ? '0 0 15px rgba(34, 197, 94, 0.6)' // Green Glow if full
            : isUntouched 
                ? '0 0 10px rgba(239, 68, 68, 0.3)' // Red Glow if empty
                : '0 4px 6px rgba(0,0,0,0.1)' // Normal shadow
      }}
      title={`Page ${pageNumber}: ${Math.round(fillPercent)}% Completed`}
    >
      {/* 1. Background: Red if 0%, Light Green if > 0% */}
      <div className={`absolute inset-0 transition-colors z-0 ${fillPercent > 0 ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-500 dark:bg-red-600'}`}></div>

      {/* 2. Liquid Fill (Finished / Green) */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-green-500 dark:bg-green-500 transition-all duration-700 ease-out z-[1]"
        style={{ height: `${fillPercent}%` }}
      >
          {/* Subtle wave effect at the top of the liquid */}
          {fillPercent > 0 && fillPercent < 100 && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/30 w-full"></div>
          )}
      </div>

      {/* 3. Background Image Preview Overlay (if available) - Low Opacity */}
      {hasImages && (
          <div className="absolute inset-0 opacity-20 bg-black/20 pointer-events-none z-[2]"></div>
      )}

      {/* 4. Content Layer (Z-Index High to stay visible) */}
      <div className="relative z-10 flex flex-col items-center">
          {/* PG label - always white for good contrast */}
          <span className={`text-[9px] font-black uppercase drop-shadow-md ${isUntouched ? 'text-white' : 'text-white/80'}`}>PG</span>
          {/* Page Number - color based on progress */}
          <span className={`text-lg font-black drop-shadow-md leading-none ${getTextColor()}`}>
            {pageNumber}
          </span>
      </div>
      
      {/* 5. Indicators */}
      <div className="absolute top-1 right-1 flex flex-col gap-0.5 z-20">
          {attachments.length > 0 && (
             <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${hasImages ? 'bg-purple-200' : 'bg-white'}`}></div>
          )}
      </div>
      
      {/* 6. Revision Count Footer */}
      {revisionCount > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/20 h-3.5 flex items-center justify-center z-20 backdrop-blur-[1px]">
             <div className="flex items-center gap-0.5 text-[9px] font-bold text-white">
                 <ArrowPathIcon className="w-2.5 h-2.5" /> {revisionCount}
             </div>
        </div>
      )}
    </div>
  );
};
