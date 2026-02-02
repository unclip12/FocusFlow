

import React, { useState, useEffect } from 'react';
import { StudyMaterial, MaterialChatMessage } from '../types';
import { XMarkIcon, CheckCircleIcon, TrashIcon, ChatBubbleLeftRightIcon, DocumentTextIcon } from './Icons';
import { getMaterialChats, updateMaterialTitle, deleteStudyMaterial, toggleMaterialActive } from '../services/firebase';

interface MaterialDetailModalProps {
    material: StudyMaterial;
    onClose: () => void;
    onUpdate: () => void;
}

export const MaterialDetailModal: React.FC<MaterialDetailModalProps> = ({ material, onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'TEXT' | 'CHATS'>('TEXT');
    const [chats, setChats] = useState<MaterialChatMessage[]>([]);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [title, setTitle] = useState(material.title);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    useEffect(() => {
        loadChats();
    }, [material.id]);

    const loadChats = async () => {
        const data = await getMaterialChats(material.id);
        setChats(data);
    };

    const handleSaveTitle = async () => {
        if (title !== material.title) {
            await updateMaterialTitle(material.id, title);
            onUpdate();
        }
        setIsEditingTitle(false);
    };

    const handleDelete = async () => {
        if (confirm("Delete this material permanently?")) {
            await deleteStudyMaterial(material.id);
            onUpdate();
            onClose();
        }
    };

    const handleToggleActive = async () => {
        await toggleMaterialActive(material.id, !material.isActive);
        // Locally update state to reflect immediately in UI (though prop won't change until parent refresh)
        material.isActive = !material.isActive; 
        onUpdate();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                    <div className="flex-1 min-w-0 mr-4">
                        {isEditingTitle ? (
                            <input 
                                type="text" 
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                onBlur={handleSaveTitle}
                                onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
                                className="w-full p-1 rounded border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg bg-white dark:bg-slate-700 dark:text-white"
                                autoFocus
                            />
                        ) : (
                            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsEditingTitle(true)}>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white truncate">{title}</h2>
                                <span className="text-slate-400 text-xs opacity-0 group-hover:opacity-100">Edit</span>
                            </div>
                        )}
                        <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">{material.sourceType} • {new Date(material.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-2 border-b border-slate-100 dark:border-slate-700 flex gap-4 overflow-x-auto">
                    <button 
                        onClick={() => setActiveTab('TEXT')}
                        className={`py-2 px-4 text-xs font-bold rounded-lg transition-all ${activeTab === 'TEXT' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        Content
                    </button>
                    <button 
                        onClick={() => setActiveTab('CHATS')}
                        className={`py-2 px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'CHATS' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        History ({chats.length})
                    </button>
                    
                    <div className="flex-1"></div>

                    <button 
                        onClick={handleToggleActive}
                        className={`py-2 px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${material.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                    >
                        {material.isActive ? <CheckCircleIcon className="w-4 h-4" /> : null}
                        {material.isActive ? 'Active Context' : 'Set as Context'}
                    </button>
                    
                    <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900 custom-scrollbar">
                    {activeTab === 'TEXT' ? (
                        <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300">
                            {material.text}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {chats.length === 0 ? (
                                <div className="text-center text-slate-400 italic py-12">No conversation history for this material yet.</div>
                            ) : (
                                chats.map(chat => (
                                    <div key={chat.id} className={`flex flex-col ${chat.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl p-4 text-sm ${chat.role === 'user' ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-100' : 'bg-slate-50 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700'}`}>
                                            <p className="whitespace-pre-wrap">{chat.text}</p>
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 px-2">
                                            {new Date(chat.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};