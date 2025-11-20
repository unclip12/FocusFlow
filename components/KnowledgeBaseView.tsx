import React, { useState, useMemo } from 'react';
import { KnowledgeBaseEntry, SYSTEMS, CATEGORIES, VideoResource, Attachment, StudySession } from '../types';
import { BookOpenIcon, VideoIcon, FireIcon, LinkIcon, PlusIcon, DatabaseIcon, SparklesIcon, PaperClipIcon, PhotoIcon, DocumentIcon, BarsArrowUpIcon, BarsArrowDownIcon, ChartBarIcon, CheckCircleIcon } from './Icons';
import { extractTopicFromImage } from '../services/geminiService';
import { PageBadge } from './PageBadge';

interface KnowledgeBaseViewProps {
  data: KnowledgeBaseEntry[];
  sessions?: StudySession[];
  onUpdateEntry: (entry: KnowledgeBaseEntry) => void;
  onViewPage: (page: string) => void;
}

type SortOption = 'PAGE' | 'TOPIC' | 'SYSTEM' | 'SUBJECT';
type SortOrder = 'ASC' | 'DESC';

const ViewAttachmentModal = ({ attachment, onClose }: { attachment: Attachment, onClose: () => void }) => {
    if (!attachment) return null;
    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
             <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
                 {attachment.type === 'IMAGE' ? (
                     <img src={attachment.data} alt={attachment.name} className="max-w-full max-h-[85vh] rounded shadow-2xl border-2 border-white/20" />
                 ) : (
                     <iframe src={attachment.data} className="w-[80vw] h-[80vh] bg-white rounded" title="PDF Viewer" />
                 )}
                 <div className="mt-4 flex gap-4">
                     <a href={attachment.data} download={attachment.name} className="text-white bg-white/20 hover:bg-white/30 px-4 py-2 rounded font-bold text-sm" onClick={(e) => e.stopPropagation()}>Download</a>
                     <button className="text-white bg-red-500/80 hover:bg-red-500 px-6 py-2 rounded font-bold text-sm" onClick={onClose}>Close</button>
                 </div>
             </div>
        </div>
    )
}

const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({ data, sessions = [], onUpdateEntry, onViewPage }) => {
  const [search, setSearch] = useState('');
  const [selectedSystem, setSelectedSystem] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('PAGE');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  
  // Edit Mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<KnowledgeBaseEntry>>({});
  
  // Helper for tags and subtopics input
  const [tagsInput, setTagsInput] = useState('');
  const [subTopicsInput, setSubTopicsInput] = useState('');
  
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');

  // AI Loading State
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Viewing Attachment
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);

  // Stats Calculation
  const totalPages = data.length;
  const totalAnkiCards = data.reduce((acc, curr) => acc + (curr.ankiTotal || 0), 0);
  const totalResources = data.reduce((acc, curr) => acc + (curr.attachments?.length || 0) + (curr.videoLinks?.length || 0), 0);

  const filteredData = useMemo(() => {
    let result = data.filter(entry => {
        let matchSearch = true;
        if (search) {
          try {
            // Support Regex Search
            const regex = new RegExp(search, 'i');
            matchSearch = regex.test(entry.topic) || 
                          regex.test(entry.pageNumber) ||
                          (entry.tags ? entry.tags.some(t => regex.test(t)) : false);
          } catch (e) {
            // Fallback to standard includes if regex invalid
            const lowerSearch = search.toLowerCase();
            matchSearch = entry.topic.toLowerCase().includes(lowerSearch) || 
                          entry.pageNumber.includes(lowerSearch) ||
                          (entry.tags ? entry.tags.some(t => t.toLowerCase().includes(lowerSearch)) : false);
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
                // Try numeric sort first
                const numA = parseInt(a.pageNumber);
                const numB = parseInt(b.pageNumber);
                if (!isNaN(numA) && !isNaN(numB)) {
                    comparison = numA - numB;
                } else {
                    comparison = a.pageNumber.localeCompare(b.pageNumber, undefined, { numeric: true });
                }
                break;
            case 'TOPIC':
                comparison = a.topic.localeCompare(b.topic);
                break;
            case 'SYSTEM':
                comparison = a.system.localeCompare(b.system);
                break;
            case 'SUBJECT':
                comparison = a.subject.localeCompare(b.subject);
                break;
        }
        return sortOrder === 'ASC' ? comparison : -comparison;
    });

    return result;
  }, [data, search, selectedSystem, sortBy, sortOrder]);

  const startEdit = (entry: KnowledgeBaseEntry) => {
    setEditingId(entry.pageNumber);
    setEditForm({ ...entry, attachments: entry.attachments || [] });
    setTagsInput(entry.tags ? entry.tags.join(', ') : '');
    setSubTopicsInput(entry.subTopics ? entry.subTopics.join('\n') : '');
    setNewVideoUrl('');
    setNewVideoTitle('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setTagsInput('');
    setSubTopicsInput('');
    setIsAnalyzing(false);
  };

  const saveEdit = () => {
    if (editForm.pageNumber) {
      const updatedTags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const updatedSubTopics = subTopicsInput.split('\n').map(t => t.trim()).filter(t => t.length > 0);
      
      onUpdateEntry({ 
          ...editForm, 
          tags: updatedTags,
          subTopics: updatedSubTopics
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
      videoLinks: [...currentVideos, { id: crypto.randomUUID(), title: newVideoTitle, url: newVideoUrl }]
    });
    setNewVideoUrl('');
    setNewVideoTitle('');
  };

  const removeVideoFromEdit = (videoId: string) => {
    const currentVideos = editForm.videoLinks || [];
    setEditForm({
      ...editForm,
      videoLinks: currentVideos.filter(v => v.id !== videoId)
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          
          // No file size limit
          const reader = new FileReader();
          reader.onload = (ev) => {
              const result = ev.target?.result as string;
              
              let type: 'IMAGE' | 'PDF' | 'OTHER' = 'OTHER';
              if (file.type.startsWith('image/')) {
                  type = 'IMAGE';
              } else if (file.type === 'application/pdf') {
                  type = 'PDF';
              }

              const newAttachment: Attachment = {
                  id: crypto.randomUUID(),
                  name: file.name,
                  type: type,
                  data: result
              };
              setEditForm(prev => ({
                  ...prev,
                  attachments: [...(prev.attachments || []), newAttachment]
              }));
          };
          reader.readAsDataURL(file);
      }
  };

  const removeAttachment = (id: string) => {
      setEditForm(prev => ({
          ...prev,
          attachments: (prev.attachments || []).filter(a => a.id !== id)
      }));
  };

  const handleExtractTopics = async () => {
      if (!editForm.attachments || editForm.attachments.length === 0) {
          alert("Please upload an image first.");
          return;
      }
      
      // Use the last uploaded attachment
      const targetAttachment = editForm.attachments[editForm.attachments.length - 1];
      if (targetAttachment.type !== 'IMAGE') {
           alert("Auto-extract currently supports images only.");
           return;
      }

      setIsAnalyzing(true);
      try {
          const result = await extractTopicFromImage(targetAttachment);
          if (result) {
              setEditForm(prev => ({ ...prev, topic: result.topic }));
              setSubTopicsInput(result.subTopics.join('\n'));
          } else {
              alert("Could not extract topics. Please try again or check API key.");
          }
      } catch (e) {
          console.error(e);
          alert("Error analyzing image.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const toggleSortOrder = () => {
      setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
  };

  const getRevisionCount = (pageNumber: string) => {
     const session = sessions.find(s => s.pageNumber === pageNumber);
     return session ? session.history.filter(h => h.type === 'REVISION').length : 0;
  };

  return (
    <div className="animate-fade-in space-y-6">
      {viewingAttachment && <ViewAttachmentModal attachment={viewingAttachment} onClose={() => setViewingAttachment(null)} />}
      
      {/* Header and Stats */}
      <div>
        <div className="flex items-center gap-2 mb-4">
            <DatabaseIcon className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Knowledge Base</h2>
        </div>
        
        {/* Stats Summary - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 shadow-sm">
                 <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                     <BookOpenIcon className="w-5 h-5" />
                 </div>
                 <div>
                     <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Pages</p>
                     <p className="text-xl font-bold text-slate-800 dark:text-white">{totalPages}</p>
                 </div>
             </div>
             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 shadow-sm">
                 <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
                     <FireIcon className="w-5 h-5" />
                 </div>
                 <div>
                     <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Anki Cards</p>
                     <p className="text-xl font-bold text-slate-800 dark:text-white">{totalAnkiCards}</p>
                 </div>
             </div>
             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 shadow-sm">
                 <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
                     <PaperClipIcon className="w-5 h-5" />
                 </div>
                 <div>
                     <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Resources</p>
                     <p className="text-xl font-bold text-slate-800 dark:text-white">{totalResources}</p>
                 </div>
             </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <p className="text-slate-500 dark:text-slate-400 text-sm">Manage content, visuals, and flashcard counts.</p>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-stretch sm:items-center">
              <input 
                type="text" 
                placeholder="Search..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm w-full sm:w-48 focus:ring-2 focus:ring-primary/20 outline-none"
              />
              
              <select 
                value={selectedSystem}
                onChange={e => setSelectedSystem(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm w-full sm:w-40"
              >
                <option value="">All Systems</option>
                {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Sorting Controls */}
              <div className="flex gap-2 items-center">
                  <select 
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortOption)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm cursor-pointer hover:border-indigo-300 transition-colors flex-grow sm:flex-grow-0"
                    title="Sort By"
                  >
                    <option value="PAGE">Page #</option>
                    <option value="TOPIC">Topic (A-Z)</option>
                    <option value="SYSTEM">System</option>
                    <option value="SUBJECT">Subject</option>
                  </select>
                  
                  <button 
                    onClick={toggleSortOrder}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors flex-shrink-0"
                    title={sortOrder === 'ASC' ? "Ascending" : "Descending"}
                  >
                      {sortOrder === 'ASC' ? <BarsArrowDownIcon className="w-5 h-5" /> : <BarsArrowUpIcon className="w-5 h-5" />}
                  </button>
              </div>
            </div>
        </div>
      </div>

      {/* Mobile & Tablet Card View (Up to LG) - Optimized for iPad Portrait with Grid */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredData.map(entry => {
           const isEditing = editingId === entry.pageNumber;
           const session = sessions.find(s => s.pageNumber === entry.pageNumber);
           const ankiCovered = session?.ankiCovered || 0;
           const ankiTotal = entry.ankiTotal || 0;
           const ankiProgress = ankiTotal > 0 ? (ankiCovered / ankiTotal) * 100 : 0;
           
           if (isEditing) {
             return (
               <div key={entry.pageNumber} className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-4 md:col-span-2">
                  <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700 text-lg">Pg {entry.pageNumber}</span>
                  </div>
                  
                  <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Topic</label>
                      <input 
                          value={editForm.topic}
                          onChange={e => setEditForm({...editForm, topic: e.target.value})}
                          className="w-full p-2 border rounded-lg text-sm font-bold bg-white"
                          placeholder="Topic Name"
                      />
                  </div>

                  {/* Attachment Upload Section */}
                  <div className="p-3 bg-white border border-indigo-100 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Page Content</label>
                        {editForm.attachments && editForm.attachments.length > 0 && (
                            <button 
                                onClick={handleExtractTopics}
                                disabled={isAnalyzing}
                                className="flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2 py-1 rounded shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                            >
                                {isAnalyzing ? (
                                    <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                                ) : (
                                    <SparklesIcon className="w-3 h-3" />
                                )}
                                {isAnalyzing ? 'Analyzing...' : 'AI Extract'}
                            </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                          {(editForm.attachments || []).map(att => (
                               <div key={att.id} className="relative w-14 h-14 rounded border border-slate-200 flex items-center justify-center bg-slate-50">
                                   {att.type === 'IMAGE' ? <img src={att.data} alt="" className="w-full h-full object-cover rounded" /> : <DocumentIcon className="w-6 h-6 text-red-400" />}
                                   <button onClick={() => removeAttachment(att.id)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-sm">&times;</button>
                               </div>
                          ))}
                          <label className="w-14 h-14 rounded border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all">
                              <PlusIcon className="w-5 h-5 text-slate-400" />
                              <input type="file" onChange={handleFileChange} className="hidden" />
                          </label>
                      </div>
                  </div>

                  {/* SubTopics Editing */}
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subtopics (One per line)</label>
                      <textarea 
                          value={subTopicsInput}
                          onChange={e => setSubTopicsInput(e.target.value)}
                          className="w-full p-2 border rounded-lg text-sm bg-white min-h-[60px]"
                          placeholder="Subtopic 1&#10;Subtopic 2"
                      />
                  </div>

                  {/* ... Other fields ... */}
                  <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">System</label>
                        <select 
                            value={editForm.system} 
                            onChange={e => setEditForm({...editForm, system: e.target.value})}
                            className="w-full text-sm p-2 border rounded-lg bg-white"
                        >
                            {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                        <select 
                            value={editForm.subject} 
                            onChange={e => setEditForm({...editForm, subject: e.target.value})}
                            className="w-full text-sm p-2 border rounded-lg bg-white"
                        >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                      <button onClick={cancelEdit} className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 font-medium text-sm">Cancel</button>
                      <button onClick={saveEdit} className="flex-1 py-2 bg-primary text-white rounded-lg font-medium text-sm shadow-md">Save Changes</button>
                  </div>
               </div>
             );
           }

           // Display Card
           return (
             <div key={entry.pageNumber} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-3 w-full">
                        {/* Integrated Page Badge */}
                        <PageBadge 
                            pageNumber={entry.pageNumber}
                            attachments={entry.attachments}
                            revisionCount={getRevisionCount(entry.pageNumber)}
                            onClick={() => onViewPage(entry.pageNumber)}
                        />
                        
                        <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-800 dark:text-white text-lg leading-tight truncate">{entry.topic}</h3>
                            <div className="flex gap-2 mt-1 flex-wrap">
                                <span className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-100 dark:border-slate-600 uppercase">{entry.subject}</span>
                                <span className="bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-100 dark:border-slate-600 uppercase truncate max-w-[100px]">{entry.system || 'General'}</span>
                            </div>

                            {/* Subtopics Display */}
                            {entry.subTopics && entry.subTopics.length > 0 && (
                                <div className="mt-2 border-l-2 border-slate-200 dark:border-slate-700 pl-2 space-y-0.5">
                                    {entry.subTopics.slice(0, 2).map((st, idx) => (
                                        <p key={idx} className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">• {st}</p>
                                    ))}
                                    {entry.subTopics.length > 2 && <p className="text-[10px] text-slate-400 italic">+ {entry.subTopics.length - 2} more</p>}
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={() => startEdit(entry)} className="text-primary p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors flex-shrink-0 -mt-2 -mr-2">
                        <span className="sr-only">Edit</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                        </svg>
                    </button>
                </div>
                
                {/* Mobile Anki Stats */}
                <div className="mt-auto border-t border-slate-100 dark:border-slate-700 pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                        <div className="flex items-center gap-1">
                             <FireIcon className="w-4 h-4 text-amber-500" />
                             <span className="font-bold">Anki Progress</span>
                        </div>
                        <span>{ankiCovered} / {ankiTotal} Cards</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${ankiProgress === 100 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${ankiProgress}%` }}></div>
                    </div>
                </div>

             </div>
           );
        })}
      </div>

      {/* Desktop Table View (LG and up) */}
      <div className="hidden lg:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="p-4 w-36">Page # / Content</th>
              <th className="p-4">Topic & Subtopics</th>
              <th className="p-4">Anki Progress</th>
              <th className="p-4">Resources</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredData.map(entry => {
              const isEditing = editingId === entry.pageNumber;

              if (isEditing) {
                return (
                  <tr key={entry.pageNumber} className="bg-indigo-50/30 dark:bg-indigo-900/10">
                    <td className="p-4 align-top font-bold text-slate-700 dark:text-slate-300">
                        {entry.pageNumber}
                        
                        {/* Attachment Upload in Table Row */}
                        <div className="mt-4">
                            <div className="flex gap-2 items-center">
                                <label className="w-8 h-8 flex items-center justify-center rounded border border-indigo-200 dark:border-slate-600 bg-white dark:bg-slate-700 cursor-pointer hover:bg-indigo-50 dark:hover:bg-slate-600 transition-colors" title="Upload Page Content">
                                    <PlusIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                    <input type="file" onChange={handleFileChange} className="hidden" />
                                </label>
                                {editForm.attachments && editForm.attachments.length > 0 && (
                                    <button 
                                        onClick={handleExtractTopics}
                                        disabled={isAnalyzing}
                                        className="flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2 py-1 rounded shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                                        title="Extract Topics from Image"
                                    >
                                        <SparklesIcon className="w-3 h-3" /> AI
                                    </button>
                                )}
                            </div>
                            
                            <div className="flex flex-col gap-1 mt-2">
                                {(editForm.attachments || []).map(att => (
                                    <div key={att.id} className="flex items-center gap-1 text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1 max-w-[120px] text-slate-600 dark:text-slate-300">
                                        <span className="truncate">{att.name}</span>
                                        <button onClick={() => removeAttachment(att.id)} className="text-red-500 font-bold">&times;</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </td>
                    <td className="p-4 align-top space-y-2 min-w-[350px]">
                        <input 
                          value={editForm.topic}
                          onChange={e => setEditForm({...editForm, topic: e.target.value})}
                          className="w-full p-1 border border-slate-300 dark:border-slate-600 rounded text-sm font-bold mb-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          placeholder="Topic Name"
                        />
                         
                        {/* Subtopics Edit */}
                        <textarea 
                            value={subTopicsInput}
                            onChange={e => setSubTopicsInput(e.target.value)}
                            className="w-full p-1 border border-slate-300 dark:border-slate-600 rounded text-xs min-h-[50px] bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            placeholder="Subtopics (one per line)..."
                        />

                        <div className="flex gap-2">
                            <select 
                                value={editForm.system} 
                                onChange={e => setEditForm({...editForm, system: e.target.value})}
                                className="text-xs p-1 border border-slate-300 dark:border-slate-600 rounded w-1/2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            >
                                {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select 
                                value={editForm.subject} 
                                onChange={e => setEditForm({...editForm, subject: e.target.value})}
                                className="text-xs p-1 border border-slate-300 dark:border-slate-600 rounded w-1/2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <textarea 
                            value={editForm.notes || ''}
                            onChange={e => setEditForm({...editForm, notes: e.target.value})}
                            className="w-full p-1 border border-slate-300 dark:border-slate-600 rounded text-xs mt-1 min-h-[60px] bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            placeholder="Notes..."
                        />
                    </td>
                    <td className="p-4 align-top">
                        <div className="flex items-center gap-1">
                            <input 
                                type="number" 
                                value={editForm.ankiTotal}
                                onChange={e => setEditForm({...editForm, ankiTotal: parseInt(e.target.value)})}
                                className="w-16 p-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                            <span className="text-xs text-slate-500 dark:text-slate-400">Total Cards</span>
                        </div>
                    </td>
                    <td className="p-4 align-top">
                        <div className="space-y-2">
                            {editForm.videoLinks?.map(v => (
                                <div key={v.id} className="flex items-center justify-between bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-300">
                                    <span className="truncate max-w-[120px]">{v.title}</span>
                                    <button onClick={() => removeVideoFromEdit(v.id)} className="text-red-400 hover:text-red-600">&times;</button>
                                </div>
                            ))}
                            <div className="flex flex-col gap-1 mt-2 p-2 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
                                <input 
                                    placeholder="Video Title" 
                                    value={newVideoTitle}
                                    onChange={e => setNewVideoTitle(e.target.value)}
                                    className="text-xs p-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                                <input 
                                    placeholder="URL" 
                                    value={newVideoUrl}
                                    onChange={e => setNewVideoUrl(e.target.value)}
                                    className="text-xs p-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                                <button type="button" onClick={addVideoToEdit} className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-primary py-1 rounded font-medium">Add Link</button>
                            </div>
                        </div>
                    </td>
                    <td className="p-4 text-right align-top space-x-2">
                        <button onClick={saveEdit} className="text-xs bg-primary text-white px-3 py-1.5 rounded font-medium">Save</button>
                        <button onClick={cancelEdit} className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">Cancel</button>
                    </td>
                  </tr>
                );
              }

              // Normal View Calculation for Anki
              const session = sessions.find(s => s.pageNumber === entry.pageNumber);
              const ankiCovered = session?.ankiCovered || 0;
              const ankiTotal = entry.ankiTotal || 0;
              const ankiProgress = ankiTotal > 0 ? (ankiCovered / ankiTotal) * 100 : 0;

              return (
                <tr key={entry.pageNumber} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                  <td className="p-4 font-bold text-slate-700 dark:text-slate-300 align-top">
                    <PageBadge 
                        pageNumber={entry.pageNumber}
                        attachments={entry.attachments}
                        revisionCount={getRevisionCount(entry.pageNumber)}
                        onClick={() => onViewPage(entry.pageNumber)}
                    />
                  </td>
                  <td className="p-4 align-top">
                    <div className="font-semibold text-slate-800 dark:text-white text-lg">{entry.topic}</div>
                    
                    {/* Subtopics View */}
                    {entry.subTopics && entry.subTopics.length > 0 && (
                        <div className="mt-1 mb-2 flex flex-wrap gap-x-3 gap-y-1">
                            {entry.subTopics.map((st, idx) => (
                                <span key={idx} className="text-xs text-slate-500 dark:text-slate-400 font-medium">• {st}</span>
                            ))}
                        </div>
                    )}

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">{entry.system || 'General'}</span>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">{entry.subject}</span>
                    </div>
                  </td>
                  <td className="p-4 align-top">
                      <div className="flex flex-col gap-1 min-w-[140px]">
                          <div className="flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                              <div className="flex items-center gap-1">
                                  <FireIcon className={`w-4 h-4 ${ankiProgress === 100 ? 'text-green-500' : 'text-amber-500'}`} />
                                  <span>{ankiCovered} / {ankiTotal}</span>
                              </div>
                              {ankiProgress === 100 && ankiTotal > 0 && <CheckCircleIcon className="w-4 h-4 text-green-500" />}
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${ankiProgress === 100 ? 'bg-green-500' : 'bg-amber-500'}`} 
                                style={{ width: `${ankiProgress}%` }}
                              ></div>
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">{ankiTotal > 0 ? `${Math.round(ankiProgress)}% Covered` : 'No Flashcards'}</span>
                      </div>
                  </td>
                  <td className="p-4 align-top">
                    <div className="space-y-1">
                        {entry.videoLinks && entry.videoLinks.length > 0 ? (
                            entry.videoLinks.map(link => (
                                <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                    <VideoIcon className="w-3 h-3" />
                                    {link.title}
                                </a>
                            ))
                        ) : (
                            <span className="text-xs text-slate-400 italic">No videos linked</span>
                        )}
                    </div>
                  </td>
                  <td className="p-4 text-right align-top">
                    <button onClick={() => startEdit(entry)} className="text-sm text-primary hover:text-indigo-700 dark:hover:text-indigo-400 font-medium">Edit</button>
                  </td>
                </tr>
              );
            })}
            
            {filteredData.length === 0 && (
                <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                        No pages found matching your criteria.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default KnowledgeBaseView;