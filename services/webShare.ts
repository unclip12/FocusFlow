/**
 * Web Share API Service
 * Native sharing on mobile and desktop browsers
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API
 */

export interface ShareData {
    title?: string;
    text?: string;
    url?: string;
    files?: File[];
}

/**
 * Check if Web Share API is supported
 */
export const isWebShareSupported = (): boolean => {
    return typeof navigator !== 'undefined' && 'share' in navigator;
};

/**
 * Check if sharing files is supported
 */
export const canShareFiles = (): boolean => {
    return isWebShareSupported() && 'canShare' in navigator && navigator.canShare !== undefined;
};

/**
 * Share content using native Web Share API
 */
export const shareContent = async (data: ShareData): Promise<boolean> => {
    if (!isWebShareSupported()) {
        console.warn('Web Share API not supported');
        return false;
    }

    try {
        // Check if the data can be shared (especially for files)
        if (data.files && canShareFiles()) {
            const canShare = navigator.canShare && navigator.canShare(data);
            if (!canShare) {
                console.warn('Cannot share these files');
                return false;
            }
        }

        await navigator.share(data);
        console.log('✅ Content shared successfully');
        return true;
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            console.log('ℹ️ Share cancelled by user');
        } else {
            console.error('❌ Error sharing:', error);
        }
        return false;
    }
};

/**
 * Share a focus session
 */
export const shareFocusSession = async (sessionData: {
    duration: number;
    subject: string;
    date: Date;
}): Promise<boolean> => {
    const hours = Math.floor(sessionData.duration / 3600);
    const minutes = Math.floor((sessionData.duration % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return shareContent({
        title: `Focus Session - ${sessionData.subject}`,
        text: `🎯 I just completed a ${timeStr} focus session on ${sessionData.subject}! #FocusFlow #ProductiveStudy`,
        url: window.location.origin,
    });
};

/**
 * Share Knowledge Base entry
 */
export const shareKnowledgeBaseEntry = async (entry: {
    system: string;
    subject: string;
    topic: string;
    pageNumber: number;
}): Promise<boolean> => {
    return shareContent({
        title: `Knowledge Base - ${entry.subject}`,
        text: `📚 ${entry.system} - ${entry.subject}\n📖 ${entry.topic} (Page ${entry.pageNumber})\n\nStudying with FocusFlow!`,
        url: window.location.origin,
    });
};

/**
 * Share study statistics
 */
export const shareStudyStats = async (stats: {
    totalHours: number;
    totalSessions: number;
    streak: number;
}): Promise<boolean> => {
    return shareContent({
        title: 'My Study Stats - FocusFlow',
        text: `📊 My Study Stats:\n⏱️ ${stats.totalHours}h total\n🎯 ${stats.totalSessions} sessions\n🔥 ${stats.streak} day streak\n\n#FocusFlow #StudyStats`,
        url: window.location.origin,
    });
};

/**
 * Fallback share function (copy to clipboard)
 */
export const fallbackShare = async (data: ShareData): Promise<boolean> => {
    const text = `${data.title || ''}\n${data.text || ''}\n${data.url || ''}`;
    try {
        await navigator.clipboard.writeText(text);
        console.log('✅ Copied to clipboard');
        return true;
    } catch (error) {
        console.error('❌ Error copying to clipboard:', error);
        return false;
    }
};
