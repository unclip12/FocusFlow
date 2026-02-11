import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { KnowledgeBaseEntry, StudySession } from '../types';

/**
 * Native Share Service
 * Provides easy-to-use functions for sharing app content natively
 */

export interface ShareOptions {
    title: string;
    text: string;
    url?: string;
    dialogTitle?: string;
}

/**
 * Generic share function
 */
export async function shareContent(options: ShareOptions): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
        // Fallback for web: use Web Share API if available
        if (navigator.share) {
            try {
                await navigator.share({
                    title: options.title,
                    text: options.text,
                    url: options.url
                });
                return true;
            } catch (err) {
                console.warn('Web share cancelled or failed:', err);
                return false;
            }
        } else {
            // Ultimate fallback: copy to clipboard
            await copyToClipboard(`${options.title}\n\n${options.text}`);
            return true;
        }
    }

    try {
        await Share.share({
            title: options.title,
            text: options.text,
            url: options.url,
            dialogTitle: options.dialogTitle || 'Share via'
        });
        return true;
    } catch (err) {
        console.warn('Native share failed:', err);
        return false;
    }
}

/**
 * Share a study session
 */
export async function shareStudySession(session: StudySession): Promise<boolean> {
    const duration = session.history?.[0]?.durationMinutes || 0;
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`;

    const text = `📚 Study Session Complete!

📖 Topic: ${session.topic || 'General Study'}
📄 Page: ${session.pageNumber}
⏱️ Duration: ${timeStr}
🎯 Anki: ${session.ankiCovered || 0}/${session.ankiTotal || 0} cards

✨ Logged via FocusFlow`;

    return shareContent({
        title: 'Study Session Summary',
        text,
        dialogTitle: 'Share Study Session'
    });
}

/**
 * Share knowledge base entry
 */
export async function shareKnowledgeEntry(entry: KnowledgeBaseEntry): Promise<boolean> {
    const text = `📖 Knowledge Base Entry

📄 Page ${entry.pageNumber}: ${entry.title}
🏥 ${entry.subject} - ${entry.system}

📊 Stats:
• Revisions: ${entry.revisionCount}
• Anki: ${entry.ankiCovered}/${entry.ankiTotal}
• Topics: ${entry.topics.length}

📝 Notes:
${entry.notes || 'No notes added yet'}

✨ From FocusFlow Knowledge Base`;

    return shareContent({
        title: `${entry.title} - FocusFlow`,
        text,
        dialogTitle: 'Share Knowledge Entry'
    });
}

/**
 * Share daily progress stats
 */
export async function shareDailyStats(stats: {
    studyMinutes: number;
    revisions: number;
    ankiCards: number;
    streak: number;
    date: string;
}): Promise<boolean> {
    const hours = Math.floor(stats.studyMinutes / 60);
    const mins = stats.studyMinutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

    const text = `📊 FocusFlow Daily Progress
📅 ${stats.date}

⏱️ Study Time: ${timeStr}
🔄 Revisions: ${stats.revisions}
🎯 Anki Cards: ${stats.ankiCards}
🔥 Streak: ${stats.streak} days

💪 Keep pushing forward!
✨ Tracked with FocusFlow`;

    return shareContent({
        title: 'Daily Study Progress',
        text,
        dialogTitle: 'Share Daily Progress'
    });
}

/**
 * Share weekly summary
 */
export async function shareWeeklySummary(summary: {
    totalMinutes: number;
    totalRevisions: number;
    totalAnki: number;
    daysActive: number;
    startDate: string;
    endDate: string;
}): Promise<boolean> {
    const hours = Math.floor(summary.totalMinutes / 60);
    const mins = summary.totalMinutes % 60;

    const text = `📈 FocusFlow Weekly Summary
📅 ${summary.startDate} - ${summary.endDate}

⏱️ Total Study: ${hours}h ${mins}m
🔄 Revisions: ${summary.totalRevisions}
🎯 Anki Cards: ${summary.totalAnki}
📅 Active Days: ${summary.daysActive}/7

🎓 Your dedication is paying off!
✨ Powered by FocusFlow`;

    return shareContent({
        title: 'Weekly Study Summary',
        text,
        dialogTitle: 'Share Weekly Summary'
    });
}

/**
 * Share revision milestone
 */
export async function shareRevisionMilestone(milestone: {
    pageNumber: string;
    title: string;
    revisionCount: number;
    totalMinutes: number;
}): Promise<boolean> {
    const hours = Math.floor(milestone.totalMinutes / 60);
    const mins = milestone.totalMinutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

    const text = `🎉 Revision Milestone Achieved!

📄 Page ${milestone.pageNumber}: ${milestone.title}
🔄 Completed ${milestone.revisionCount} revisions
⏱️ Total time invested: ${timeStr}

💯 Mastery in progress!
✨ Tracked with FocusFlow`;

    return shareContent({
        title: 'Revision Milestone',
        text,
        dialogTitle: 'Share Achievement'
    });
}

/**
 * Share app link/invitation
 */
export async function shareAppInvite(): Promise<boolean> {
    const text = `Check out FocusFlow - the ultimate study companion for medical students! 🎓

✨ Features:
• Smart revision scheduling
• Study session tracking
• Knowledge base management
• AI study mentor
• Focus timer with Pomodoro

Boost your study game today! 🚀`;

    return shareContent({
        title: 'Join me on FocusFlow',
        text,
        url: 'https://focusflow.app',
        dialogTitle: 'Share FocusFlow'
    });
}

/**
 * Fallback: Copy to clipboard
 */
async function copyToClipboard(text: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
        console.log('Copied to clipboard');
    } catch (err) {
        console.warn('Clipboard copy failed:', err);
    }
}

/**
 * Check if native sharing is available
 */
export function isShareAvailable(): boolean {
    return Capacitor.isNativePlatform() || ('share' in navigator);
}
