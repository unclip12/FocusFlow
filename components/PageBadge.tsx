

import React from 'react';
import { Attachment } from '../types';
import { ArrowPathIcon } from './Icons';

interface PageBadgeProps {
  pageNumber: string;
  attachments?: Attachment[];
  revisionCount?: number;
  onClick: () => void;
  className?: string;
}

export const PageBadge: React.FC<PageBadgeProps> = ({ pageNumber, attachments = [], revisionCount = 0, onClick, className = '' }) => {
  const hasImages = attachments.some(a => a.type === 'IMAGE');
  const firstImage = attachments.find(a => a.type === 'IMAGE');

  return (
    <div 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`group relative flex flex-col items-center justify-center min-w-[60px] h-14 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden ${className}`}
      title="View Page Details (Notes, Visuals, History)"
    >
      {/* Background Image Preview (if available) */}
      {firstImage && (
          <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
              <img src={firstImage.data} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0" />
          </div>
      )}

      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase z-10">PG</span>
      <span className="text-lg font-bold text-slate-700 dark:text-slate-200 z-10 leading-none">{pageNumber}</span>
      
      {/* Indicators */}
      <div className="absolute top-1 right-1 flex flex-col gap-0.5 z-10">
          {attachments.length > 0 && (
             <div className={`w-2 h-2 rounded-full ${hasImages ? 'bg-purple-500' : 'bg-slate-400'}`}></div>
          )}
      </div>
      
      {revisionCount > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-green-500/10 border-t border-green-500/20 h-3 flex items-center justify-center">
             <div className="flex items-center gap-0.5 text-[8px] font-bold text-green-600 dark:text-green-400">
                 <ArrowPathIcon className="w-2 h-2" /> {revisionCount}
             </div>
        </div>
      )}
    </div>
  );
};