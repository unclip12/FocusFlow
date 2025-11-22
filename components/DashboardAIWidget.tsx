import React, { useEffect, useState } from 'react';
import { StudyPlanItem } from '../types';
import { SparklesIcon, ChatBubbleLeftRightIcon, ArrowPathIcon } from './Icons';
import { generateMentorDailyBrief } from '../services/geminiService';

interface DashboardAIWidgetProps {
  sessions: any[]; // Accommodate transition from StudySession to KnowledgeBaseEntry
  studyPlan: StudyPlanItem[];
  streak: number;
  onOpenChat: () => void;
  displayName?: string;
}

export const DashboardAIWidget: React.FC<DashboardAIWidgetProps> = ({ sessions, studyPlan, streak, onOpenChat, displayName }) => {
  const [brief, setBrief] = useState<{ message: string, quote: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBrief = async () => {
        setLoading(true);
        // Simple caching to avoid hitting API on every render, based on session length/plan length
        const cacheKey = `mentor_brief_${sessions.length}_${studyPlan.length}_${new Date().toDateString()}`;
        const cached = sessionStorage.getItem(cacheKey);
        
        if (cached) {
            setBrief(JSON.parse(cached));
            setLoading(false);
            return;
        }

        const data = await generateMentorDailyBrief(sessions, studyPlan, streak, displayName);
        setBrief(data);
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        setLoading(false);
    };

    fetchBrief();
  }, [sessions.length, studyPlan.length, streak, displayName]);

  return (
    <div 
        onClick={onOpenChat}
        className="relative overflow-hidden bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer group hover:shadow-xl transition-all duration-300 mb-8"
    >
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/3 -translate-y-1/3">
            <SparklesIcon className="w-48 h-48 text-white" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <SparklesIcon className="w-5 h-5 text-yellow-300" />
                    </div>
                    <h3 className="font-bold text-lg tracking-wide text-teal-50">AI MENTOR INSIGHT</h3>
                </div>
                
                {loading ? (
                    <div className="flex items-center gap-2 text-teal-100 animate-pulse">
                        <ArrowPathIcon className="w-4 h-4 animate-spin" /> Analyzing your progress...
                    </div>
                ) : (
                    <div>
                        <p className="text-lg md:text-xl font-bold leading-relaxed mb-3 text-white">
                            "{brief?.message}"
                        </p>
                        <div className="bg-white/10 rounded-lg p-3 border-l-4 border-yellow-400 backdrop-blur-sm">
                            <p className="text-xs md:text-sm text-teal-50 italic font-medium">
                                {brief?.quote}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-shrink-0">
                <button className="px-6 py-3 bg-white text-teal-700 font-bold rounded-xl shadow-md hover:bg-teal-50 transition-colors flex items-center gap-2 group-hover:scale-105 transform duration-200">
                    <ChatBubbleLeftRightIcon className="w-5 h-5" />
                    Chat with Mentor
                </button>
            </div>
        </div>
    </div>
  );
};
