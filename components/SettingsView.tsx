

import React, { useState, useEffect } from 'react';
import { AppSettings, ThemeColor, AISettings, RevisionSettings, APP_THEMES, HistoryRecord, NotificationTrigger } from '../types';
import { MoonIcon, SunIcon, SwatchIcon, Cog6ToothIcon, BellIcon, MoonIcon as SleepIcon, UserCircleIcon, BrainIcon, DatabaseIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, ArchiveBoxXMarkIcon, CheckCircleIcon, LinkIcon, ExclamationCircleIcon, ArrowUturnLeftIcon, PlusIcon, TrashIcon, ClockIcon } from './Icons';
import { requestNotificationPermission } from '../services/notificationService';
import { auth, getAISettings, saveAISettings, getRevisionSettings, saveRevisionSettings } from '../services/firebase';
import { exportUserData, importUserData, resetAppData } from '../services/dataManagementService';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { checkAnkiConnection } from '../services/ankiService';
import { getHistory } from '../services/historyService';

interface SettingsViewProps {
    settings: AppSettings;
    onUpdateSettings: (settings: AppSettings) => void;
    secretId?: string;
    displayName: string;
    onUpdateDisplayName: (name: string) => void;
    onRestoreHistory?: (type: string, data: any) => void; // NEW
}

const COLORS: { name: string, value: ThemeColor, hex: string, rgb: string }[] = [
    { name: 'Indigo', value: 'indigo', hex: '#4f46e5', rgb: '79 70 229' },
    { name: 'Emerald', value: 'emerald', hex: '#10b981', rgb: '16 185 129' },
    { name: 'Rose', value: 'rose', hex: '#f43f5e', rgb: '244 63 94' },
    { name: 'Amber', value: 'amber', hex: '#f59e0b', rgb: '245 158 11' },
    { name: 'Sky', value: 'sky', hex: '#0ea5e9', rgb: '14 165 233' },
    { name: 'Violet', value: 'violet', hex: '#8b5cf6', rgb: '139 92 246' },
];

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

const TriggerList: React.FC<{ 
    category: NotificationTrigger['category'], 
    triggers: NotificationTrigger[], 
    onAdd: (trigger: NotificationTrigger) => void, 
    onRemove: (id: string) => void 
}> = ({ category, triggers, onAdd, onRemove }) => {
    const [offset, setOffset] = useState<number>(15);
    const [timing, setTiming] = useState<'BEFORE' | 'AFTER'>('BEFORE');

    // Default timing logic per category
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

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings, secretId, displayName, onUpdateDisplayName, onRestoreHistory }) => {
  const [localName, setLocalName] = useState(displayName);
  
  // New AI and Revision state
  const [aiSettings, setAiSettings] = useState<AISettings>({
      personalityMode: 'balanced',
      talkStyle: 'teaching',
      disciplineLevel: 3,
      memoryPermissions: {
          canReadKnowledgeBase: true,
          canReadTimeLogs: true,
          canReadInfoFiles: true,
      }
  });
  const [revisionSettings, setRevisionSettings] = useState<RevisionSettings>({
      mode: 'balanced',
      targetCount: 7,
      carryForwardRule: 'next_block'
  });
  const [isLoading, setIsLoading] = useState(true);

  // Data Management State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Anki State
  const [ankiHostInput, setAnkiHostInput] = useState(settings.ankiHost || 'http://localhost:8765');
  const [ankiStatus, setAnkiStatus] = useState<'IDLE' | 'CHECKING' | 'OK' | 'FAIL'>('IDLE');
  const [ankiError, setAnkiError] = useState<string | null>(null);
  const [showAnkiHelp, setShowAnkiHelp] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    setLocalName(displayName);
  }, [displayName]);

  useEffect(() => {
      const loadConfig = async () => {
          setIsLoading(true);
          const [aiData, revData] = await Promise.all([
              getAISettings(),
              getRevisionSettings()
          ]);
          if (aiData) setAiSettings(aiData);
          if (revData) setRevisionSettings(revData);
          
          setHistory(getHistory());
          
          setIsLoading(false);
      };
      loadConfig();
  }, []);

  const handleNameSave = () => {
    if (localName.trim() !== displayName) {
      onUpdateDisplayName(localName.trim());
    }
  };
  
  const handleThemeSelect = (themeId: string) => {
      onUpdateSettings({ ...settings, themeId: themeId });
  };

  const handleColorChange = (color: ThemeColor) => {
      const colorData = COLORS.find(c => c.value === color);
      if (colorData) {
          document.documentElement.style.setProperty('--color-primary', colorData.rgb);
      }
      onUpdateSettings({ ...settings, primaryColor: color });
  };

  useEffect(() => {
    const colorData = COLORS.find(c => c.value === settings.primaryColor);
    if (colorData) {
        document.documentElement.style.setProperty('--color-primary', colorData.rgb);
    }
  }, [settings.primaryColor]);

  const handleSaveAiSettings = async (newAi: AISettings) => {
      setAiSettings(newAi);
      await saveAISettings(newAi);
  };

  const handleSaveRevisionSettings = async (newRev: RevisionSettings) => {
      setRevisionSettings(newRev);
      await saveRevisionSettings(newRev);
  };

  const handleExport = async () => {
      setIsBackingUp(true);
      try {
          await exportUserData();
      } catch (e) {
          alert("Backup failed.");
      }
      setIsBackingUp(false);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          setIsRestoring(true);
          try {
              const reader = new FileReader();
              reader.onload = async (ev) => {
                  const json = JSON.parse(ev.target?.result as string);
                  await importUserData(json);
                  alert("Data restored successfully. Reloading...");
                  window.location.reload();
              };
              reader.readAsText(e.target.files[0]);
          } catch (err) {
              alert("Import failed.");
              setIsRestoring(false);
          }
      }
  };

  const handleReset = async () => {
      await resetAppData();
      setIsResetModalOpen(false);
      alert("App reset complete. Reloading...");
      window.location.reload();
  };

  const checkAnki = async () => {
      setAnkiStatus('CHECKING');
      setAnkiError(null);
      const res = await checkAnkiConnection({ ...settings, ankiHost: ankiHostInput });
      if (res.success) {
          setAnkiStatus('OK');
          onUpdateSettings({ ...settings, ankiHost: ankiHostInput });
      } else {
          setAnkiStatus('FAIL');
          setAnkiError(res.error || 'Failed to connect');
      }
  };

  // --- NOTIFICATION HANDLERS ---
  const handleAddTrigger = (trigger: NotificationTrigger) => {
      const newTriggers = [...(settings.notifications.customTriggers || []), trigger];
      onUpdateSettings({
          ...settings,
          notifications: { ...settings.notifications, customTriggers: newTriggers }
      });
  };

  const handleRemoveTrigger = (id: string) => {
      const newTriggers = (settings.notifications.customTriggers || []).filter(t => t.id !== id);
      onUpdateSettings({
          ...settings,
          notifications: { ...settings.notifications, customTriggers: newTriggers }
      });
  };

  const ensureDefaultTriggers = () => {
      if (!settings.notifications.customTriggers || settings.notifications.customTriggers.length === 0) {
          const defaults: NotificationTrigger[] = [
              { id: 'def-1', category: 'FIRST_BLOCK', timing: 'BEFORE', offsetMinutes: 30, enabled: true },
              { id: 'def-2', category: 'BLOCK_START', timing: 'BEFORE', offsetMinutes: 1, enabled: true },
              { id: 'def-3', category: 'BLOCK_END', timing: 'BEFORE', offsetMinutes: 1, enabled: true },
              { id: 'def-4', category: 'OVERDUE', timing: 'AFTER', offsetMinutes: 5, enabled: true },
          ];
          onUpdateSettings({
              ...settings,
              notifications: { ...settings.notifications, customTriggers: defaults }
          });
      }
  };

  useEffect(() => {
      ensureDefaultTriggers();
  }, []);

  return (
      <div className="animate-fade-in space-y-8 pb-20">
          <DeleteConfirmationModal 
              isOpen={isResetModalOpen}
              onClose={() => setIsResetModalOpen(false)}
              onConfirm={handleReset}
              title="Factory Reset?"
              message="This will wipe all study data, logs, and plans. This cannot be undone."
          />

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-slate-200/50 dark:bg-slate-700/50 rounded-xl text-slate-600 dark:text-slate-300">
                  <Cog6ToothIcon className="w-6 h-6" />
              </div>
              <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Customize your experience</p>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* LEFT COLUMN */}
              <div className="space-y-8">
                  
                  {/* Notifications */}
                  <Section title="Notifications" icon={BellIcon}>
                      <SettingRow label="Enable Notifications" description="Allow push alerts">
                          <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                              <input 
                                  type="checkbox" 
                                  name="toggle" 
                                  id="notif-toggle" 
                                  checked={settings.notifications.enabled}
                                  onChange={() => {
                                      const isEnabled = !settings.notifications.enabled;
                                      onUpdateSettings({ ...settings, notifications: { ...settings.notifications, enabled: isEnabled } });
                                      if (isEnabled) requestNotificationPermission();
                                  }}
                                  className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-full"
                                  style={{ borderColor: settings.notifications.enabled ? '#6366f1' : '#e2e8f0' }}
                              />
                              <label htmlFor="notif-toggle" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${settings.notifications.enabled ? 'bg-indigo-500' : 'bg-slate-300'}`}></label>
                          </div>
                      </SettingRow>

                      {settings.notifications.enabled && (
                          <>
                              <SettingRow label="First Block of Day" description="Get ready before you start">
                                  <div className="w-full sm:w-64">
                                      <TriggerList 
                                          category="FIRST_BLOCK" 
                                          triggers={settings.notifications.customTriggers || []} 
                                          onAdd={handleAddTrigger} 
                                          onRemove={handleRemoveTrigger} 
                                      />
                                  </div>
                              </SettingRow>

                              <SettingRow label="Upcoming & Ongoing" description="Alerts for block start/end">
                                  <div className="w-full sm:w-64 space-y-2">
                                      <div>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Before Start</p>
                                          <TriggerList 
                                              category="BLOCK_START" 
                                              triggers={settings.notifications.customTriggers || []} 
                                              onAdd={handleAddTrigger} 
                                              onRemove={handleRemoveTrigger} 
                                          />
                                      </div>
                                      <div>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Before End</p>
                                          <TriggerList 
                                              category="BLOCK_END" 
                                              triggers={settings.notifications.customTriggers || []} 
                                              onAdd={handleAddTrigger} 
                                              onRemove={handleRemoveTrigger} 
                                          />
                                      </div>
                                  </div>
                              </SettingRow>

                              <SettingRow label="Accountability" description="Nagging if tasks aren't marked finished">
                                  <div className="w-full sm:w-64">
                                      <TriggerList 
                                          category="OVERDUE" 
                                          triggers={settings.notifications.customTriggers || []} 
                                          onAdd={handleAddTrigger} 
                                          onRemove={handleRemoveTrigger} 
                                      />
                                  </div>
                              </SettingRow>
                          </>
                      )}
                  </Section>

                  {/* Profile */}
                  <Section title="Profile" icon={UserCircleIcon}>
                      <SettingRow label="Display Name" description="How the AI addresses you">
                          <input 
                              type="text" 
                              value={localName}
                              onChange={e => setLocalName(e.target.value)}
                              onBlur={handleNameSave}
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                          />
                      </SettingRow>
                      <SettingRow label="Secret ID" description="Your login key (Keep safe!)">
                          <div className="font-mono bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg text-sm select-all">
                              {secretId || '...'}
                          </div>
                      </SettingRow>
                  </Section>

                  {/* Appearance */}
                  <Section title="Appearance" icon={SwatchIcon}>
                      <SettingRow label="Theme Mode" description="Light or Dark interface">
                          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                              <button 
                                  onClick={() => onUpdateSettings({ ...settings, darkMode: false })}
                                  className={`p-2 rounded-md transition-all ${!settings.darkMode ? 'bg-white shadow text-amber-500' : 'text-slate-400'}`}
                              >
                                  <SunIcon className="w-5 h-5" />
                              </button>
                              <button 
                                  onClick={() => onUpdateSettings({ ...settings, darkMode: true })}
                                  className={`p-2 rounded-md transition-all ${settings.darkMode ? 'bg-slate-700 shadow text-indigo-400' : 'text-slate-400'}`}
                              >
                                  <MoonIcon className="w-5 h-5" />
                              </button>
                          </div>
                      </SettingRow>
                      
                      <SettingRow label="Accent Color" description="Primary brand color">
                          <div className="flex gap-2">
                              {COLORS.map(c => (
                                  <button
                                      key={c.value}
                                      onClick={() => handleColorChange(c.value)}
                                      className={`w-6 h-6 rounded-full transition-transform ${settings.primaryColor === c.value ? 'scale-125 ring-2 ring-offset-2 dark:ring-offset-slate-800 ring-slate-400' : ''}`}
                                      style={{ backgroundColor: c.hex }}
                                      title={c.name}
                                  />
                              ))}
                          </div>
                      </SettingRow>

                      <div>
                          <p className="font-bold text-slate-800 dark:text-white mb-3">App Theme</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {APP_THEMES.map(theme => (
                                  <button
                                      key={theme.id}
                                      onClick={() => handleThemeSelect(theme.id)}
                                      className={`p-2 rounded-xl border text-xs font-bold text-left transition-all ${settings.themeId === theme.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                      style={{ background: theme.bgGradient }}
                                  >
                                      <span className={theme.isDark ? 'text-white' : 'text-slate-800'}>{theme.name}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                  </Section>

                  {/* AI Config */}
                  <Section title="AI Personality" icon={BrainIcon}>
                      <SettingRow label="Mentor Mode" description="Attitude of your AI coach">
                          <select 
                              value={aiSettings.personalityMode}
                              onChange={(e) => handleSaveAiSettings({...aiSettings, personalityMode: e.target.value as any})}
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                          >
                              <option value="strict">Strict (C-Mode)</option>
                              <option value="balanced">Balanced</option>
                              <option value="calm">Calm & Gentle</option>
                          </select>
                      </SettingRow>
                      <SettingRow label="Permissions" description="Allow AI to read data">
                          <div className="space-y-2">
                              <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={aiSettings.memoryPermissions?.canReadKnowledgeBase} onChange={e => handleSaveAiSettings({...aiSettings, memoryPermissions: {...aiSettings.memoryPermissions!, canReadKnowledgeBase: e.target.checked}})} />
                                  Read Knowledge Base
                              </label>
                              <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={aiSettings.memoryPermissions?.canReadInfoFiles} onChange={e => handleSaveAiSettings({...aiSettings, memoryPermissions: {...aiSettings.memoryPermissions!, canReadInfoFiles: e.target.checked}})} />
                                  Read Info Files
                              </label>
                          </div>
                      </SettingRow>
                  </Section>

              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-8">
                  
                  {/* Revision Strategy */}
                  <Section title="Revision Strategy" icon={ArrowUturnLeftIcon}>
                      <SettingRow label="SRS Algorithm" description="Spacing aggression">
                          <select 
                              value={revisionSettings.mode}
                              onChange={(e) => handleSaveRevisionSettings({...revisionSettings, mode: e.target.value as any})}
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                          >
                              <option value="fast">Fast (Cramming)</option>
                              <option value="balanced">Balanced</option>
                              <option value="deep">Deep Retention</option>
                          </select>
                      </SettingRow>
                      <SettingRow label="Daily Target" description="Max revisions per day">
                          <input 
                              type="number" 
                              value={revisionSettings.targetCount} 
                              onChange={(e) => handleSaveRevisionSettings({...revisionSettings, targetCount: parseInt(e.target.value)})}
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm w-20"
                          />
                      </SettingRow>
                  </Section>

                  {/* Anki Integration */}
                  <Section title="Anki Connect" icon={LinkIcon}>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Connect to local Anki app via AnkiConnect plugin (localhost:8765).</p>
                      <div className="flex gap-2">
                          <input 
                              type="text" 
                              value={ankiHostInput}
                              onChange={e => setAnkiHostInput(e.target.value)}
                              className="flex-1 p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                              placeholder="http://localhost:8765"
                          />
                          <button onClick={checkAnki} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold">
                              Test
                          </button>
                      </div>
                      {ankiStatus === 'OK' && <p className="text-xs text-green-500 mt-2 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3"/> Connected to Anki</p>}
                      {ankiStatus === 'FAIL' && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><ExclamationCircleIcon className="w-3 h-3"/> {ankiError}</p>}
                  </Section>

                  {/* Data Management */}
                  <Section title="Data & Backup" icon={DatabaseIcon}>
                      <div className="grid grid-cols-2 gap-4">
                          <button onClick={handleExport} disabled={isBackingUp} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-bold text-slate-700 dark:text-slate-200">
                              <ArrowDownTrayIcon className="w-4 h-4" /> 
                              {isBackingUp ? 'Backing up...' : 'Backup Data'}
                          </button>
                          <label className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                              <ArrowUpTrayIcon className="w-4 h-4" /> 
                              {isRestoring ? 'Restoring...' : 'Restore Data'}
                              <input type="file" accept=".json" onChange={handleFileImport} className="hidden" disabled={isRestoring} />
                          </label>
                      </div>
                      <button onClick={() => setIsResetModalOpen(true)} className="w-full mt-4 p-3 rounded-xl border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-bold flex items-center justify-center gap-2">
                          <ArchiveBoxXMarkIcon className="w-4 h-4" /> Factory Reset App
                      </button>
                  </Section>

                  {/* History (Undo) */}
                  {history.length > 0 && onRestoreHistory && (
                      <Section title="Recent Actions (Undo)" icon={ArrowUturnLeftIcon}>
                          <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                              {history.map(item => (
                                  <div key={item.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                      <div className="text-xs">
                                          <p className="font-bold text-slate-700 dark:text-slate-300">{item.description}</p>
                                          <p className="text-[10px] text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</p>
                                      </div>
                                      <button 
                                          onClick={() => onRestoreHistory(item.type, item.snapshot)}
                                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                      >
                                          Restore
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </Section>
                  )}

              </div>
          </div>
      </div>
  );
};