
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { KnowledgeBaseEntry, getAdjustedDate } from '../types';
import { ChartBarIcon } from './Icons';

interface ActivityGraphsProps {
  knowledgeBase: KnowledgeBaseEntry[];
}

type TimeRange = 'WEEK' | 'MONTH' | 'YEAR';

export const ActivityGraphs: React.FC<ActivityGraphsProps> = ({ knowledgeBase }) => {
    const [range, setRange] = useState<TimeRange>('WEEK');

    const chartData = useMemo(() => {
        const activityByDate = new Map<string, { studied: Set<string>, revised: Set<string> }>();
        const activityByMonth = new Map<string, { studied: Set<string>, revised: Set<string> }>();

        // Populate Maps
        knowledgeBase.forEach(kb => {
            (kb.logs || []).forEach(log => {
                const date = new Date(log.timestamp);
                const dateStr = getAdjustedDate(log.timestamp);
                const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                // Daily Map
                if (!activityByDate.has(dateStr)) {
                    activityByDate.set(dateStr, { studied: new Set(), revised: new Set() });
                }
                const dayAct = activityByDate.get(dateStr)!;
                
                // Monthly Map
                if (!activityByMonth.has(monthStr)) {
                    activityByMonth.set(monthStr, { studied: new Set(), revised: new Set() });
                }
                const monthAct = activityByMonth.get(monthStr)!;

                if (log.type === 'STUDY') {
                    dayAct.studied.add(kb.pageNumber);
                    monthAct.studied.add(kb.pageNumber);
                } else if (log.type === 'REVISION') {
                    dayAct.revised.add(kb.pageNumber);
                    monthAct.revised.add(kb.pageNumber);
                }
            });
        });

        const data = [];
        const now = new Date();

        if (range === 'WEEK') {
            // Last 7 Days
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                const dStr = getAdjustedDate(d);
                const act = activityByDate.get(dStr);
                data.push({
                    name: d.toLocaleDateString('en-US', { weekday: 'short' }),
                    studied: act ? act.studied.size : 0,
                    revised: act ? act.revised.size : 0,
                });
            }
        } else if (range === 'MONTH') {
            // Last 30 Days
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                const dStr = getAdjustedDate(d);
                const act = activityByDate.get(dStr);
                data.push({
                    name: d.getDate().toString(),
                    studied: act ? act.studied.size : 0,
                    revised: act ? act.revised.size : 0,
                    fullDate: d.toLocaleDateString()
                });
            }
        } else if (range === 'YEAR') {
            // Last 12 Months
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const act = activityByMonth.get(monthStr);
                data.push({
                    name: d.toLocaleDateString('en-US', { month: 'short' }),
                    studied: act ? act.studied.size : 0,
                    revised: act ? act.revised.size : 0,
                });
            }
        }

        return data;
    }, [knowledgeBase, range]);

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 p-5 rounded-2xl shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <ChartBarIcon className="w-4 h-4 text-slate-400" />
                    Activity
                </h3>
                <div className="flex bg-slate-100/50 dark:bg-slate-700/50 p-1 rounded-lg backdrop-blur-sm">
                    {(['WEEK', 'MONTH', 'YEAR'] as const).map((r) => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                range === r 
                                ? 'bg-white/80 dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm backdrop-blur-md' 
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            {r.charAt(0) + r.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Studied Chart */}
                <div className="min-h-[250px]">
                    <h4 className="text-xs font-bold text-indigo-500 uppercase mb-4 tracking-wider text-center">Pages Studied</h4>
                    <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <BarChart data={chartData} margin={{ top: 20, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                                    axisLine={false} 
                                    tickLine={false} 
                                    interval={range === 'MONTH' ? 4 : 0}
                                />
                                <YAxis hide />
                                <Tooltip 
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="studied" fill="#6366f1" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="studied" position="top" fontSize={10} fill="#6366f1" formatter={(val: number) => val > 0 ? val : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Revised Chart */}
                <div className="min-h-[250px]">
                    <h4 className="text-xs font-bold text-sky-500 uppercase mb-4 tracking-wider text-center">Pages Revised</h4>
                    <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <BarChart data={chartData} margin={{ top: 20, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                                    axisLine={false} 
                                    tickLine={false} 
                                    interval={range === 'MONTH' ? 4 : 0}
                                />
                                <YAxis hide />
                                <Tooltip 
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="revised" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="revised" position="top" fontSize={10} fill="#0ea5e9" formatter={(val: number) => val > 0 ? val : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
