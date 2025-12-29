
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, ThemeColor, AISettings, RevisionSettings, APP_THEMES, THEME_COLORS, HistoryRecord, NotificationTrigger, DEFAULT_MENU_ORDER } from '../types';
import { MoonIcon, SunIcon, SwatchIcon, Cog6ToothIcon, BellIcon, UserCircleIcon, BrainIcon, DatabaseIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, ArchiveBoxXMarkIcon, CheckCircleIcon, LinkIcon, ExclamationCircleIcon, ArrowUturnLeftIcon, PlusIcon, TrashIcon, LayoutSidebarIcon, ArrowsPointingOutIcon, ListCheckIcon, EyeIcon, EyeSlashIcon, ArrowUpIcon, ArrowDownIcon, InformationCircleIcon, ClockIcon, ArrowPathIcon, XMarkIcon } from './Icons';
import { requestNotificationPermission } from '../services/notificationService';
import { auth, getAISettings, saveAISettings, getRevisionSettings, saveRevisionSettings } from '../services/firebase';
import { exportUserData, importUserData, resetAppData, analyzeBackup, BackupAnalysis } from '../services/dataManagementService';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { checkAnkiConnection } from '../services/ankiService';
import { getHistory, restoreSnapshot, createSnapshot } from '../services/historyService';
import { ChangelogModal } from './ChangelogModal';

interface SettingsViewProps {
    settings: AppSettings;
    onUpdateSettings: (settings: AppSettings) => void;
    secretId?: string;
    displayName: string;
    onUpdateDisplayName: (name: string) => void;
    onRestoreHistory?: (type: string, data: any) => void;
}

const Section: React.FC<{ title: string, icon: React.ElementType, children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700/50 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-white/40 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Icon className="w-5 h-5 text-slate-400" />
                {title}
            </h3>
        </div>
        <div className="p-6 space-y-6">
            {children}
        </div>
    </div>
);

const SettingRow: React.FC<{ label: string, description: string, children: React.ReactNode }> = ({ label, description, children }) => (
     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <p className="font-bold text-slate-800 dark:text-white">{label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="flex-shrink-0">
            {children}
        </div>
    </div>
);

// ... TriggerList code (unchanged, but needs to be included or imported if split) ...
// Assuming TriggerList is small enough to keep inline or already exists in file context.
// For brevity in this response, I will include it to ensure file integrity.
const TriggerList: React.FC<{ 
    category: NotificationTrigger['category'], 
    triggers: NotificationTrigger[], 
    onAdd: (trigger: NotificationTrigger) => void, 
    onRemove: (id: string) => void 
}> = ({ category, triggers, onAdd, onRemove }) => {
    const [offset, setOffset] = useState<number>(15);
    const [timing, setTiming] = useState<'BEFORE' | 'AFTER'>('BEFORE');

    useEffect(() => {
        if (category === 'OVERDUE') setTiming('AFTER');
        else setTiming('BEFORE');
    }, [category]);

    const handleAdd = () => {
        onAdd({
            id: Date.now().toString(),
            category,
            timing,
            offsetMinutes: offset,
            enabled: true
        });
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <div className="flex flex-wrap gap-2 mb-3">
                {triggers.filter(t => t.category === category).map(t => (
                    <div key={t.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>{t.offsetMinutes}m {t.timing === 'BEFORE' ? 'Before' : 'After'}</span>
                        <button onClick={() => onRemove(t.id)} className="text-slate-400 hover:text-red-500"><TrashIcon className="w-3 h-3" /></button>
                    </div>
                ))}
                {triggers.filter(t => t.category === category).length === 0 && <span className="text-xs text-slate-400 italic p-1">No active triggers</span>}
            </div>
            
            <div className="flex gap-2 items-center">
                <input 
                    type="number" 
                    value={offset} 
                    onChange={e => setOffset(Math.max(1, parseInt(e.target.value)))}
                    className="w-16 p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-center"
                />
                <span className="text-xs text-slate-500">min</span>
                <select 
                    value={timing} 
                    onChange={e => setTiming(e.target.value as 'BEFORE' | 'AFTER')}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold"
                >
                    <option value="BEFORE">Before</option>
                    <option value="AFTER">After</option>
                </select>
                <button onClick={handleAdd} className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors">
                    <PlusIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

// --- NEW COMPONENTS FOR RESTORE FLOW ---

const RestorePreviewModal: React.FC<{ 
    analysis: BackupAnalysis | null, 
    onCancel: () => void, 
    onConfirm: () => void 
}> = ({ analysis, onCancel, onConfirm }) => {
    if (!analysis) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 animate-scale-up">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <DatabaseIcon className="w-5 h-5 text-indigo-500" />
                        Backup File Analysis
                    </h3>
                    <button onClick={onCancel}><XMarkIcon className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                </div>
                
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {!analysis.valid ? (
                        <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/50 text-sm font-bold text-center">
                            Invalid Backup File. Missing data structure.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(analysis.counts).map(([key, count]) => (
                                    <div key={key} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500 uppercase">{key}</span>
                                        <span className="text-lg font-black text-slate-700 dark:text-slate-200">{count}</span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="pt-2">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Health Check</p>
                                {analysis.warnings.length > 0 ? (
                                    <ul className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/50 space-y-1">
                                        {analysis.warnings.map((w, i) => (
                                            <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                                                <ExclamationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" /> {w}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-900/50 text-xs text-green-700 dark:text-green-400 flex items-center gap-2 font-bold">
                                        <CheckCircleIcon className="w-4 h-4" /> Data structure looks healthy.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm">Cancel</button>
                    <button 
                        onClick={onConfirm} 
                        disabled={!analysis.valid || analysis.totalItems === 0}
                        className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirm Restore
                    </button>
                </div>
            </div>
        </div>
    );
};

const RestoreResultModal: React.FC<{ 
    isOpen: boolean, 
    status: string, 
    progress: number, 
    logs: string[],
    onClose: () => void 
}> = ({ isOpen, status, progress, logs, onClose }) => {
    if (!isOpen) return null;
    const isComplete = progress === 100;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 animate-scale-up flex flex-col max-h-[80vh]">
                <div className="p-6 text-center border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Restoration Process</h3>
                    
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden mb-2">
                        <div 
                            className={`h-full transition-all duration-300 ease-out ${isComplete ? 'bg-green-500' : 'bg-indigo-500'}`}
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{status}</p>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col p-4 bg-slate-50 dark:bg-slate-950">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Debug Log</p>
                    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-mono text-[10px] text-slate-600 dark:text-slate-300 space-y-1">
                        {logs.map((log, i) => (
                            <div key={i} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 pb-1">{log}</div>
                        ))}
                        {logs.length === 0 && <span className="text-slate-400 italic">Waiting to start...</span>}
                    </div>
                </div>

                {isComplete && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                        <button 
                            onClick={onClose}
                            className="px-8 py-3 rounded-xl bg-green-600 text-white font-bold text-sm shadow-lg hover:bg-green-700 transition-all flex items-center gap-2"
                        >
                            <CheckCircleIcon className="w-5 h-5" /> Done & Reload
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings, secretId, displayName, onUpdateDisplayName }) => {
  const [localName, setLocalName] = useState(displayName);
  const [isLoading, setIsLoading] = useState(true);

  // Restore Flow State
  const [fileToRestore, setFileToRestore] = useState<any>(null);
  const [backupAnalysis, setBackupAnalysis] = useState<BackupAnalysis | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [restoreLogs, setRestoreLogs] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Other State
  const [ankiHostInput, setAnkiHostInput] = useState(settings.ankiHost || 'http://localhost:8765');
  const [ankiPrefixInput, setAnkiPrefixInput] = useState(settings.ankiTagPrefix || 'FA_Page::');
  const [ankiStatus, setAnkiStatus] = useState<'IDLE' | 'CHECKING' | 'OK' | 'FAIL'>('IDLE');
  const [ankiError, setAnkiError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [menuConfig, setMenuConfig] = useState(
      settings.menuConfiguration || DEFAULT_MENU_ORDER.map(id => ({ id, visible: true }))
  );
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  useEffect(() => {
    setLocalName(displayName);
  }, [displayName]);

  useEffect(() => {
      loadConfig();
  }, []);

  const loadConfig = async () => {
      setIsLoading(true);
      const historyLog = await getHistory();
      setHistory(historyLog);
      setIsLoading(false);
  };

  // ... (Menu Handlers same as before) ...
  const handleMoveMenu = (index: number, direction: 'up' | 'down') => {
      const newConfig = [...menuConfig];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= newConfig.length) return;
      
      [newConfig[index], newConfig[swapIndex]] = [newConfig[swapIndex], newConfig[index]];
      setMenuConfig(newConfig);
      onUpdateSettings({ ...settings, menuConfiguration: newConfig });
  };

  const handleToggleMenuVisibility = (id: string) => {
      if (id === 'SETTINGS') return; // Prevent hiding settings
      const newConfig = menuConfig.map(item => 
          item.id === id ? { ...item, visible: !item.visible } : item
      );
      setMenuConfig(newConfig);
      onUpdateSettings({ ...settings, menuConfiguration: newConfig });
  };

  const handleSaveName = () => {
      if (localName !== displayName) {
          onUpdateDisplayName(localName);
      }
  };

  const handleSignOut = async () => {
      if (window.confirm("Are you sure you want to sign out?")) {
          try {
              await auth.signOut();
              window.location.reload();
          } catch (error) {
              console.error("Sign out error", error);
              alert("Unable to sign out. Please check your internet connection.");
          }
      }
  };

  const handleToggleNotification = async () => {
      if (!settings.notifications.enabled) {
          const granted = await requestNotificationPermission();
          if (granted) {
              onUpdateSettings({ ...settings, notifications: { ...settings.notifications, enabled: true } });
          } else {
              alert("Notification permission denied. Please enable it in your browser settings.");
          }
      } else {
          onUpdateSettings({ ...settings, notifications: { ...settings.notifications, enabled: false } });
      }
  };

  const handleAddTrigger = (trigger: NotificationTrigger) => {
      const currentTriggers = settings.notifications.customTriggers || [];
      onUpdateSettings({
          ...settings,
          notifications: {
              ...settings.notifications,
              customTriggers: [...currentTriggers, trigger]
          }
      });
  };

  const handleRemoveTrigger = (id: string) => {
      const currentTriggers = settings.notifications.customTriggers || [];
      onUpdateSettings({
          ...settings,
          notifications: {
              ...settings.notifications,
              customTriggers: currentTriggers.filter(t => t.id !== id)
          }
      });
  };

  const handleBackup = async () => {
      setIsBackingUp(true);
      try {
          await exportUserData();
      } catch (e) {
          alert("Backup failed. Please try again.");
      } finally {
          setIsBackingUp(false);
      }
  };

  // --- NEW RESTORE LOGIC ---

  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const json = JSON.parse(ev.target?.result as string);
              // 1. Analyze
              const analysis = analyzeBackup(json);
              setFileToRestore(json);
              setBackupAnalysis(analysis);
              setShowPreview(true); // Open Preview Modal
          } catch (err) {
              alert("Failed to parse JSON file.");
          }
      };
      reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
      if (!fileToRestore) return;
      
      setShowPreview(false);
      setShowResult(true);
      setRestoreProgress(0);
      setRestoreStatus('Initializing Import...');
      setRestoreLogs(["Starting import process..."]);

      try {
          const result = await importUserData(fileToRestore, (current, total, status) => {
              const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
              setRestoreProgress(percentage);
              setRestoreStatus(`${status} (${current}/${total})`);
          });
          
          setRestoreLogs(prev => [...prev, ...result.logs]);
          setRestoreStatus(result.success ? 'Restoration Complete' : 'Restoration Failed');
          setRestoreProgress(100);

      } catch (e: any) {
          setRestoreStatus('Critical Failure');
          setRestoreLogs(prev => [...prev, `CRITICAL ERROR: ${e.message}`]);
      }
  };

  const handleReloadApp = () => {
      window.location.reload();
  };

  // ---

  const handleReset = async () => {
      await resetAppData();
      setIsResetModalOpen(false);
      alert("App reset complete. Reloading...");
      window.location.reload();
  };

  const handleCheckAnki = async () => {
      setAnkiStatus('CHECKING');
      setAnkiError(null);
      // Save both settings
      onUpdateSettings({ ...settings, ankiHost: ankiHostInput, ankiTagPrefix: ankiPrefixInput });
      
      const result = await checkAnkiConnection({ ...settings, ankiHost: ankiHostInput });
      if (result.success) {
          setAnkiStatus('OK');
      } else {
          setAnkiStatus('FAIL');
          setAnkiError(result.error || 'Unknown error');
      }
  };

  const handleRestoreSnapshot = async (id: string) => {
      if (confirm("Restore this snapshot? Current unsaved progress will be lost.")) {
          setRestoringId(id);
          const success = await restoreSnapshot(id);
          if (success) {
              alert("Restored successfully! Reloading app...");
              window.location.reload();
          } else {
              alert("Failed to restore snapshot. It might have been deleted from cloud.");
          }
          setRestoringId(null);
      }
  };

  const handleCreateManualSnapshot = async () => {
      setCreatingSnapshot(true);
      await createSnapshot("Manual Backup via Settings");
      const historyLog = await getHistory();
      setHistory(historyLog);
      setCreatingSnapshot(false);
  };

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading settings...</div>;

  return (
    <div className="animate-fade-in pb-24 max-w-4xl mx-auto">
        
        {/* MODALS */}
        <RestorePreviewModal 
            analysis={backupAnalysis} 
            onCancel={() => { setShowPreview(false); setFileToRestore(null); }}
            onConfirm={handleConfirmRestore}
        />

        <RestoreResultModal 
            isOpen={showResult}
            status={restoreStatus}
            progress={restoreProgress}
            logs={restoreLogs}
            onClose={handleReloadApp}
        />

        <div className="flex justify-between items-center mb-6 px-2">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h2>
            {secretId && (
                <span className="text-xs font-mono bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                    ID: {secretId}
                </span>
            )}
        </div>

        <div className="space-y-6">
            {/* 1. Profile */}
            <Section title="Profile" icon={UserCircleIcon}>
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Display Name</label>
                        <input 
                            type="text" 
                            value={localName} 
                            onChange={e => setLocalName(e.target.value)}
                            onBlur={handleSaveName}
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                        />
                    </div>
                    <button 
                        onClick={handleSignOut}
                        className="px-6 py-3.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 font-bold rounded-xl transition-colors text-sm shadow-sm border border-slate-200 dark:border-slate-600"
                    >
                        Sign Out
                    </button>
                </div>
            </Section>

            {/* 2. Appearance */}
            <Section title="Appearance" icon={SwatchIcon}>
                <SettingRow label="Dark Mode" description="Switch between light and dark themes">
                    <button 
                        onClick={() => onUpdateSettings({ ...settings, darkMode: !settings.darkMode })}
                        className={`w-14 h-8 rounded-full p-1 transition-colors ${settings.darkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                        <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-300 flex items-center justify-center ${settings.darkMode ? 'translate-x-6' : 'translate-x-0'}`}>
                            {settings.darkMode ? <MoonIcon className="w-3 h-3 text-indigo-600" /> : <SunIcon className="w-4 h-4 text-amber-500" />}
                        </div>
                    </button>
                </SettingRow>

                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">App Theme</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {APP_THEMES.map(theme => (
                            <button
                                key={theme.id}
                                onClick={() => onUpdateSettings({ ...settings, themeId: theme.id })}
                                className={`relative p-1 rounded-xl border-2 transition-all duration-200 group text-left ${settings.themeId === theme.id ? 'border-indigo-500 ring-2 ring-indigo-500/20 scale-[1.02]' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`}
                            >
                                <div 
                                    className="h-16 rounded-lg mb-2 shadow-sm"
                                    style={{ background: settings.darkMode ? theme.darkBgGradient : theme.bgGradient }}
                                ></div>
                                <span className={`text-xs font-bold px-2 block ${settings.themeId === theme.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                    {theme.name}
                                </span>
                                {settings.themeId === theme.id && (
                                    <div className="absolute top-2 right-2 bg-white dark:bg-slate-800 rounded-full p-0.5 shadow-sm">
                                        <CheckCircleIcon className="w-4 h-4 text-indigo-500" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Accent Color</p>
                    <div className="flex flex-wrap gap-3">
                        {THEME_COLORS.map(color => (
                            <button
                                key={color.value}
                                onClick={() => onUpdateSettings({ ...settings, primaryColor: color.value })}
                                className={`w-10 h-10 rounded-full border-2 transition-all transform active:scale-95 ${settings.primaryColor === color.value ? 'border-slate-800 dark:border-white scale-110 shadow-md' : 'border-transparent'}`}
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                            />
                        ))}
                    </div>
                </div>
            </Section>

            {/* 3. Menu & Layout */}
            <Section title="Menu & Layout" icon={LayoutSidebarIcon}>
                <SettingRow label="Desktop Layout" description="Sidebar vs Fullscreen">
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                        <button 
                            onClick={() => onUpdateSettings({ ...settings, desktopLayout: 'sidebar' })}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${settings.desktopLayout === 'sidebar' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                        >
                            Sidebar
                        </button>
                        <button 
                            onClick={() => onUpdateSettings({ ...settings, desktopLayout: 'fullscreen' })}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${settings.desktopLayout === 'fullscreen' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                        >
                            Fullscreen
                        </button>
                    </div>
                </SettingRow>

                <div className="space-y-3">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Customize Menu Items</p>
                    <div className="space-y-2">
                        {menuConfig.map((item, idx) => {
                            const label = item.id.replace(/_/g, ' ');
                            return (
                                <div key={item.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => handleToggleMenuVisibility(item.id)} disabled={item.id === 'SETTINGS'} className={`p-1 rounded ${item.visible ? 'text-green-500 hover:bg-green-50' : 'text-slate-300 hover:bg-slate-100'}`}>
                                            {item.visible ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
                                        </button>
                                        <span className={`text-sm font-bold ${item.visible ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 decoration-slate-300 line-through'}`}>{label}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleMoveMenu(idx, 'up')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-indigo-500 disabled:opacity-30"><ArrowUpIcon className="w-4 h-4" /></button>
                                        <button onClick={() => handleMoveMenu(idx, 'down')} disabled={idx === menuConfig.length - 1} className="p-1 text-slate-400 hover:text-indigo-500 disabled:opacity-30"><ArrowDownIcon className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Section>

            {/* 4. Notifications (Same as before) */}
            <Section title="Notifications" icon={BellIcon}>
                <SettingRow label="Enable Notifications" description="Get alerts for timers and breaks">
                    <button 
                        onClick={handleToggleNotification}
                        className={`w-14 h-8 rounded-full p-1 transition-colors ${settings.notifications.enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                        <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${settings.notifications.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </SettingRow>

                {settings.notifications.enabled && (
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 animate-fade-in">
                        <SettingRow label="Mode" description="Strict mode is more aggressive">
                            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                                <button 
                                    onClick={() => onUpdateSettings({ ...settings, notifications: { ...settings.notifications, mode: 'normal' } })}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${settings.notifications.mode === 'normal' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                                >
                                    Normal
                                </button>
                                <button 
                                    onClick={() => onUpdateSettings({ ...settings, notifications: { ...settings.notifications, mode: 'strict' } })}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${settings.notifications.mode === 'strict' ? 'bg-white dark:bg-slate-700 shadow-sm text-red-600 dark:text-red-400' : 'text-slate-500'}`}
                                >
                                    Strict
                                </button>
                            </div>
                        </SettingRow>

                        <div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Custom Triggers</p>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Block Start</p>
                                    <TriggerList 
                                        category="BLOCK_START" 
                                        triggers={settings.notifications.customTriggers || []} 
                                        onAdd={handleAddTrigger} 
                                        onRemove={handleRemoveTrigger} 
                                    />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Block End</p>
                                    <TriggerList 
                                        category="BLOCK_END" 
                                        triggers={settings.notifications.customTriggers || []} 
                                        onAdd={handleAddTrigger} 
                                        onRemove={handleRemoveTrigger} 
                                    />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Overdue Tasks</p>
                                    <TriggerList 
                                        category="OVERDUE" 
                                        triggers={settings.notifications.customTriggers || []} 
                                        onAdd={handleAddTrigger} 
                                        onRemove={handleRemoveTrigger} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Section>

            {/* 5. Cloud Time Machine */}
            <Section title="Cloud Time Machine" icon={ClockIcon}>
                <div className="space-y-4">
                    <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
                        <div className="flex items-center gap-2 font-bold mb-2">
                            <ExclamationCircleIcon className="w-5 h-5" /> Cloud Snapshots
                        </div>
                        <p className="mb-2">
                            Every major action (AI schedule generation, KB updates) creates a cloud restore point. 
                            You can revert to any previous state. This data is synced to your account.
                        </p>
                    </div>

                    <div className="flex justify-end">
                        <button 
                            onClick={handleCreateManualSnapshot}
                            disabled={creatingSnapshot}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg border border-indigo-100 dark:border-indigo-800 flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50"
                        >
                            {creatingSnapshot ? <ArrowPathIcon className="w-3 h-3 animate-spin"/> : <PlusIcon className="w-3 h-3"/>}
                            Create Manual Backup
                        </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar border rounded-xl p-2 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
                        {history.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm py-4">No snapshots found in cloud.</p>
                        ) : (
                            history.map(record => (
                                <div key={record.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <div>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{record.description}</p>
                                        <p className="text-xs text-slate-400 font-mono">{new Date(record.timestamp).toLocaleString()}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleRestoreSnapshot(record.id)}
                                        disabled={restoringId === record.id}
                                        className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1"
                                    >
                                        {restoringId === record.id ? <ArrowPathIcon className="w-3 h-3 animate-spin"/> : <ArrowUturnLeftIcon className="w-3 h-3" />}
                                        Restore
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Section>

            {/* 6. Anki Integration */}
            <Section title="Anki Integration" icon={LinkIcon}>
                <div className="space-y-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">AnkiConnect URL</label>
                                <input 
                                    type="text" 
                                    value={ankiHostInput}
                                    onChange={e => setAnkiHostInput(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-mono"
                                    placeholder="http://localhost:8765"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tag Prefix</label>
                                <input 
                                    type="text" 
                                    value={ankiPrefixInput}
                                    onChange={e => setAnkiPrefixInput(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-mono"
                                    placeholder="FA_Page::"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button 
                                onClick={handleCheckAnki}
                                disabled={ankiStatus === 'CHECKING'}
                                className="px-4 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50 text-sm flex items-center gap-2"
                            >
                                {ankiStatus === 'CHECKING' ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                                Test & Save
                            </button>
                        </div>
                    </div>
                    {ankiStatus === 'OK' && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm font-bold flex items-center gap-2">
                            <CheckCircleIcon className="w-5 h-5" /> Connected Successfully
                        </div>
                    )}
                    {ankiStatus === 'FAIL' && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
                            <p className="font-bold flex items-center gap-2 mb-1"><ExclamationCircleIcon className="w-5 h-5" /> Connection Failed</p>
                            <p className="text-xs opacity-90">{ankiError}</p>
                        </div>
                    )}
                </div>
            </Section>

            {/* 7. Data Management (UPDATED) */}
            <Section title="Data Management" icon={DatabaseIcon}>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 -mt-2">
                    Use these options to migrate your data.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button 
                        onClick={handleBackup} 
                        disabled={isBackingUp}
                        className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 flex flex-col items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    >
                        <ArrowDownTrayIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{isBackingUp ? 'Exporting...' : 'Backup Data'}</span>
                    </button>

                    <label className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 flex flex-col items-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer relative overflow-hidden" 
                        onClick={(e) => {
                            // Reset value on click so onChange fires even if same file picked
                            if(fileInputRef.current) fileInputRef.current.value = '';
                        }}>
                        <ArrowUpTrayIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Restore Data</span>
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept=".json" 
                            onChange={handleRestoreFileSelect} 
                            className="hidden" 
                        />
                    </label>

                    <button 
                        onClick={() => setIsResetModalOpen(true)}
                        className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 flex flex-col items-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    >
                        <ArchiveBoxXMarkIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-bold text-red-700 dark:text-red-300">Reset App</span>
                    </button>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-4 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                    <strong>Note:</strong> Backup includes <strong>FMGE logs</strong>, <strong>Knowledge Base</strong>, <strong>Schedules</strong>, and <strong>AI Memory</strong>.
                </p>
            </Section>

            <div className="text-center pt-8 pb-4">
                <button onClick={() => setIsChangelogOpen(true)} className="text-xs text-slate-400 hover:text-indigo-500 underline flex items-center justify-center gap-1 mx-auto">
                    <InformationCircleIcon className="w-3 h-3" /> View Changelog & Version
                </button>
            </div>

            <DeleteConfirmationModal 
                isOpen={isResetModalOpen} 
                onClose={() => setIsResetModalOpen(false)} 
                onConfirm={handleReset}
                title="Factory Reset App?"
                message="This will wipe ALL data including study plans, knowledge base, FMGE logs, and settings. This action is irreversible unless you have a backup."
            />

            <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
        </div>
    </div>
  );
};
