import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { KnowledgeBaseEntry } from '../types';

/**
 * Native Share Service for FocusFlow
 * Provides native sharing functionality for study data
 * Falls back to Web Share API on browsers
 */

const canShare = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    return true;
  }
  // Check Web Share API support
  return typeof navigator !== 'undefined' && 'share' in navigator;
};

/**
 * Share a study session summary
 */
export const shareSession = async (session: {
  topic: string;
  pageNumber: string;
  durationMinutes: number;
  date: string;
  ankiCovered?: number;
  notes?: string;
}) => {
  const canShareData = await canShare();
  if (!canShareData) {
    console.warn('Sharing not supported on this platform');
    return;
  }

  const text = `📚 Study Session Complete!

Topic: ${session.topic}
Page: ${session.pageNumber}
Duration: ${session.durationMinutes} mins
${session.ankiCovered ? `Anki Cards: ${session.ankiCovered}` : ''}
Date: ${new Date(session.date).toLocaleDateString()}
${session.notes ? `\nNotes: ${session.notes}` : ''}

✨ Tracked with FocusFlow`;

  try {
    await Share.share({
      title: 'Study Session',
      text: text,
      dialogTitle: 'Share Study Session',
    });
  } catch (error) {
    console.warn('Share cancelled or failed:', error);
  }
};

/**
 * Share daily/weekly progress stats
 */
export const shareProgress = async (stats: {
  streak: number;
  totalSessions: number;
  totalMinutes: number;
  pagesStudied: number;
  period: 'daily' | 'weekly' | 'monthly';
}) => {
  const canShareData = await canShare();
  if (!canShareData) {
    console.warn('Sharing not supported on this platform');
    return;
  }

  const periodLabel = stats.period === 'daily' ? 'Today' : stats.period === 'weekly' ? 'This Week' : 'This Month';
  const text = `🎯 My FocusFlow Progress (${periodLabel})

🔥 Streak: ${stats.streak} days
📖 Sessions: ${stats.totalSessions}
⏱️ Study Time: ${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m
📄 Pages Covered: ${stats.pagesStudied}

✨ Keep pushing forward!`;

  try {
    await Share.share({
      title: 'My Progress',
      text: text,
      dialogTitle: 'Share Progress',
    });
  } catch (error) {
    console.warn('Share cancelled or failed:', error);
  }
};

/**
 * Share a knowledge base entry (page summary)
 */
export const shareKnowledgeEntry = async (entry: KnowledgeBaseEntry) => {
  const canShareData = await canShare();
  if (!canShareData) {
    console.warn('Sharing not supported on this platform');
    return;
  }

  const text = `📚 Study Notes - ${entry.title}

Page: ${entry.pageNumber}
Subject: ${entry.subject}
System: ${entry.system}

Revisions: ${entry.revisionCount}
Anki Cards: ${entry.ankiCovered}/${entry.ankiTotal}
${entry.topics.length > 0 ? `\nTopics: ${entry.topics.map(t => t.name).join(', ')}` : ''}
${entry.notes ? `\nNotes:\n${entry.notes}` : ''}

✨ Organized with FocusFlow`;

  try {
    await Share.share({
      title: entry.title,
      text: text,
      dialogTitle: 'Share Study Notes',
    });
  } catch (error) {
    console.warn('Share cancelled or failed:', error);
  }
};

/**
 * Share revision due reminder
 */
export const shareRevisionReminder = async (items: Array<{
  title: string;
  pageNumber: string;
  dueDate: string;
}>) => {
  const canShareData = await canShare();
  if (!canShareData) {
    console.warn('Sharing not supported on this platform');
    return;
  }

  const itemsList = items.map(item => `• ${item.title} (Page ${item.pageNumber})`).join('\n');
  const text = `⏰ Revision Reminder

${items.length} items due for revision:

${itemsList}

✨ Never forget with FocusFlow`;

  try {
    await Share.share({
      title: 'Revision Due',
      text: text,
      dialogTitle: 'Share Revision Reminder',
    });
  } catch (error) {
    console.warn('Share cancelled or failed:', error);
  }
};

/**
 * Share daily summary
 */
export const shareDailySummary = async (summary: {
  date: string;
  sessionsCompleted: number;
  totalMinutes: number;
  pagesStudied: number;
  revisionsCompleted: number;
  streak: number;
}) => {
  const canShareData = await canShare();
  if (!canShareData) {
    console.warn('Sharing not supported on this platform');
    return;
  }

  const text = `📊 Daily Summary - ${new Date(summary.date).toLocaleDateString()}

✅ Sessions: ${summary.sessionsCompleted}
⏱️ Time: ${Math.floor(summary.totalMinutes / 60)}h ${summary.totalMinutes % 60}m
📄 Pages: ${summary.pagesStudied}
🔄 Revisions: ${summary.revisionsCompleted}
🔥 Streak: ${summary.streak} days

✨ Powered by FocusFlow`;

  try {
    await Share.share({
      title: 'Daily Summary',
      text: text,
      dialogTitle: 'Share Daily Summary',
    });
  } catch (error) {
    console.warn('Share cancelled or failed:', error);
  }
};

/**
 * Generic share function for custom text
 */
export const shareText = async (title: string, text: string) => {
  const canShareData = await canShare();
  if (!canShareData) {
    console.warn('Sharing not supported on this platform');
    return;
  }

  try {
    await Share.share({
      title: title,
      text: text,
      dialogTitle: `Share ${title}`,
    });
  } catch (error) {
    console.warn('Share cancelled or failed:', error);
  }
};

/**
 * Share with URL (useful for deep links)
 */
export const shareWithUrl = async (title: string, text: string, url: string) => {
  const canShareData = await canShare();
  if (!canShareData) {
    console.warn('Sharing not supported on this platform');
    return;
  }

  try {
    await Share.share({
      title: title,
      text: text,
      url: url,
      dialogTitle: `Share ${title}`,
    });
  } catch (error) {
    console.warn('Share cancelled or failed:', error);
  }
};
