import React, { useState, useEffect, useRef } from 'react';
import { StudySession, StudyPlanItem, VideoResource, Attachment, getAdjustedDate } from '../types';
import { chatWithMentor } from '../services/geminiService';
import { SparklesIcon, PaperAirplaneIcon, UserCircleIcon, CheckCircleIcon } from './Icons';

interface AIChatViewProps {
  sessions: StudySession[];
  studyPlan: StudyPlanItem[];
  streak: number;
  onAddToPlan: (item: Omit<StudyPlanItem, 'id'>, newVideo?: VideoResource, attachments?: Attachment[]) => void;
}

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
    isSystemAction?: boolean; // For visual cues (e.g., "Added to Planner")
}

export const AIChatView: React.FC<AIChatViewProps> = ({ sessions, studyPlan, streak, onAddToPlan }) => {
  const [messages, setMessages] = useState<Message[]>([
      {
          id: 'welcome',
          role: 'model',
          text: "Hello, doctor. I've reviewed your charts. Your study stats are loaded. How can I help you optimize your preparation today?",
          timestamp: new Date()
      }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [messages]);

  const handleSend = async () => {
      if (!input.trim()) return;
      
      const userMsg: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          text: input,
          timestamp: new Date()
      };

      const newHistory = [...messages, userMsg];
      setMessages(newHistory);
      setInput('');
      setIsTyping(true);

      // Prepare history for API
      const historyForApi = newHistory.filter(m => !m.isSystemAction).map(m => ({ role: m.role, text: m.text }));
      
      const response = await chatWithMentor(historyForApi, userMsg.text, sessions, studyPlan, streak);

      // Handle Tool Calls
      if (response.toolCalls && response.toolCalls.length > 0) {
          for (const call of response.toolCalls) {
              if (call.name === 'addStudyTask') {
                  const args = call.args;
                  
                  // Execute Action
                  onAddToPlan({
                      date: getAdjustedDate(new Date()),
                      type: 'HYBRID',
                      pageNumber: args.pageNumber,
                      topic: args.topic,
                      estimatedMinutes: args.durationMinutes,
                      ankiCount: args.ankiCount,
                      videoUrl: args.videoUrl,
                      isCompleted: false
                  });

                  // Add System Message for visual confirmation
                  const sysMsg: Message = {
                      id: crypto.randomUUID(),
                      role: 'model',
                      text: `✓ Added "${args.topic}" (Pg ${args.pageNumber}) to Today's Target`,
                      timestamp: new Date(),
                      isSystemAction: true
                  };
                  
                  // Note: In a full implementation, we would send the tool response back to the model.
                  // For now, we let the model's text response follow up naturally or rely on its generated text.
                  setMessages(prev => [...prev, sysMsg]);
              }
          }
      }

      const botMsg: Message = {
          id: crypto.randomUUID(),
          role: 'model',
          text: response.text || (response.toolCalls ? "Done." : "I didn't catch that."),
          timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
  };

  return (
    <div className="animate-fade-in h-[80vh] sm:h-[calc(100vh-8rem)] flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <SparklesIcon className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
                <h2 className="text-lg font-bold">Dr. Focus AI</h2>
                <p className="text-xs text-teal-100 opacity-90">Personal Study Mentor • Context Aware</p>
            </div>
        </div>

        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
            {messages.map(msg => {
                if (msg.isSystemAction) {
                     return (
                        <div key={msg.id} className="flex justify-center my-2">
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                                <CheckCircleIcon className="w-4 h-4" /> {msg.text}
                            </div>
                        </div>
                     );
                }

                const isUser = msg.role === 'user';
                return (
                    <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm ${isUser ? 'bg-indigo-100 text-primary' : 'bg-teal-100 text-teal-600'}`}>
                                {isUser ? <UserCircleIcon className="w-6 h-6" /> : <SparklesIcon className="w-5 h-5" />}
                            </div>
                            <div className={`p-3 sm:p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                                isUser 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700'
                            }`}>
                                {msg.text}
                                <div className={`text-[10px] mt-2 opacity-70 ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
                                    {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
            {isTyping && (
                <div className="flex justify-start">
                    <div className="flex gap-3 max-w-[80%]">
                        <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center">
                             <SparklesIcon className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 flex items-center gap-1">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 pb-safe">
            <div className="relative flex items-center gap-2">
                <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Ask your mentor..."
                    className="flex-1 p-3 pr-12 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all text-slate-800 dark:text-white text-sm sm:text-base"
                />
                <button 
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    className="absolute right-2 p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:hover:bg-teal-600 transition-colors"
                >
                    <PaperAirplaneIcon className="w-5 h-5" />
                </button>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-2">
                AI Mentor can make mistakes. Always verify medical information.
            </p>
        </div>
    </div>
  );
};