
import React, { useState, useEffect, useMemo } from 'react';
import { StudyMaterial, Attachment } from '../types';
import { CloudArrowUpIcon, DocumentTextIcon, CheckCircleIcon, TrashIcon, EyeIcon, PhotoIcon, DocumentIcon, PlusIcon, ChatBubbleLeftRightIcon } from './Icons';
import { saveStudyMaterial, getStudyMaterials, deleteStudyMaterial, toggleMaterialActive } from '../services/firebase';
import { extractTextFromMedia } from '../services/geminiService';
import { MaterialDetailModal } from './MaterialDetailModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

// Helper to generate ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

interface DataViewProps {
    viewState: {
        filterSource: 'ALL' | 'UPLOAD' | 'MENTOR';
    };
    setViewState: React.Dispatch<React.SetStateAction<{
        filterSource: 'ALL' | 'UPLOAD' | 'MENTOR';
    }>>;
}

export const DataView: React.FC<DataViewProps> = ({ viewState, setViewState }) => {
    const [materials, setMaterials] = useState<StudyMaterial[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
    
    // Filters
    const { filterSource } = viewState;
    const setFilterSource = (source: 'ALL' | 'UPLOAD' | 'MENTOR') => setViewState(prev => ({ ...prev, filterSource: source }));

    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    // const [uploadStatus, setUploadStatus] = useState(''); // Removed
    const [pastedText, setPastedText] = useState('');

    // Delete State
    const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadMaterials();
    }, []);

    const loadMaterials = async () => {
        setIsLoading(true);
        try {
            const data = await getStudyMaterials();
            setMaterials(data);
        } catch (error) {
            console.error("Failed to load materials", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredMaterials = useMemo(() => {
        if (filterSource === 'ALL') return materials;
        if (filterSource === 'MENTOR') return materials.filter(m => m.source === 'MENTOR');
        return materials.filter(m => m.source === 'UPLOAD' || m.source === 'PASTE' || !m.source);
    }, [materials, filterSource]);

    /* REMOVED FILE UPLOAD HANDLER
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // Disabled logic
    };
    */

    const handlePasteSave = async () => {
        if (!pastedText.trim()) return;
        
        // Size Check for Paste
        let textToSave = pastedText;
        if (textToSave.length > 950000) {
             alert("Warning: Pasted content exceeds the safe storage limit. It will be truncated.");
             textToSave = textToSave.substring(0, 950000);
        }

        setIsUploading(true);
        try {
            const newMaterial: StudyMaterial = {
                id: generateId(),
                title: `Pasted Text - ${new Date().toLocaleDateString()}`,
                text: textToSave,
                sourceType: 'TEXT',
                createdAt: new Date().toISOString(),
                isActive: false,
                tokenEstimate: textToSave.length / 4,
                source: 'PASTE'
            };
            await saveStudyMaterial(newMaterial);
            setPastedText('');
            loadMaterials();
        } catch (error) {
            console.error("Save error", error);
        } finally {
            setIsUploading(false);
        }
    };

    const executeDelete = async () => {
        if (materialToDelete) {
            await deleteStudyMaterial(materialToDelete);
            setMaterials(prev => prev.filter(m => m.id !== materialToDelete));
            setMaterialToDelete(null);
        }
    };

    const handleToggleActive = async (id: string, currentState: boolean) => {
        // Optimistic update
        setMaterials(prev => prev.map(m => {
            if (m.id === id) return { ...m, isActive: !currentState };
            if (!currentState) return { ...m, isActive: false }; // If turning ON, turn others OFF
            return m;
        }));
        
        await toggleMaterialActive(id, !currentState);
        loadMaterials(); // Sync to be sure
    };

    return (
        <div className="animate-fade-in space-y-8 pb-20">
            
            <DeleteConfirmationModal 
                isOpen={!!materialToDelete}
                onClose={() => setMaterialToDelete(null)}
                onConfirm={executeDelete}
                title="Delete Material?"
                message="This will permanently delete the material and its chat history."
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl backdrop-blur-sm">
                        <DocumentTextIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Info Files</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Manage study materials for your AI Buddy</p>
                    </div>
                </div>
                
                {/* Filter Tabs */}
                <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg self-start backdrop-blur-sm">
                    <button 
                        onClick={() => setFilterSource('ALL')} 
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${filterSource === 'ALL' ? 'bg-white/80 dark:bg-slate-700/80 shadow-sm text-slate-800 dark:text-white backdrop-blur-md' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        All
                    </button>
                    <button 
                        onClick={() => setFilterSource('UPLOAD')} 
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${filterSource === 'UPLOAD' ? 'bg-white/80 dark:bg-slate-700/80 shadow-sm text-slate-800 dark:text-white backdrop-blur-md' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Uploads
                    </button>
                    <button 
                        onClick={() => setFilterSource('MENTOR')} 
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${filterSource === 'MENTOR' ? 'bg-white/80 dark:bg-slate-700/80 shadow-sm text-slate-800 dark:text-white backdrop-blur-md' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        From Mentor
                    </button>
                </div>
            </div>

            {/* Add Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* File Upload Card - REMOVED */}
                {/* 
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-white/40 dark:border-slate-700/50 shadow-sm flex flex-col items-center justify-center text-center space-y-4 hover:border-indigo-300 transition-colors">
                    <div className={`w-16 h-16 rounded-full bg-indigo-50/50 dark:bg-indigo-900/20 flex items-center justify-center backdrop-blur-sm ${isUploading ? 'animate-pulse' : ''}`}>
                        <CloudArrowUpIcon className="w-8 h-8 text-indigo-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Upload Document</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">PDF, Images, or Text files (txt, md, json, code).</p>
                    </div>
                    
                    {isUploading ? (
                        <div className="text-sm font-bold text-indigo-600 animate-pulse">{uploadStatus}</div>
                    ) : (
                        <label className="cursor-pointer px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-indigo-200 dark:shadow-none">
                            Select File
                            <input 
                                type="file" 
                                className="hidden" 
                                accept=".pdf,image/*,text/*,.txt,.md,.json,.csv,.js,.ts,.py,.html,.css" 
                                onChange={handleFileUpload} 
                            />
                        </label>
                    )}
                </div>
                */}

                {/* Paste Text Card - Expanded to full width if upload removed, but keeping grid for structure */}
                <div className="col-span-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-4 border border-white/40 dark:border-slate-700/50 shadow-sm flex flex-col">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Save Text Note</h3>
                    <textarea 
                        value={pastedText}
                        onChange={e => setPastedText(e.target.value)}
                        placeholder="Paste raw text notes here to save as Info File..."
                        className="flex-1 w-full p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-none focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none text-sm text-slate-700 dark:text-slate-300 mb-3 backdrop-blur-sm"
                        rows={4}
                    />
                    <button 
                        onClick={handlePasteSave}
                        disabled={!pastedText.trim() || isUploading}
                        className="self-end px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                        Save as Info File
                    </button>
                </div>
            </div>

            {/* List Section */}
            <div>
                <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    Saved Materials 
                    <span className="bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 px-2 py-0.5 rounded-full text-xs backdrop-blur-sm">{filteredMaterials.length}</span>
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMaterials.map(material => (
                        <div key={material.id} className={`relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-xl p-4 border transition-all hover:shadow-md ${material.isActive ? 'border-green-400 ring-1 ring-green-400/20' : 'border-white/40 dark:border-slate-700/50'}`}>
                             <div className="flex justify-between items-start mb-3">
                                 <div className={`p-2 rounded-lg backdrop-blur-sm ${material.sourceType === 'PDF' ? 'bg-red-50/50 text-red-500' : material.sourceType === 'IMAGE' ? 'bg-blue-50/50 text-blue-500' : 'bg-slate-100/50 text-slate-500'}`}>
                                     {material.sourceType === 'PDF' ? <DocumentIcon className="w-5 h-5" /> : material.sourceType === 'IMAGE' ? <PhotoIcon className="w-5 h-5" /> : <DocumentTextIcon className="w-5 h-5" />}
                                 </div>
                                 <div className="flex gap-1">
                                     <button onClick={() => setSelectedMaterial(material)} className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50/50 rounded-lg transition-colors" title="View">
                                         <EyeIcon className="w-4 h-4" />
                                     </button>
                                     <button onClick={() => setMaterialToDelete(material.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-colors" title="Delete">
                                         <TrashIcon className="w-4 h-4" />
                                     </button>
                                 </div>
                             </div>
                             
                             <h4 className="font-bold text-slate-800 dark:text-white truncate mb-1" title={material.title}>{material.title}</h4>
                             <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
                                 <span>{new Date(material.createdAt).toLocaleDateString()}</span>
                                 <span>~{Math.round(material.text.length / 1000)}k chars</span>
                             </div>

                             {/* Source Badge */}
                             {material.source === 'MENTOR' && (
                                 <div className="absolute top-4 right-16 flex items-center gap-1 bg-purple-100/50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm">
                                     <ChatBubbleLeftRightIcon className="w-3 h-3" /> Mentor
                                 </div>
                             )}

                             <button 
                                onClick={() => handleToggleActive(material.id, material.isActive)}
                                className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors backdrop-blur-sm ${material.isActive ? 'bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-50/50 text-slate-500 hover:bg-slate-100/50 dark:bg-slate-700/50 dark:text-slate-400'}`}
                             >
                                 {material.isActive ? (
                                     <><CheckCircleIcon className="w-3 h-3" /> Active for Study Buddy</>
                                 ) : (
                                     "Use in Study Buddy"
                                 )}
                             </button>
                        </div>
                    ))}

                    {filteredMaterials.length === 0 && !isLoading && (
                        <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 dark:text-slate-500 italic">
                            {filterSource === 'MENTOR' ? 'No materials from Mentor yet.' : 'No materials found.'}
                        </div>
                    )}
                </div>
            </div>

            {selectedMaterial && (
                <MaterialDetailModal 
                    material={selectedMaterial} 
                    onClose={() => setSelectedMaterial(null)} 
                    onUpdate={() => loadMaterials()}
                />
            )}
        </div>
    );
};
