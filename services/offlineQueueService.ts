import { isOnline, onNetworkChange } from './networkService';

/**
 * Offline Queue Service
 * Queues Firebase write operations when offline and retries when connection returns
 */

interface QueuedOperation {
    id: string;
    operation: () => Promise<any>;
    timestamp: number;
    retryCount: number;
    description: string;
}

const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 2000; // 2 seconds

let queue: QueuedOperation[] = [];
let isProcessing = false;
let networkUnsubscribe: (() => void) | null = null;

/**
 * Initialize offline queue service
 */
export function initOfflineQueue(): void {
    // Load queue from localStorage (persist across app restarts)
    loadQueueFromStorage();

    // Listen for network changes
    networkUnsubscribe = onNetworkChange((online) => {
        if (online) {
            console.log('Network restored, processing queue...');
            processQueue();
        }
    });

    // Try to process queue on init (in case we're already online)
    processQueue();
}

/**
 * Add operation to queue
 */
export function queueOperation(
    operation: () => Promise<any>,
    description: string = 'Unknown operation'
): Promise<void> {
    return new Promise((resolve, reject) => {
        // Check if online first
        isOnline().then(online => {
            if (online) {
                // Execute immediately if online
                operation()
                    .then(resolve)
                    .catch(err => {
                        console.warn('Operation failed but online, queueing:', err);
                        addToQueue(operation, description);
                        resolve(); // Don't reject, operation is queued
                    });
            } else {
                // Queue if offline
                addToQueue(operation, description);
                resolve(); // Operation queued successfully
            }
        });
    });
}

/**
 * Add operation to internal queue
 */
function addToQueue(operation: () => Promise<any>, description: string): void {
    // Check queue size limit
    if (queue.length >= MAX_QUEUE_SIZE) {
        console.warn('Queue full, removing oldest operation');
        queue.shift(); // Remove oldest
    }

    const queuedOp: QueuedOperation = {
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        operation,
        timestamp: Date.now(),
        retryCount: 0,
        description
    };

    queue.push(queuedOp);
    saveQueueToStorage();
    
    console.log(`Queued operation: ${description} (${queue.length} in queue)`);
}

/**
 * Process all queued operations
 */
async function processQueue(): Promise<void> {
    if (isProcessing || queue.length === 0) return;

    const online = await isOnline();
    if (!online) return;

    isProcessing = true;
    console.log(`Processing ${queue.length} queued operations...`);

    const operationsToProcess = [...queue];
    queue = [];

    for (const op of operationsToProcess) {
        try {
            await op.operation();
            console.log(`✓ Processed: ${op.description}`);
        } catch (err) {
            console.error(`✗ Failed: ${op.description}`, err);
            
            // Retry logic
            if (op.retryCount < MAX_RETRY_COUNT) {
                op.retryCount++;
                queue.push(op); // Re-queue for retry
                console.log(`Retry ${op.retryCount}/${MAX_RETRY_COUNT}: ${op.description}`);
                
                // Wait before next retry
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            } else {
                console.error(`Max retries exceeded: ${op.description}`);
            }
        }
    }

    saveQueueToStorage();
    isProcessing = false;

    // If more items were added during processing, process again
    if (queue.length > 0) {
        setTimeout(() => processQueue(), RETRY_DELAY);
    }
}

/**
 * Get queue size
 */
export function getQueueSize(): number {
    return queue.length;
}

/**
 * Clear all queued operations
 */
export function clearQueue(): void {
    queue = [];
    saveQueueToStorage();
    console.log('Queue cleared');
}

/**
 * Get queue status
 */
export function getQueueStatus(): {
    size: number;
    operations: Array<{ description: string; timestamp: number; retryCount: number }>;
} {
    return {
        size: queue.length,
        operations: queue.map(op => ({
            description: op.description,
            timestamp: op.timestamp,
            retryCount: op.retryCount
        }))
    };
}

/**
 * Save queue to localStorage
 */
function saveQueueToStorage(): void {
    try {
        // We can't serialize functions, so we only save metadata
        const metadata = queue.map(op => ({
            id: op.id,
            description: op.description,
            timestamp: op.timestamp,
            retryCount: op.retryCount
        }));
        localStorage.setItem('focusflow_offline_queue', JSON.stringify(metadata));
    } catch (err) {
        console.error('Failed to save queue to storage:', err);
    }
}

/**
 * Load queue from localStorage
 * Note: We can only restore metadata, not the actual operations
 */
function loadQueueFromStorage(): void {
    try {
        const stored = localStorage.getItem('focusflow_offline_queue');
        if (stored) {
            const metadata = JSON.parse(stored);
            console.log(`Loaded ${metadata.length} queued operation metadata from storage`);
            // We can't restore the actual operations, but we keep the metadata for display
        }
    } catch (err) {
        console.error('Failed to load queue from storage:', err);
    }
}

/**
 * Clean up offline queue service
 */
export function cleanupOfflineQueue(): void {
    if (networkUnsubscribe) {
        networkUnsubscribe();
        networkUnsubscribe = null;
    }
    queue = [];
    isProcessing = false;
}
