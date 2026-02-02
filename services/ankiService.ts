
import { AppSettings } from '../types';

// Default port for AnkiConnect
const DEFAULT_HOST = 'http://localhost:8765';

export interface AnkiStats {
    totalCards: number;
    mature: number;
    young: number;
    learning: number;
    new: number;
    suspended: number;
}

const fetchAnki = async (action: string, params: any = {}, host: string = DEFAULT_HOST) => {
    try {
        // Ensure no trailing slash
        const cleanHost = host.endsWith('/') ? host.slice(0, -1) : host;
        
        const response = await fetch(cleanHost, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action, version: 6, params }),
        });
        
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        return result.result;
    } catch (error) {
        console.error(`AnkiConnect Error (${action}):`, error);
        throw error;
    }
};

export const checkAnkiConnection = async (settings: AppSettings): Promise<{ success: boolean, error?: string }> => {
    const host = settings.ankiHost || DEFAULT_HOST;
    
    try {
        await fetchAnki('version', {}, host);
        return { success: true };
    } catch (e: any) {
        let msg = e.message || 'Unknown error';
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isHttps = window.location.protocol === 'https:';
        const isLocalHostTarget = host.includes('192.168.') || host.includes('10.') || host.includes('172.');

        // Safari often returns "Load failed" or "NetworkError" for blocked requests
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
            
            if (isIOS) {
                if (isHttps && isLocalHostTarget) {
                     msg = "iOS Security Block: Safari will NOT allow an HTTPS app to talk to a local HTTP server (Mixed Content). You must access FocusFlow via HTTP (not HTTPS) or tunnel Anki.";
                } else {
                     msg = "Connection Refused on iOS. 1) Check Windows Firewall (Port 8765). 2) Ensure Laptop & iPad are on same Wi-Fi. 3) Web Apps do NOT prompt for Local Network Access - they just fail if blocked.";
                }
            } 
            else if (isHttps && host.startsWith('http:')) {
                msg = 'Mixed Content Error: Browser blocked HTTP Anki from HTTPS App. You need to use FocusFlow via HTTP.';
            } else {
                msg = 'Connection Timed Out. 1) Is Anki Open? 2) Is AnkiConnect installed? 3) Is Windows Firewall blocking port 8765?';
            }
        }
        return { success: false, error: msg };
    }
};

export const getAnkiCardStats = async (settings: AppSettings, tag: string): Promise<AnkiStats | null> => {
    if (!tag) return null;
    const host = settings.ankiHost || DEFAULT_HOST;
    
    try {
        // 1. Find cards by tag
        // 'tag:MyTag'
        const query = `${tag}`; 
        const cardIds = await fetchAnki('findCards', { query }, host);
        
        if (!cardIds || cardIds.length === 0) {
            return { totalCards: 0, mature: 0, young: 0, learning: 0, new: 0, suspended: 0 };
        }

        // 2. Get card details
        const cardsInfo = await fetchAnki('cardsInfo', { cards: cardIds }, host);
        
        let mature = 0;
        let young = 0;
        let learning = 0;
        let newCount = 0;
        let suspended = 0;

        cardsInfo.forEach((card: any) => {
            // Queue types: 0=new, 1=learning, 2=review, 3=relearning
            // Interval > 21 days often considered mature
            if (card.queue === -1) {
                suspended++;
            } else if (card.queue === 0) {
                newCount++;
            } else if (card.queue === 1 || card.queue === 3) {
                learning++;
            } else if (card.queue === 2) {
                if (card.interval >= 21) {
                    mature++;
                } else {
                    young++;
                }
            }
        });

        return {
            totalCards: cardIds.length,
            mature,
            young,
            learning,
            new: newCount,
            suspended
        };

    } catch (e) {
        console.error("Failed to get Anki stats", e);
        return null;
    }
};

export const openAnkiBrowser = async (settings: AppSettings, query: string) => {
    const host = settings.ankiHost || DEFAULT_HOST;
    try {
        await fetchAnki('guiBrowse', { query }, host);
    } catch (e) {
        console.error("Failed to open Anki browser", e);
        alert("Could not open Anki. Ensure Anki is running and AnkiConnect is configured.");
    }
};

export const syncAnkiToDb = async (settings: AppSettings, kbEntry: any, updateKb: (entry: any) => void) => {
    if (!kbEntry.ankiTag) return;
    
    try {
        const stats = await getAnkiCardStats(settings, kbEntry.ankiTag);
        if (stats) {
            const totalDone = stats.mature + stats.young + stats.learning; // actively studying or learned
            const total = stats.totalCards;
            
            const updatedEntry = {
                ...kbEntry,
                ankiTotal: total,
                ankiCovered: totalDone // Using 'Covered' as engaged cards
            };
            updateKb(updatedEntry);
            return stats;
        }
    } catch (e) {
        console.error("Sync failed", e);
    }
    return null;
};

// --- NEW: DECK MOVEMENT LOGIC ---

export const createDeck = async (settings: AppSettings, deckName: string): Promise<boolean> => {
    const host = settings.ankiHost || DEFAULT_HOST;
    try {
        await fetchAnki('createDeck', { deck: deckName }, host);
        return true;
    } catch (e) {
        console.error("Failed to create deck", e);
        return false;
    }
};

export const moveCardsToDeck = async (settings: AppSettings, cardIds: number[], deckName: string): Promise<boolean> => {
    const host = settings.ankiHost || DEFAULT_HOST;
    try {
        await fetchAnki('changeDeck', { cards: cardIds, deck: deckName }, host);
        return true;
    } catch (e) {
        console.error("Failed to move cards", e);
        return false;
    }
};

export const createStudySession = async (settings: AppSettings, tag: string, pageNumber: string): Promise<{ success: boolean, count: number, error?: string }> => {
    const host = settings.ankiHost || DEFAULT_HOST;
    // Dynamically name the deck based on the page number
    const DECK_NAME = `FocusFlow::${pageNumber}`;

    try {
        // 1. Find Cards
        const cardIds = await fetchAnki('findCards', { query: tag }, host);
        
        if (!cardIds || cardIds.length === 0) {
            return { success: false, count: 0, error: "No cards found with this tag." };
        }

        // 2. Create Deck (idempotent)
        await createDeck(settings, DECK_NAME);

        // 3. Move Cards
        await moveCardsToDeck(settings, cardIds, DECK_NAME);

        // 4. Open Deck Overview
        await fetchAnki('guiDeckOverview', { name: DECK_NAME }, host);

        return { success: true, count: cardIds.length };

    } catch (e: any) {
        console.error("Create study session failed", e);
        return { success: false, count: 0, error: e.message || "Anki connection failed" };
    }
};
