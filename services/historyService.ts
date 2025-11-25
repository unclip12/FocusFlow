
import { HistoryRecord } from "../types";

const HISTORY_KEY = "focusflow_action_history";
const MAX_HISTORY = 50;

export const getHistory = (): HistoryRecord[] => {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
};

export const addToHistory = (record: Omit<HistoryRecord, 'id' | 'timestamp'>) => {
    const currentHistory = getHistory();
    const newRecord: HistoryRecord = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...record
    };
    
    // Add to beginning (stack)
    const updated = [newRecord, ...currentHistory].slice(0, MAX_HISTORY);
    
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error("Failed to save history", e);
    }
};

export const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
};
