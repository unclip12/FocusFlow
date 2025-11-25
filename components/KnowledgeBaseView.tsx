
import React, { useState, useMemo, useRef } from 'react';
import { KnowledgeBaseEntry, SYSTEMS, CATEGORIES, VideoResource, Attachment, StudySession, TrackableItem, getAdjustedDate } from '../types';
import { BookOpenIcon, VideoIcon, FireIcon, LinkIcon, PlusIcon, DatabaseIcon, SparklesIcon, PaperClipIcon, PhotoIcon, DocumentIcon, BarsArrowUpIcon, BarsArrowDownIcon, ChartBarIcon, CheckCircleIcon, TrashIcon, ChevronDownIcon, ListCheckIcon, ClockIcon, CalendarIcon, ListCheckIcon as SubtopicIcon, ArrowPathIcon } from './Icons';
import { extractTopicFromImage } from '../services/geminiService';
import { PageBadge } from './PageBadge';
import { uploadFile } from '../services/firebase';
import { AttachmentViewerModal } from './AttachmentViewerModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { SubtopicDetailModal } from './SubtopicDetailModal';

// Robust ID generator
const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

interface KnowledgeBaseViewProps {
  data: KnowledgeBaseEntry[];
  sessions?: StudySession[];
  onUpdateEntry: (entry: KnowledgeBaseEntry) => void;
  onDeleteEntry?: (pageNumber: string) => void;
  onViewPage: (page: string) => void;
  onRefreshData?: () => void; // New Prop for manual integrity check
}

type SortOption = 'PAGE' | 'TOPIC' | 'SYSTEM' | 'SUBJECT' | 'REVISIONS' | 'STUDIED' | 'LAST_STUDIED';
type SortOrder = 'ASC' | 'DESC';
type ViewMode = 'PAGE_WISE' | 'SUBTOPIC_WISE';

// Helper to calculate progress (0-100) for a page
const calculatePageProgress = (entry: KnowledgeBaseEntry): number => {
    // If there are subtopics, calculate based on how many have been studied at least once
    if (entry.topics && entry.topics.length > 0) {
        // Check lastStudiedAt (implies it has been touched) instead of revisionCount
        const completedTopics = entry.topics.filter(t => t.lastStudiedAt !== null).length;
        return (completedTopics / entry.topics.length) * 100;
    }
    // If no subtopics, fallback to page level status
    return entry.lastStudiedAt !== null ? 100 : 0;
};

// Helper to render text with bold markdown (**text**)
const RenderTextWithBold = ({ text }: { text: string }) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
        <span>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <span key={i} className="font-bold text-slate-800 dark:text-slate-100">{part.slice(2, -2)}</span>;
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};

// --- COLLAPSIBLE TOPIC COMPONENT ---
export const CollapsibleTopic: React.FC<{ 
    topic: TrackableItem, 
    baseRevisionCount: number,
    onOpenModal?: (topic: TrackableItem) => void 
}> = ({ topic, baseRevisionCount, onOpenModal }) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasContent = topic.content && topic.content.length > 0;
    
    // Logic: Show +N only if revisions exist.
    // Color: Green if studied at least once (lastStudiedAt exists).
    const isStudied = topic.lastStudiedAt !== null;
    const revisionLabel = topic.revisionCount > 0 ? `+${topic.revisionCount}` : null;

    return (
        <div className="mb-2">
            <div className="flex items-center gap-2 w-full py-1 group">
                {/* Left Arrow: Expands Context Inline */}
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                    className={`p-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-slate-500 hover:text-indigo-600 transition-colors flex-shrink-0 ${!hasContent && !isOpen ? 'opacity-50' : ''}`}
                    title={hasContent ? "Expand context" : "No inline context"}
                >
                    <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Text: Opens Modal */}
                <button 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        if (onOpenModal) onOpenModal(topic); 
                    }}
                    className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left truncate flex-grow flex items-center gap-2"
                >
                    <div className={`w-2 h-2 rounded-full ${isStudied ? 'bg-green-500' : 'bg-red-400'}`}></div>
                    {topic.name}
                    {revisionLabel && (
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                            {revisionLabel}
                        </span>
                    )}
                </button>
            </div>
            
            {isOpen && hasContent && (
                <div className="ml-8 pl-3 border-l-2 border-slate-200 dark:border-slate-700 mt-1 py-1 animate-fade-in-up">
                    <ul className="space-y-2">
                        {topic.content!.map((point, idx) => (
                            <li key={idx} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-2">
                                <span className="text-indigo-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                                <span><RenderTextWithBold text={point} /></span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {isOpen && !hasContent && (
                <div className="ml-8 text-[10px] text-slate-400 italic">No context details added.</div>
            )}
        </div>
    );
};

const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({ data, sessions = [], onUpdateEntry, onDeleteEntry, onViewPage, onRefreshData }) => {
  const [search, setSearch] = useState('');
  const [selectedSystem, setSelectedSystem] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('PAGE');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  const [viewMode, setViewMode] = useState<ViewMode>('PAGE_WISE');
  
  // Edit Mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<KnowledgeBaseEntry>>({});
  
  // Delete State
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  // Subtopic Modal State
  const [viewingSubtopic, setViewingSubtopic] = useState<{ topic: TrackableItem, parent: KnowledgeBaseEntry } | null>(null);

  // Helper for tags and subtopics input
  const [tagsInput, setTagsInput] = useState('');
  const [subTopicsInput, setSubTopicsInput] = useState('');
  
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');

  // AI Loading State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Viewing Attachment
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);

  const handleRefresh = async () => {
      if (onRefreshData) {
          setIsRefreshing(true);
          await onRefreshData();
          setTimeout(() => setIsRefreshing(false), 1000);
      }
  };

  // --- STATISTICS CALCULATIONS ---
  const stats = useMemo(() => {
      // 1. Total Pages
      const totalPages = data.length;
      
      // 2. Total Subtopics
      const totalSubtopics = data.reduce((acc, curr) => acc + (curr.topics?.length || 0), 0);
      
      // 3. Pages Studied (Strict 100% completion)
      const studiedPagesCount = data.filter(entry => calculatePageProgress(entry) === 100).length;

      // 4. Subtopics Studied
      const totalSubtopicsStudied = data.reduce((acc, curr) => {
          if (curr.topics && curr.topics.length > 0) {
              return acc + curr.topics.filter(t => t.lastStudiedAt !== null).length;
          }
          // If no subtopics, we don't add to this count to avoid skewing, or check page level logs if implemented
          return acc;
      }, 0);

      // 5. Average Pages Per Day
      // Get all logs across all pages
      const allLogs = data.flatMap(kb => kb.logs || []);
      let avgPagesPerDay = 0;
      let daysElapsed = 1;

      if (allLogs.length > 0) {
          // Sort chronologically
          allLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const firstLogDate = new Date(allLogs[0].timestamp);
          const now = new Date();
          
          // Calculate days difference (ensure at least 1 day to avoid div/0)
          const diffTime = Math.abs(now.getTime() - firstLogDate.getTime());
          daysElapsed = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
          
          // Simple Metric: Studied Pages / Days Elapsed
          avgPagesPerDay = studiedPagesCount / daysElapsed;
      }

      // 6. Estimated Time to Finish
      const remainingPages = totalPages - studiedPagesCount;
      const estimatedDaysLeft = avgPagesPerDay > 0 ? Math.ceil(remainingPages / avgPagesPerDay) : 0;

      return {
          totalPages,
          totalSubtopics,
          studiedPagesCount,
          totalSubtopicsStudied,
          avgPagesPerDay: avgPagesPerDay.toFixed(1),
          estimatedDaysLeft
      };
  }, [data]);


  // Helper to calculate the "Base Revision" of a page
  const calculateBaseRevision = (entry: KnowledgeBaseEntry) => {
      if (!entry.topics || entry.topics.length === 0) return entry.revisionCount;
      const minRev = Math.min(...entry.topics.map(t => t.revisionCount));
      return minRev;
  };

  const filteredData = useMemo(() => {
    let result = data.filter(entry => {
        let matchSearch = true;
        if (search) {
          try {
            const regex = new RegExp(search, 'i');
            matchSearch = regex.test(entry.title) || 
                          regex.test(entry.pageNumber) ||
                          (entry.tags ? entry.tags.some(t => regex.test(t)) : false) ||
                          (entry.topics ? entry.topics.some(t => regex.test(t.name)) : false);
          } catch (e) {
            const lowerSearch = search.toLowerCase();
            matchSearch = entry.title.toLowerCase().includes(lowerSearch) || 
                          entry.pageNumber.includes(lowerSearch) ||
                          (entry.tags ? entry.tags.some(t => t.toLowerCase().includes(lowerSearch)) : false) ||
                          (entry.topics ? entry.topics.some(t => t.name.toLowerCase().includes(lowerSearch)) : false);
          }
        }

        const matchSystem = selectedSystem ? entry.system === selectedSystem : true;
        return matchSearch && matchSystem;
    });

    // Sorting Logic
    result.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'PAGE':
                const numA = parseInt(a.pageNumber);
                const numB = parseInt(b.pageNumber);
                if (!isNaN(numA) && !isNaN(numB)) {
                    comparison = numA - numB;
                } else {
                    comparison = a.pageNumber.localeCompare(b.pageNumber, undefined, { numeric: true });
                }
                break;
            case 'TOPIC':
                comparison = a.title.localeCompare(b.title);
                break;
            case 'SYSTEM':
                comparison = a.system.localeCompare(b.system);
                break;
            case 'SUBJECT':
                comparison = a.subject.localeCompare(b.subject);
                break;
            case 'REVISIONS':
                // Sort by the calculated base revision (mastery level of the whole page)
                const revA = calculateBaseRevision(a);
                const revB = calculateBaseRevision(b);
                comparison = revA - revB;
                break;
            case 'STUDIED':
                // Sort by studied status (progress)
                const progA = calculatePageProgress(a);
                const progB = calculatePageProgress(b);
                // Default DESC for "Studied" usually means show completed first
                return sortOrder === 'ASC' ? progA - progB : progB - progA; 
            case 'LAST_STUDIED':
                // Sort by date
                const dateA = a.lastStudiedAt ? new Date(a.lastStudiedAt).getTime() : 0;
                const dateB = b.lastStudiedAt ? new Date(b.lastStudiedAt).getTime() : 0;
                // Default DESC means most recent first
                return sortOrder === 'ASC' ? dateA - dateB : dateB - dateA;
        }
        return sortOrder === 'ASC' ? comparison : -comparison;
    });

    return result;
  }, [data, search, selectedSystem, sortBy, sortOrder]);

  // --- SUBTOPIC FLATTENING ---
  const flattenedSubtopics = useMemo(() => {
      if (viewMode === 'PAGE_WISE') return [];

      const allSubs = filteredData.flatMap(entry => {
          if (!entry.topics || entry.topics.length === 0) {
              return [{
                  id: entry.pageNumber,
                  pageNumber: entry.pageNumber,
                  title: entry.title,
                  parentTitle: entry.system,
                  revisionCount: entry.revisionCount,
                  nextRevisionAt: entry.nextRevisionAt,
                  isPageFallback: true,
                  originalEntry: entry,
                  originalTopic: { id: 'page-fallback', name: entry.title, revisionCount: entry.revisionCount, lastStudiedAt: entry.lastStudiedAt, nextRevisionAt: entry.nextRevisionAt, currentRevisionIndex: entry.currentRevisionIndex, logs: [] } as TrackableItem
              }];
          }

          return entry.topics.map(topic => ({
              id: `${entry.pageNumber}-${topic.id}`,
              pageNumber: entry.pageNumber,
              title: topic.name,
              parentTitle: entry.title,
              revisionCount: topic.revisionCount,
              nextRevisionAt: topic.nextRevisionAt,
              isPageFallback: false,
              originalEntry: entry,
              originalTopic: topic
          }));
      });

      // Handle sorting for subtopics specifically
      allSubs.sort((a, b) => {
          let comparison = 0;
          switch (sortBy) {
              case 'REVISIONS':
                  comparison = a.revisionCount - b.revisionCount;
                  break;
              case 'PAGE':
                  const numA = parseInt(a.pageNumber);
                  const numB = parseInt(b.pageNumber);
                  if (!isNaN(numA) && !isNaN(numB)) comparison = numA - numB;
                  else comparison = a.pageNumber.localeCompare(b.pageNumber, undefined, { numeric: true });
                  break;
              default: 
                  comparison = 0;
          }
          return sortOrder === 'ASC' ? comparison : -comparison;
      });

      return allSubs;

  }, [filteredData, viewMode, sortBy, sortOrder]);


  const startEdit = (entry: KnowledgeBaseEntry) => {
    setEditingId(entry.pageNumber);
    setEditForm({ ...entry, attachments: entry.attachments || [] });
    setTagsInput(entry.tags ? entry.tags.join(', ') : '');
    setSubTopicsInput(entry.topics ? entry.topics.map(t => t.name).join('\n') : '');
    setNewVideoUrl('');
    setNewVideoTitle('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setTagsInput('');
    setSubTopicsInput('');
    setIsAnalyzing(false);
    setIsUploading(false);
  };

  const saveEdit = () => {
    if (editForm.pageNumber && !isUploading) {
      const updatedTags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const updatedSubTopicNames = subTopicsInput.split('\n').map(t => t.trim()).filter(t => t.length > 0);
      const existingTopics = editForm.topics || [];
      
      const updatedTopics: TrackableItem[] = updatedSubTopicNames.map(name => {
          const existing = existingTopics.find(t => t.name === name);
          if (existing) {
              return existing;
          }
          return {
              id: generateId(),
              name: name,
              revisionCount: 0,
              lastStudiedAt: null,
              nextRevisionAt: null,
              currentRevisionIndex: 0,
              logs: []
          };
      });

      onUpdateEntry({ 
          ...editForm, 
          tags: updatedTags,
          topics: updatedTopics
      } as KnowledgeBaseEntry);
      setEditingId(null);
      setTagsInput('');
      setSubTopicsInput('');
    }
  };

  const addVideoToEdit = () => {
    if (!newVideoUrl || !newVideoTitle) return;
    const currentVideos = editForm.videoLinks || [];
    setEditForm({
      ...editForm,
      videoLinks: [...currentVideos, { id: generateId(), title: newVideoTitle, url: newVideoUrl }]
    });
    setNewVideoUrl('');
    setNewVideoTitle('');
  };

  const handleExtractTopics = async () => { /* ... */ };
  const removeAttachment = (id: string) => {
      setEditForm(prev => ({
          ...prev,
          attachments: (prev.attachments || []).filter(a => a.id !== id)
      }));
  };
  const removeVideoFromEdit = (videoId: string) => {
    const currentVideos = editForm.videoLinks || [];
    setEditForm({
      ...editForm,
      videoLinks: currentVideos.filter(v => v.id !== videoId)
    });
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsUploading(true);
          try {
              const url = await uploadFile(file);
              const newAttachment: Attachment = {
                  id: generateId(),
                  name: file.name,
                  type: file.type.startsWith('image/') ? 'IMAGE' : file.type === 'application/pdf' ? 'PDF' : 'OTHER',
                  data: url
              };
              setEditForm(prev => ({
                  ...prev,
                  attachments: [...(prev.attachments || []), newAttachment]
              }));
          } catch (error) {
              console.warn("Upload failed", error);
          } finally {
              setIsUploading(false);
          }
      }
  };

  const toggleSortOrder = () => {
      setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
  };

  const confirmDelete = (pageNumber: string) => {
      setEntryToDelete(pageNumber);
  };

  const executeDelete = () => {
      if (entryToDelete && onDeleteEntry) {
          onDeleteEntry(entryToDelete);
          setEntryToDelete(null);
      }
  };

  const handleOpenSubtopicModal = (topic: TrackableItem, parent: KnowledgeBaseEntry) => {
      setViewingSubtopic({ topic, parent });
  };

  const handleUpdateSubtopic = (updatedSubtopic: TrackableItem) => {
      if (!viewingSubtopic) return;
      const parent = viewingSubtopic.parent;
      const updatedTopics = parent.topics.map(t => t.id === updatedSubtopic.id ? updatedSubtopic : t);
      const updatedEntry = { ...parent, topics: updatedTopics };
      onUpdateEntry(updatedEntry);
      setViewingSubtopic({ topic: updatedSubtopic, parent: updatedEntry });
  };

  return (
    <div className="animate-fade-in space-y-6">
      {viewingAttachment && <AttachmentViewerModal attachment={viewingAttachment} onClose={() => setViewingAttachment(null)} />}
      
      {viewingSubtopic && (
          <SubtopicDetailModal 
              isOpen={!!viewingSubtopic}
              onClose={() => setViewingSubtopic(null)}
              subtopic={viewingSubtopic.topic}
              parentEntry={viewingSubtopic.parent}
              onUpdate={handleUpdateSubtopic}
          />
      )}

      <DeleteConfirmationModal 
          isOpen={!!entryToDelete}
          onClose={() => setEntryToDelete(null)}
          onConfirm={executeDelete}
          title="Delete Knowledge Base Entry?"
          message={`Are you sure you want to delete Page ${entryToDelete}? This will remove all associated logs and revision history.`}
      />

      {/* Header and Stats */}
      <div>
        <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <DatabaseIcon className="w-6 h-6 text-primary" />
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Knowledge Base</h2>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs font-medium text-slate-500 dark:text-slate-400 ml-8">
                        <span>Total Pages = <strong className="text-slate-800 dark:text-slate-200">{stats.totalPages}</strong></span>
                        <span>Total Subtopics = <strong className="text-slate-800 dark:text-slate-200">{stats.totalSubtopics}</strong></span>
                    </div>
                </div>
                
                {/* View Toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start">
                    <button 
                        onClick={() => setViewMode('PAGE_WISE')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'PAGE_WISE' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Page Wise
                    </button>
                    <button 
                        onClick={() => setViewMode('SUBTOPIC_WISE')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'SUBTOPIC_WISE' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Subtopic Wise
                    </button>
                </div>
            </div>
        </div>

        {/* New Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            {/* Card 1: Pages Studied */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pages Completed</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-green-600 dark:text-green-400">{stats.studiedPagesCount}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">/ {stats.totalPages}</span>
                    </div>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
                    <BookOpenIcon className="w-5 h-5" />
                </div>
            </div>

            {/* Card 2: Subtopics Studied */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subtopics Done</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{stats.totalSubtopicsStudied}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">/ {stats.totalSubtopics}</span>
                    </div>
                </div>
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <SubtopicIcon className="w-5 h-5" />
                </div>
            </div>

            {/* Card 3: Average Speed */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Speed</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.avgPagesPerDay}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">pg/day</span>
                    </div>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                    <ChartBarIcon className="w-5 h-5" />
                </div>
            </div>

            {/* Card 4: Estimated Time */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Est. Completion</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                            {stats.estimatedDaysLeft > 0 ? stats.estimatedDaysLeft : (stats.avgPagesPerDay === '0.0' && stats.studiedPagesCount < stats.totalPages ? '∞' : 'Done')}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">days left</span>
                    </div>
                </div>
                <div className="p-2 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
                    <CalendarIcon className="w-5 h-5" />
                </div>
            </div>
        </div>
        
        {/* Stats Summary & Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-2 w-full mb-6 items-stretch sm:items-center bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <input 
                type="text" 
                placeholder={viewMode === 'SUBTOPIC_WISE' ? "Search subtopics..." : "Search pages..."}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm w-full sm:w-48 focus:ring-2 focus:ring-primary/20 outline-none"
            />
            
            <select 
                value={selectedSystem}
                onChange={e => setSelectedSystem(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm w-full sm:w-40"
            >
                <option value="">All Systems</option>
                {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* REFRESH BUTTON */}
            {onRefreshData && (
                <button 
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 transition-colors disabled:opacity-50"
                    title="Full Integrity Scan"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            )}

            <div className="flex gap-2 items-center ml-auto">
                <select 
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortOption)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm cursor-pointer hover:border-indigo-300 transition-colors"
                >
                    <option value="PAGE">Page #</option>
                    <option value="STUDIED">Studied Status</option>
                    <option value="LAST_STUDIED">Last Studied Date</option>
                    <option value="TOPIC">Topic (A-Z)</option>
                    <option value="SYSTEM">System</option>
                    <option value="REVISIONS">Number of Revisions</option>
                </select>
                <button onClick={toggleSortOrder} className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
                    {sortOrder === 'ASC' ? <BarsArrowDownIcon className="w-5 h-5" /> : <BarsArrowUpIcon className="w-5 h-5" />}
                </button>
            </div>
        </div>
      </div>

      {/* VIEW RENDERING */}
      {viewMode === 'PAGE_WISE' ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="p-4 w-24">Page #</th>
                    <th className="p-4">Topic & Subtopics</th>
                    <th className="p-4">System / Subject</th>
                    <th className="p-4">Resources</th>
                    <th className="p-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredData.map(entry => {
                        const baseRevision = calculateBaseRevision(entry);
                        const progress = calculatePageProgress(entry);

                        if (editingId === entry.pageNumber) {
                            // Edit Row (Unchanged)
                            return (
                                <tr key={entry.pageNumber} className="bg-indigo-50/30 dark:bg-indigo-900/10">
                                    <td className="p-4 align-top font-bold text-slate-700 dark:text-slate-300">
                                        {entry.pageNumber}
                                        <div className="mt-2">
                                            <label className={`w-8 h-8 flex items-center justify-center rounded border border-indigo-200 dark:border-slate-600 bg-white dark:bg-slate-700 cursor-pointer ${isUploading ? 'opacity-50' : ''}`}>
                                                <PlusIcon className="w-4 h-4 text-indigo-500" />
                                                <input type="file" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                                            </label>
                                        </div>
                                    </td>
                                    <td className="p-4 align-top space-y-2 min-w-[300px]">
                                        <input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full p-1 border rounded text-sm font-bold bg-white dark:bg-slate-700 dark:text-white" placeholder="Topic" />
                                        <textarea value={subTopicsInput} onChange={e => setSubTopicsInput(e.target.value)} className="w-full p-1 border rounded text-xs min-h-[60px] bg-white dark:bg-slate-700 dark:text-white" placeholder="Subtopics..." />
                                        {editForm.attachments && editForm.attachments.length > 0 && (
                                            <button onClick={handleExtractTopics} disabled={isAnalyzing} className="text-[10px] bg-indigo-500 text-white px-2 py-1 rounded flex items-center gap-1"><SparklesIcon className="w-3 h-3"/> Auto-Extract</button>
                                        )}
                                    </td>
                                    <td className="p-4 align-top space-y-2">
                                        <select value={editForm.system} onChange={e => setEditForm({...editForm, system: e.target.value})} className="text-xs p-1 border rounded w-full bg-white dark:bg-slate-700 dark:text-white">{SYSTEMS.map(s=><option key={s} value={s}>{s}</option>)}</select>
                                        <select value={editForm.subject} onChange={e => setEditForm({...editForm, subject: e.target.value})} className="text-xs p-1 border rounded w-full bg-white dark:bg-slate-700 dark:text-white">{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
                                    </td>
                                    <td className="p-4 align-top space-y-2">
                                        <div className="flex flex-col gap-1">
                                            {(editForm.attachments || []).map(att => (
                                                <div key={att.id} className="flex justify-between text-[10px] bg-white dark:bg-slate-700 border rounded p-1"><span>{att.name}</span><button onClick={() => removeAttachment(att.id)} className="text-red-500">&times;</button></div>
                                            ))}
                                        </div>
                                        <div className="flex flex-col gap-1 p-2 border rounded bg-white dark:bg-slate-700">
                                            <input value={newVideoTitle} onChange={e => setNewVideoTitle(e.target.value)} className="text-xs p-1 border rounded bg-white dark:bg-slate-800 dark:text-white" placeholder="Video Title" />
                                            <input value={newVideoUrl} onChange={e => setNewVideoUrl(e.target.value)} className="text-xs p-1 border rounded bg-white dark:bg-slate-800 dark:text-white" placeholder="URL" />
                                            <button type="button" onClick={addVideoToEdit} className="text-xs bg-indigo-100 text-indigo-600 rounded py-1">Add Video</button>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right align-top space-x-2">
                                        <button onClick={saveEdit} className="text-xs bg-primary text-white px-3 py-1.5 rounded font-medium">Save</button>
                                        <button onClick={cancelEdit} className="text-xs text-slate-500 hover:text-slate-800">Cancel</button>
                                    </td>
                                </tr>
                            );
                        }

                        return (
                            <tr key={entry.pageNumber} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                <td className="p-4 align-top">
                                    <PageBadge 
                                        pageNumber={entry.pageNumber} 
                                        attachments={entry.attachments} 
                                        revisionCount={entry.revisionCount}
                                        progress={progress}
                                        onClick={() => onViewPage(entry.pageNumber)} 
                                    />
                                </td>
                                <td className="p-4 align-top">
                                    <div className="font-semibold text-slate-800 dark:text-white text-lg cursor-pointer hover:text-indigo-600" onClick={() => onViewPage(entry.pageNumber)}>
                                        {entry.title}
                                    </div>
                                    {entry.topics && entry.topics.length > 0 && (
                                        <div className="mt-2">
                                            {entry.topics.map((t, i) => (
                                                <CollapsibleTopic 
                                                    key={i} 
                                                    topic={t} 
                                                    baseRevisionCount={baseRevision} 
                                                    onOpenModal={(sub) => handleOpenSubtopicModal(sub, entry)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 align-top">
                                    <span className="block text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded w-fit mb-1">{entry.system}</span>
                                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">{entry.subject}</span>
                                </td>
                                <td className="p-4 align-top">
                                    {entry.videoLinks && entry.videoLinks.length > 0 ? (
                                        <div className="space-y-1">
                                            {entry.videoLinks.map(v => (
                                                <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                                    <VideoIcon className="w-3 h-3" /> {v.title}
                                                </a>
                                            ))}
                                        </div>
                                    ) : <span className="text-xs text-slate-400 italic">No videos</span>}
                                </td>
                                <td className="p-4 text-right align-top">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEdit(entry)} className="text-sm text-indigo-600 font-medium hover:underline">Edit</button>
                                        <button onClick={() => confirmDelete(entry.pageNumber)} className="text-sm text-red-400 hover:text-red-600" title="Delete"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                </table>
            </div>
          </div>
      ) : (
          <div className="space-y-4">
              {flattenedSubtopics.map(sub => (
                  <div 
                    key={sub.id} 
                    className={`bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer relative group ${sub.isPageFallback ? 'opacity-80 bg-slate-50 dark:bg-slate-800/50' : ''}`}
                    onClick={() => {
                        if (sub.isPageFallback) {
                            onViewPage(sub.pageNumber);
                        } else {
                            handleOpenSubtopicModal(sub.originalTopic, sub.originalEntry);
                        }
                    }}
                  >
                      <div className="flex justify-between items-start">
                          <div className="flex gap-4 items-start">
                              <PageBadge 
                                  pageNumber={sub.pageNumber} 
                                  attachments={sub.originalEntry.attachments}
                                  revisionCount={sub.isPageFallback ? sub.revisionCount : 0}
                                  progress={
                                      sub.isPageFallback
                                          ? calculatePageProgress(sub.originalEntry)
                                          : (sub.originalTopic.lastStudiedAt !== null ? calculatePageProgress(sub.originalEntry) : 0)
                                  }
                                  onClick={() => onViewPage(sub.pageNumber)} 
                                  className="scale-90 origin-top-left"
                              />
                              <div>
                                  <h3 className="font-bold text-lg text-slate-800 dark:text-white leading-tight group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                                      {sub.title}
                                      {!sub.isPageFallback && (
                                          <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-bold">
                                              Rev {sub.revisionCount}
                                          </span>
                                      )}
                                  </h3>
                                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                                      <span className="uppercase tracking-wider text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded mr-2">{sub.isPageFallback ? 'PAGE TOPIC' : 'SUBTOPIC'}</span>
                                      From: <span className="italic text-slate-600 dark:text-slate-300">{sub.parentTitle}</span>
                                  </p>
                              </div>
                          </div>
                          
                          <div className="text-right">
                              {sub.nextRevisionAt ? (
                                  <div className="flex flex-col items-end">
                                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded mb-1 ${new Date(sub.nextRevisionAt) <= new Date() ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-green-50 text-green-700'}`}>
                                          {new Date(sub.nextRevisionAt) <= new Date() ? 'Due Now' : 'On Track'}
                                      </span>
                                  </div>
                              ) : (
                                  <span className="text-[10px] text-slate-400 font-bold uppercase bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">New</span>
                              )}
                          </div>
                      </div>
                  </div>
              ))}
              
              {flattenedSubtopics.length === 0 && (
                  <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 italic">
                      No subtopics found based on current filters.
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default KnowledgeBaseView;
