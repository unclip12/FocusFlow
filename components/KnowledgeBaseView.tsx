import React, { useState, useMemo, useRef, useEffect } from 'react';
import { KnowledgeBaseEntry, SYSTEMS, CATEGORIES, VideoResource, Attachment, StudySession, TrackableItem, getAdjustedDate, ViewStates } from '../types';
import { BookOpenIcon, VideoIcon, FireIcon, LinkIcon, PlusIcon, DatabaseIcon, SparklesIcon, PaperClipIcon, PhotoIcon, DocumentIcon, BarsArrowUpIcon, BarsArrowDownIcon, ChartBarIcon, CheckCircleIcon, TrashIcon, ChevronDownIcon, ListCheckIcon, ClockIcon, CalendarIcon, ListCheckIcon as SubtopicIcon, ArrowPathIcon, XMarkIcon } from './Icons';
import { extractTopicFromImage } from '../services/geminiService';
import { PageBadge } from './PageBadge';
import { uploadFile, getUserProfile, saveUserProfile } from '../services/firebase';
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

// Helper to highlight text
const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim() || !text) {
        return text;
    }
    try {
        const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedHighlight})`, 'gi');
        
        return text.split(regex).map((part, i) => 
            regex.test(part) ? (
                <mark key={i} className="bg-yellow-300 dark:bg-yellow-500 text-black rounded px-0.5 mx-px">
                    {part}
                </mark>
            ) : (
                part
            )
        );
    } catch (e) {
        return text;
    }
};

// Helper to render text with bold markdown (**text**) and highlighting
const RenderAndHighlightText = ({ text, highlight }: { text: string, highlight: string }) => {
    if (!text) return null;

    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return (
        <span>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    const boldContent = part.slice(2, -2);
                    return <span key={i} className="font-bold text-slate-800 dark:text-slate-100">{highlightText(boldContent, highlight)}</span>;
                }
                return <React.Fragment key={i}>{highlightText(part, highlight)}</React.Fragment>;
            })}
        </span>
    );
};

interface KnowledgeBaseViewProps {
  data: KnowledgeBaseEntry[];
  onUpdateEntry: (entry: KnowledgeBaseEntry) => void;
  onDeleteEntry?: (pageNumber: string) => void;
  onViewPage: (page: string) => void;
  onRefreshData?: () => void;
  kbState: ViewStates['kb'];
  setKbState: React.Dispatch<React.SetStateAction<ViewStates['kb']>>;
}

// Helper to calculate progress (0-100) for a page
const calculatePageProgress = (entry: KnowledgeBaseEntry): number => {
    if (entry.topics && entry.topics.length > 0) {
        const completedTopics = entry.topics.filter(t => t.lastStudiedAt !== null).length;
        return (completedTopics / entry.topics.length) * 100;
    }
    return entry.lastStudiedAt !== null ? 100 : 0;
};

export const CollapsibleTopic: React.FC<{ 
    topic: TrackableItem, 
    baseRevisionCount: number,
    onOpenModal?: (topic: TrackableItem) => void,
    highlight: string,
    forceOpen?: boolean,
}> = ({ topic, baseRevisionCount, onOpenModal, highlight, forceOpen = false }) => {
    const [isManuallyToggled, setIsManuallyToggled] = useState(false);
    const [isManuallyOpen, setIsManuallyOpen] = useState(false);

    useEffect(() => {
        setIsManuallyToggled(false);
    }, [forceOpen]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsManuallyToggled(true);
        setIsManuallyOpen(prev => !prev);
    };

    const isOpen = isManuallyToggled ? isManuallyOpen : forceOpen;
    
    const hasContent = topic.content && topic.content.length > 0;
    const isStudied = topic.lastStudiedAt !== null;
    const revisionLabel = topic.revisionCount > 0 ? `+${topic.revisionCount}` : null;

    return (
        <div className="mb-2">
            <div className="flex items-center gap-2 w-full py-1 group">
                <button 
                    onClick={handleToggle}
                    className={`p-1 rounded-md bg-slate-100/50 dark:bg-slate-700/50 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 text-slate-500 hover:text-indigo-600 transition-colors flex-shrink-0 ${!hasContent && !isOpen ? 'opacity-50' : ''} backdrop-blur-sm`}
                    title={hasContent ? "Expand context" : "No inline context"}
                >
                    <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                <button 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        if (onOpenModal) onOpenModal(topic); 
                    }}
                    className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left truncate flex-grow flex items-center gap-2"
                >
                    <div className={`w-2 h-2 rounded-full ${isStudied ? 'bg-green-500' : 'bg-red-400'}`}></div>
                    {highlightText(topic.name, highlight)}
                    {revisionLabel && (
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-800 backdrop-blur-sm">
                            {revisionLabel}
                        </span>
                    )}
                </button>
            </div>
            
            {isOpen && hasContent && (
                <div className="ml-8 pl-3 border-l-2 border-slate-200/50 dark:border-slate-700/50 mt-1 py-1 animate-fade-in-up">
                    <ul className="space-y-2">
                        {topic.content!.map((point, idx) => (
                            <li key={idx} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-2">
                                <span className="text-indigo-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                                <span><RenderAndHighlightText text={point} highlight={highlight} /></span>
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

const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({ data, onUpdateEntry, onDeleteEntry, onViewPage, onRefreshData, kbState, setKbState }) => {
  const { search, selectedSystem, sortBy, sortOrder, viewMode } = kbState;
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<KnowledgeBaseEntry>>({});
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [viewingSubtopic, setViewingSubtopic] = useState<{ topic: TrackableItem, parent: KnowledgeBaseEntry } | null>(null);

  const [tagsInput, setTagsInput] = useState('');
  const [subTopicsInput, setSubTopicsInput] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);

  // --- SEARCH HISTORY STATE ---
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
      const loadHistory = async () => {
          try {
              const profile = await getUserProfile();
              if (profile?.searchHistory) {
                  setRecentSearches(profile.searchHistory);
              }
          } catch (e) {
              console.warn("Failed to sync search history", e);
          }
      };
      loadHistory();
  }, []);

  const addToHistory = async (term: string) => {
      if (!term.trim()) return;
      const newHistory = [term, ...recentSearches.filter(t => t !== term)].slice(0, 40);
      setRecentSearches(newHistory);
      await saveUserProfile({ searchHistory: newHistory });
  };

  const clearHistory = async () => {
      setRecentSearches([]);
      await saveUserProfile({ searchHistory: [] });
  };

  const removeSearchItem = async (term: string) => {
      const newHistory = recentSearches.filter(t => t !== term);
      setRecentSearches(newHistory);
      await saveUserProfile({ searchHistory: newHistory });
  };

  const searchRegex = useMemo(() => {
    if (!search.trim()) return null;
    try {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, 'i');
    } catch (e) {
        return null;
    }
  }, [search]);

  const handleRefresh = async () => {
      if (onRefreshData) {
          setIsRefreshing(true);
          await onRefreshData();
          setTimeout(() => setIsRefreshing(false), 1000);
      }
  };

  const stats = useMemo(() => {
      const totalPages = data.length;
      const totalSubtopics = data.reduce((acc, curr) => acc + (curr.topics?.length || 0), 0);
      const studiedPagesCount = data.filter(entry => calculatePageProgress(entry) === 100).length;
      const totalSubtopicsStudied = data.reduce((acc, curr) => {
          if (curr.topics && curr.topics.length > 0) {
              return acc + curr.topics.filter(t => t.lastStudiedAt !== null).length;
          }
          return acc;
      }, 0);

      const allLogs = data.flatMap(kb => kb.logs || []);
      let avgPagesPerDay = 0;
      let daysElapsed = 1;

      if (allLogs.length > 0) {
          allLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const firstLogDate = new Date(allLogs[0].timestamp);
          const now = new Date();
          
          const diffTime = Math.abs(now.getTime() - firstLogDate.getTime());
          daysElapsed = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
          avgPagesPerDay = studiedPagesCount / daysElapsed;
      }

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

  const calculateBaseRevision = (entry: KnowledgeBaseEntry) => {
      if (!entry.topics || entry.topics.length === 0) return entry.revisionCount;
      const minRev = Math.min(...entry.topics.map(t => t.revisionCount));
      return minRev;
  };

    const searchResultStats = useMemo(() => {
        if (!searchRegex) return null;

        const matchedPageNumbers = new Set<string>();
        const matchedSubtopicIds = new Set<string>();

        data.forEach(entry => {
            let pageHasMatch = false;

            if (searchRegex.test(entry.title) || searchRegex.test(entry.pageNumber) || (entry.tags && entry.tags.some(t => searchRegex!.test(t)))) {
                pageHasMatch = true;
            }

            if (entry.topics) {
                entry.topics.forEach(topic => {
                    if (searchRegex.test(topic.name) || (topic.content && topic.content.some(line => searchRegex!.test(line)))) {
                        pageHasMatch = true;
                        matchedSubtopicIds.add(topic.id);
                    }
                });
            }

            if (pageHasMatch) {
                matchedPageNumbers.add(entry.pageNumber);
            }
        });

        return { pageCount: matchedPageNumbers.size, subtopicCount: matchedSubtopicIds.size };
    }, [searchRegex, data]);

  const filteredData = useMemo(() => {
    let result = data.filter(entry => {
        let matchSearch = true;
        if (searchRegex) {
            matchSearch = searchRegex.test(entry.title) || 
                          searchRegex.test(entry.pageNumber) ||
                          (entry.tags ? entry.tags.some(t => searchRegex!.test(t)) : false) ||
                          (entry.topics ? entry.topics.some(topic => 
                              searchRegex!.test(topic.name) ||
                              (topic.content && topic.content.some(line => searchRegex!.test(line)))
                          ) : false);
        }

        const matchSystem = selectedSystem ? entry.system === selectedSystem : true;
        return matchSearch && matchSystem;
    });

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
                const revA = calculateBaseRevision(a);
                const revB = calculateBaseRevision(b);
                comparison = revA - revB;
                break;
            case 'RECENTLY_ADDED': {
                const dateA = a.firstStudiedAt ? new Date(a.firstStudiedAt).getTime() : 0;
                const dateB = b.firstStudiedAt ? new Date(b.firstStudiedAt).getTime() : 0;
                return sortOrder === 'ASC' ? dateA - dateB : dateB - dateA;
            }
            case 'STUDIED':
                const progA = calculatePageProgress(a);
                const progB = calculatePageProgress(b);
                return sortOrder === 'ASC' ? progA - progB : progB - progA; 
            case 'LAST_STUDIED':
                const dateA = a.lastStudiedAt ? new Date(a.lastStudiedAt).getTime() : 0;
                const dateB = b.lastStudiedAt ? new Date(b.lastStudiedAt).getTime() : 0;
                return sortOrder === 'ASC' ? dateA - dateB : dateB - dateA;
        }
        return sortOrder === 'ASC' ? comparison : -comparison;
    });

    return result;
  }, [data, searchRegex, selectedSystem, sortBy, sortOrder]);

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
          if (existing) return existing;
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
      setKbState(prev => ({ ...prev, sortOrder: prev.sortOrder === 'ASC' ? 'DESC' : 'ASC' }));
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
    <div className="animate-fade-in space-y-6 relative">
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
                
                <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg self-start backdrop-blur-sm">
                    <button 
                        onClick={() => setKbState(prev => ({...prev, viewMode: 'PAGE_WISE'}))}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'PAGE_WISE' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Page Wise
                    </button>
                    <button 
                        onClick={() => setKbState(prev => ({...prev, viewMode: 'SUBTOPIC_WISE'}))}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'SUBTOPIC_WISE' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Subtopic Wise
                    </button>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-4 rounded-xl border border-white/40 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pages Completed</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-green-600 dark:text-green-400">{stats.studiedPagesCount}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">/ {stats.totalPages}</span>
                    </div>
                </div>
                <div className="p-2 bg-green-100/50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg backdrop-blur-sm">
                    <BookOpenIcon className="w-5 h-5" />
                </div>
            </div>

            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-4 rounded-xl border border-white/40 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subtopics Done</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{stats.totalSubtopicsStudied}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">/ {stats.totalSubtopics}</span>
                    </div>
                </div>
                <div className="p-2 bg-indigo-100/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg backdrop-blur-sm">
                    <SubtopicIcon className="w-5 h-5" />
                </div>
            </div>

            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-4 rounded-xl border border-white/40 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Speed</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.avgPagesPerDay}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">pg/day</span>
                    </div>
                </div>
                <div className="p-2 bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg backdrop-blur-sm">
                    <ChartBarIcon className="w-5 h-5" />
                </div>
            </div>

            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-4 rounded-xl border border-white/40 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Est. Completion</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                            {stats.estimatedDaysLeft > 0 ? stats.estimatedDaysLeft : (stats.avgPagesPerDay === '0.0' && stats.studiedPagesCount < stats.totalPages ? '∞' : 'Done')}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">days left</span>
                    </div>
                </div>
                <div className="p-2 bg-amber-100/50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg backdrop-blur-sm">
                    <CalendarIcon className="w-5 h-5" />
                </div>
            </div>
        </div>
        
        {/* Stats Summary & Filters Bar */}
        <div className="relative z-30 flex flex-col sm:flex-row gap-2 w-full mb-6 items-stretch sm:items-center bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-2 rounded-xl border border-white/40 dark:border-slate-700/50 shadow-sm">
            {/* SEARCH INPUT WITH RECENT HISTORY - Z-INDEX FIX */}
            <div className="relative group w-full sm:w-48 z-50">
                <input 
                    type="text" 
                    placeholder={viewMode === 'SUBTOPIC_WISE' ? "Search subtopics..." : "Search pages..."}
                    value={search}
                    onFocus={() => setShowHistory(true)}
                    onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                    onChange={e => setKbState(prev => ({...prev, search: e.target.value}))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            addToHistory(search);
                            setShowHistory(false);
                        }
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-200/50 dark:border-slate-600/50 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm w-full focus:ring-2 focus:ring-primary/20 outline-none backdrop-blur-sm"
                />
                
                {/* Recent History Dropdown - Absolute positioned */}
                {showHistory && recentSearches.length > 0 && (
                    <div className="absolute top-full left-0 w-full sm:w-64 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fade-in-up max-h-96 overflow-y-auto custom-scrollbar">
                        <div className="p-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 z-10">
                            <span>Recent Searches ({recentSearches.length})</span>
                            <button onMouseDown={(e) => { e.preventDefault(); clearHistory(); }} className="hover:text-red-500">Clear</button>
                        </div>
                        <div>
                            {recentSearches.map(term => (
                                <div 
                                    key={term}
                                    onMouseDown={(e) => { 
                                        e.preventDefault(); 
                                        setKbState(prev => ({...prev, search: term})); 
                                        setShowHistory(false); 
                                    }} 
                                    className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer flex items-center justify-between group transition-colors"
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <ClockIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="truncate">{term}</span>
                                    </div>
                                    <button 
                                        onMouseDown={(e) => { e.stopPropagation(); removeSearchItem(term); }}
                                        className="text-slate-300 hover:text-red-500 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                        title="Remove"
                                    >
                                        <XMarkIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <select 
                value={selectedSystem}
                onChange={e => setKbState(prev => ({...prev, selectedSystem: e.target.value}))}
                className="px-3 py-2 rounded-lg border border-slate-200/50 dark:border-slate-600/50 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm w-full sm:w-40 backdrop-blur-sm z-10"
            >
                <option value="">All Systems</option>
                {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {onRefreshData && (
                <button 
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-2 rounded-lg border border-slate-200/50 dark:border-slate-600/50 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-indigo-50 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 transition-colors disabled:opacity-50 backdrop-blur-sm z-10"
                    title="Full Integrity Scan"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            )}

            {searchResultStats && (
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 px-3 py-2 rounded-lg bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center gap-4 mx-2 sm:mx-4 z-10">
                    <span>Found in <strong className="text-indigo-600 dark:text-indigo-400">{searchResultStats.pageCount}</strong> pages</span>
                    <div className="w-px h-4 bg-slate-300/50 dark:bg-slate-600/50"></div>
                    <span>Found in <strong className="text-indigo-600 dark:text-indigo-400">{searchResultStats.subtopicCount}</strong> subtopics</span>
                </div>
            )}

            <div className="flex gap-2 items-center ml-auto z-10">
                <select 
                    value={sortBy}
                    onChange={e => setKbState(prev => ({...prev, sortBy: e.target.value as any}))}
                    className="px-3 py-2 rounded-lg border border-slate-200/50 dark:border-slate-600/50 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm cursor-pointer hover:border-indigo-300 transition-colors backdrop-blur-sm"
                >
                    <option value="PAGE">Page #</option>
                    <option value="STUDIED">Studied Status</option>
                    <option value="LAST_STUDIED">Last Studied Date</option>
                    <option value="RECENTLY_ADDED">Recently Added</option>
                    <option value="TOPIC">Topic (A-Z)</option>
                    <option value="SYSTEM">System</option>
                    <option value="REVISIONS">Number of Revisions</option>
                </select>
                <button onClick={toggleSortOrder} className="p-2 rounded-lg border border-slate-200/50 dark:border-slate-600/50 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-indigo-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors backdrop-blur-sm">
                    {sortOrder === 'ASC' ? <BarsArrowDownIcon className="w-5 h-5" /> : <BarsArrowUpIcon className="w-5 h-5" />}
                </button>
            </div>
        </div>
      </div>

      {/* VIEW RENDERING */}
      {viewMode === 'PAGE_WISE' ? (
          {/* 🆕 CONTAINER QUERY WRAPPER */}
          <div className="kb-table-container bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-xl shadow-sm border border-white/40 dark:border-slate-700/50 overflow-hidden relative z-0">
            <div className="overflow-x-auto">
                <table className="kb-table w-full text-left border-collapse min-w-[900px]">
                <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/50 dark:border-slate-700/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="p-4 w-32">Page #</th>
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
                            {/* 🆕 SCROLL ANIMATION CLASS */}
                            <tr key={entry.pageNumber} className="scroll-fade-in hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group">
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
                                        {highlightText(entry.title, search)}
                                    </div>
                                    {entry.topics && entry.topics.length > 0 && (
                                        <div className="mt-2">
                                            {entry.topics.map((t, i) => (
                                                <CollapsibleTopic 
                                                    key={i} 
                                                    topic={t} 
                                                    baseRevisionCount={baseRevision} 
                                                    onOpenModal={(sub) => handleOpenSubtopicModal(sub, entry)}
                                                    highlight={search}
                                                    forceOpen={
                                                        !!searchRegex && (
                                                            searchRegex.test(t.name) ||
                                                            (t.content && t.content.some(line => searchRegex!.test(line)))
                                                        )
                                                    }
                                                />
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 align-top">
                                    <span className="block text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-700/50 px-2 py-1 rounded w-fit mb-1 backdrop-blur-sm">{entry.system}</span>
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
          {/* 🆕 SCROLL ANIMATIONS for Subtopic View */}
          <div className="space-y-4">
              {flattenedSubtopics.map(sub => (
                  <div 
                    key={sub.id} 
                    className="scroll-fade-in bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-xl p-4 border border-white/40 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer relative group ${sub.isPageFallback ? 'opacity-80 bg-slate-50/50 dark:bg-slate-800/30' : ''}`"
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
                                      {highlightText(sub.title, search)}
                                      {!sub.isPageFallback && (
                                          <span className="text-xs bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-800 font-bold backdrop-blur-sm">
                                              Rev {sub.revisionCount}
                                          </span>
                                      )}
                                  </h3>
                                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                                      <span className="uppercase tracking-wider text-[10px] bg-slate-100/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded mr-2 backdrop-blur-sm">{sub.isPageFallback ? 'PAGE TOPIC' : 'SUBTOPIC'}</span>
                                      From: <span className="italic text-slate-600 dark:text-slate-300">{highlightText(sub.parentTitle, search)}</span>
                                  </p>
                              </div>
                          </div>
                          
                          <div className="text-right">
                              {sub.nextRevisionAt ? (
                                  <div className="flex flex-col items-end">
                                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded mb-1 ${new Date(sub.nextRevisionAt) <= new Date() ? 'bg-amber-100/50 text-amber-700 animate-pulse' : 'bg-green-50/50 text-green-700'} backdrop-blur-sm`}>
                                          {new Date(sub.nextRevisionAt) <= new Date() ? 'Due Now' : 'On Track'}
                                      </span>
                                  </div>
                              ) : (
                                  <span className="text-[10px] text-slate-400 font-bold uppercase bg-slate-100/50 dark:bg-slate-700/50 px-2 py-1 rounded backdrop-blur-sm">New</span>
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
