import React, { useState, useEffect, useRef } from 'react';
import { Block, StudySession, StudyPlanItem, BlockSegment } from '../types';
import { SparklesIcon, XMarkIcon, PaperAirplaneIcon, PauseIcon, CheckCircleIcon, StopIcon, PlayIcon } from './Icons';
import { chatWithMentor } from '../services/geminiService';

interface ReflectionModalProps {
  isOpen: boolean;
  block: Block;
  nextBlock?: Block;
  onStartNextBlock?: (blockId: string) => void;
  onClose: () => void;
  onSave: (status: 'COMPLETED' | 'PARTIAL' | 'NOT_DONE', pagesCovered: number[], carryForwardPages: number[], notes: string, interruptions?: { start: string, end: string, reason: string }[]) => void;
  onUpdateBlock?: (blockId: string, updates: Partial<Block>) => void;
}

// Simple type for local chat
interface LocalMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    isSystemAction?: boolean;
}

export const ReflectionModal: React.FC<ReflectionModalProps> = ({ isOpen, block, nextBlock, onStartNextBlock, onClose, onSave, onUpdateBlock }) => {
    const [messages, setMessages] = useState<LocalMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            let initialText = block.status === 'PAUSED' 
                ? `Hey, you've paused your **${block.title}** session. Everything okay? Let me know if you're taking a break or if you're done.`
                : `You stopped the **${block.title}** timer. Did you finish everything planned?`;

            if (nextBlock) {
                initialText += `\n\nReady for the next block: **${nextBlock.title}**?`;
            }
            
            setMessages([{
                id: 'init',
                role: 'model',
                text: initialText
            }]);
        } else {
            setMessages([]); // Clear messages on close
        }
    }, [isOpen, block, nextBlock]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSendMessage = async (textOverride?: string) => {
        const text = textOverride || input;
        if (!text.trim()) return;

        const userMsg: LocalMessage = { id: Date.now().toString(), role: 'user', text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const blocksForContext = nextBlock ? [block, nextBlock] : [block];
            const response = await chatWithMentor(
                messages.map(m => ({ role: m.role, text: m.text })),
                text,
                [], 
                [], 
                0,
                undefined,
                blocksForContext
            );

            if (response.text && response.text.trim()) {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: response.text }]);
            }

            if (response.toolCalls) {
                for (const call of response.toolCalls) {
                    if (call.name === 'controlSession') {
                        const args = call.args as any;
                        
                        if (onUpdateBlock) {
                            if (args.action === 'PAUSE') {
                                onUpdateBlock(block.id, {
                                    status: 'PAUSED',
                                    actualNotes: args.reason ? `Paused: ${args.reason}` : undefined
                                });
                                if (!response.text) {
                                    setMessages(prev => [...prev, { 
                                        id: Date.now().toString(), 
                                        role: 'model', 
                                        text: `Session paused: ${args.reason || 'User request'}. Close this window and press Start to resume.`,
                                        isSystemAction: true
                                    }]);
                                }
                            } else if (args.action === 'RESUME') {
                                onUpdateBlock(block.id, { status: 'IN_PROGRESS' });
                                onClose(); // Resume implies going back to timer
                            } else if (args.action === 'FINISH') {
                                onSave(
                                    args.completionStatus || 'COMPLETED',
                                    args.pagesCovered || [],
                                    args.carryForwardPages || [],
                                    args.notes || '',
                                    args.interruptions
                                );
                            } else if (args.action === 'START' && nextBlock && onStartNextBlock && args.blockIndex === nextBlock.index) {
                                onStartNextBlock(nextBlock.id);
                                onClose();
                            }
                        }
                    }
                }
            }

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "I'm having trouble connecting. You can use the buttons below." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleStartNext = () => {
        if (nextBlock && onStartNextBlock) {
            onStartNextBlock(nextBlock.id);
            onClose();
        }
    };

    if (!isOpen) return null;

    // Helper for quick replies
    const QuickReply = ({ text, emoji, onClick }: { text: string, emoji: React.ReactNode, onClick: () => void }) => (
        <button 
            onClick={onClick}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
        >
            {emoji} {text}
        </button>
    );

    // Format Bold Text
    const formatText = (text: string) => {
        return text.split(/(\*\*.*?\*\*)/g).map((part, idx) => 
            part.startsWith('**') ? <span key={idx} className="font-bold text-indigo-600 dark:text-indigo-400">{part.slice(2, -2)}</span> : part
        );
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[600px] max-h-[90dvh] relative">
                
                {/* Header - Static */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0 z-10">
                    <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30">
                             <SparklesIcon className="w-4 h-4 text-white" />
                         </div>
                         <div>
                             <h2 className="font-bold text-slate-800 dark:text-white text-sm">AI Mentor</h2>
                             <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Session Control</p>
                         </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Chat Area - Flexible and Scrollable */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950 overscroll-contain" ref={scrollRef}>
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : msg.isSystemAction
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-2 backdrop-blur-sm rounded-tl-none'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none'
                            }`}>
                                {msg.isSystemAction && <CheckCircleIcon className="w-4 h-4 mr-1" />}
                                {formatText(msg.text)}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                                    <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Actions & Input - Static */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar mb-1">
                        <QuickReply text="I'm done, finished all pages." emoji={<CheckCircleIcon className="w-3 h-3 text-green-500" />} onClick={() => handleSendMessage("I'm done, finished all pages.")} />
                        <QuickReply text="Taking a short break." emoji={<PauseIcon className="w-3 h-3 text-amber-500" />} onClick={() => handleSendMessage("Taking a short break.")} />
                        {nextBlock && onStartNextBlock && (
                            <QuickReply text="Start Next" emoji={<PlayIcon className="w-3 h-3 text-green-500" />} onClick={handleStartNext} />
                        )}
                    </div>
                    
                    <div className="relative">
                        <input 
                            type="text" 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Type your update... (e.g. 'Phone call, back in 5')"
                            className="w-full p-3 pr-12 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                            autoFocus
                        />
                        <button 
                            onClick={() => handleSendMessage()}
                            disabled={!input.trim() || isTyping}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-all disabled:opacity-50 disabled:scale-95"
                        >
                            <PaperAirplaneIcon className="w-4 h-4 transform rotate-90" />
                        </button>
                    </div>
                    
                    {/* Fallback controls if AI fails */}
                    <div className="mt-3 flex justify-center">
                        <button 
                            onClick={() => onSave('COMPLETED', [], [], 'Manual completion')}
                            className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                        >
                            Manual Finish
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};