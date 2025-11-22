import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { KnowledgeBaseEntry, getAdjustedDate } from '../types';
import { ChartBarIcon } from './Icons';

interface ActivityGraphsProps {
  knowledgeBase: KnowledgeBaseEntry[];
}

const ChartWrapper: React.FC<{ title: string; data: any[]; dataKey: string; color: string; }> = ({ title, data, dataKey, color }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-4">{title}</h4>
        <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(4px)',
                        fontSize: '12px'
                    }} />
                    <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
);

export const ActivityGraphs: React.FC<ActivityGraphsProps> = ({ knowledgeBase }) => {
    const last7DaysData = useMemo(() => {
        const activityByDate = new Map<string, { studied: Set<string>, revised: Set<string> }>();

        knowledgeBase.forEach(kb => {
            (kb.logs || []).forEach(log => {
                const dateStr = getAdjustedDate(log.timestamp);
                if (!activityByDate.has(dateStr)) {
                    activityByDate.set(dateStr, { studied: new Set(), revised: new Set() });
                }
                const dayActivity = activityByDate.get(dateStr)!;

                if (log.type === 'STUDY') {
                    dayActivity.studied.add(kb.pageNumber);
                } else if (log.type === 'REVISION') {
                    dayActivity.revised.add(kb.pageNumber);
                }
            });
        });

        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = getAdjustedDate(date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

            const activity = activityByDate.get(dateStr);
            chartData.push({
                name: dayName,
                studied: activity ? activity.studied.size : 0,
                revised: activity ? activity.revised.size : 0,
            });
        }
        return chartData;

    }, [knowledgeBase]);

    return (
        <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4 text-slate-400" />
                Weekly Activity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChartWrapper title="Pages Studied (Last 7 Days)" data={last7DaysData} dataKey="studied" color="#4f46e5" />
                <ChartWrapper title="Pages Revised (Last 7 Days)" data={last7DaysData} dataKey="revised" color="#0ea5e9" />
            </div>
        </div>
    );
};
