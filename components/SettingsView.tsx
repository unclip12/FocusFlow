
import React, { useState, useEffect } from 'react';
import { AppSettings, ThemeColor, AISettings, RevisionSettings, APP_THEMES } from '../types';
import { MoonIcon, SunIcon, SwatchIcon, Cog6ToothIcon, BellIcon, MoonIcon as SleepIcon, UserCircleIcon, BrainIcon, DatabaseIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, ArchiveBoxXMarkIcon, CheckCircleIcon } from './Icons';
import { requestNotificationPermission } from '../services/notificationService';
import { auth, getAISettings, saveAISettings, getRevisionSettings, saveRevisionSettings } from '../services/firebase';
import { exportUserData, importUserData, resetAppData } from '../services/dataManagementService';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface SettingsViewProps {
    settings: AppSettings;
    onUpdateSettings: (settings: AppSettings) => void;
    secretId?: string;
    displayName: string;
    onUpdateDisplayName: (name: string) => void;
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
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
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

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings, secretId, displayName, onUpdateDisplayName }) => {
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

  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
      onUpdateSettings({ ...settings, fontSize: size });
  };

  const handleNotificationToggle = async (enabled: boolean) => {
      if (enabled) {
          const granted = await requestNotificationPermission();
          if (granted) {
              onUpdateSettings({ 
                  ...settings, 
                  notifications: { ...settings.notifications, enabled: true } 
              });
          } else {
              alert("Permission denied. Please enable notifications in your browser/device settings.");
          }
      } else {
          onUpdateSettings({ 
              ...settings, 
              notifications: { ...settings.notifications, enabled: false } 
          });
      }
  };

  const handleSaveAllConfig = async () => {
      setIsLoading(true);
      await Promise.all([
          saveAISettings(aiSettings),
          saveRevisionSettings(revisionSettings)
      ]);
      alert("Settings saved!");
      setIsLoading(false);
  };

  // --- Data Management Handlers ---

  const handleBackup = async () => {
      setIsBackingUp(true);
      try {
          await exportUserData();
      } catch (e) {
          console.error("Backup failed", e);
          alert("Backup failed. Please try again.");
      } finally {
          setIsBackingUp(false);
      }
  };

  const handleImportClick = () => {
      document.getElementById('restore-file-input')?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsRestoring(true);
          
          const reader = new FileReader();
          reader.onload = async (ev) => {
              try {
                  const json = JSON.parse(ev.target?.result as string);
                  await importUserData(json);
                  alert("Data restored successfully! Reloading...");
                  window.location.reload();
              } catch (err) {
                  console.error("Restore failed", err);
                  alert("Failed to restore data. Invalid file or network error.");
                  setIsRestoring(false);
              }
          };
          reader.readAsText(file);
          e.target.value = ''; // Reset input
      }
  };

  const handleResetConfirm = async () => {
      setIsResetModalOpen(false);
      // Double confirmation via native alert for safety
      // (Using DeleteConfirmationModal triggers the flow, but this is nuclear)
      // We trust the modal, but let's be safe.
      
      setIsLoading(true);
      try {
          await resetAppData();
          alert("App data reset complete. Restarting...");
          window.location.reload();
      } catch (e) {
          console.error("Reset failed", e);
          alert("Failed to reset data. Please check your connection.");
          setIsLoading(false);
      }
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto pb-20">
        <DeleteConfirmationModal 
            isOpen={isResetModalOpen}
            onClose={() => setIsResetModalOpen(false)}
            onConfirm={handleResetConfirm}
            title="Reset Application?"
            message="WARNING: This will permanently delete ALL your study logs, plans, notes, and history. This action cannot be undone. It will be like starting a fresh account."
        />

        <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-primary">
                <Cog6ToothIcon className="w-8 h-8" />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h2>
                <p className="text-slate-500 dark:text-slate-400">Customize your FocusFlow experience</p>
            </div>
        </div>

        <div className="space-y-6">
             <Section title="Profile & Account" icon={UserCircleIcon}>
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Your Name</label>
                    <input
                        type="text"
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        onBlur={handleNameSave}
                        placeholder="Enter your name (e.g. Arsh)"
                        className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Used by the AI Mentor to address you.</p>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white">Secret ID</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{secretId || 'N/A'}</p>
                    </div>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                    <button
                        onClick={() => auth.signOut()}
                        className="w-full sm:w-auto px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm"
                    >
                        Sign Out
                    </button>
                </div>
            </Section>

            <Section title="Appearance & Theme" icon={SwatchIcon}>
                {/* Background Themes Grid */}
                <div>
                    <p className="font-bold text-slate-800 dark:text-white mb-3">Background Theme</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {APP_THEMES.map(theme => (
                            <button 
                                key={theme.id}
                                onClick={() => handleThemeSelect(theme.id)}
                                className={`relative p-1 rounded-xl border-2 transition-all hover:scale-[1.02] ${settings.themeId === theme.id ? 'border-indigo-600 dark:border-white shadow-md scale-[1.02]' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600'}`}
                            >
                                <div className="h-20 w-full rounded-lg shadow-inner overflow-hidden relative" style={{ background: theme.bgGradient }}>
                                    <div className="absolute bottom-0 left-0 right-0 bg-white/30 backdrop-blur-sm p-1 text-center">
                                        <span className={`text-[10px] font-bold ${theme.isDark ? 'text-white' : 'text-slate-800'}`}>{theme.name}</span>
                                    </div>
                                </div>
                                {settings.themeId === theme.id && (
                                    <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                                        <CheckCircleIcon className="w-3 h-3" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Selecting a dark background will automatically enable dark mode for readability.</p>
                </div>

                {/* Accent Colors */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-4">
                         <p className="font-bold text-slate-800 dark:text-white">Accent Color</p>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                        {COLORS.map(color => (
                            <button 
                                key={color.value}
                                onClick={() => handleColorChange(color.value)}
                                className={`relative group p-1 rounded-xl border-2 transition-all ${settings.primaryColor === color.value ? 'border-slate-800 dark:border-white scale-105' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600'}`}
                            >
                                <div className="h-12 w-full rounded-lg" style={{ backgroundColor: color.hex }}></div>
                            </button>
                        ))}
                    </div>
                </div>
            </Section>

            {/* DATA MANAGEMENT SECTION */}
            <Section title="Data Management" icon={DatabaseIcon}>
                <SettingRow label="Backup Data" description="Export all your study logs, plans, and settings to a JSON file.">
                    <button 
                        onClick={handleBackup}
                        disabled={isBackingUp}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    >
                        {isBackingUp ? 'Exporting...' : 'Export Backup'}
                        <ArrowUpTrayIcon className="w-4 h-4" />
                    </button>
                </SettingRow>

                <SettingRow label="Restore Data" description="Import a previously saved backup file. This will overwrite conflicting data.">
                    <div>
                        <button 
                            onClick={handleImportClick}
                            disabled={isRestoring}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                        >
                            {isRestoring ? 'Restoring...' : 'Import Backup'}
                            <ArrowDownTrayIcon className="w-4 h-4" />
                        </button>
                        <input 
                            type="file" 
                            id="restore-file-input" 
                            className="hidden" 
                            accept=".json" 
                            onChange={handleFileChange}
                        />
                    </div>
                </SettingRow>

                <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <p className="font-bold text-red-600 dark:text-red-400">Reset App Data</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Permanently wipe all study history and start fresh.</p>
                        </div>
                        <button 
                            onClick={() => setIsResetModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-bold text-xs hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-200 dark:border-red-900/50"
                        >
                            Reset Everything
                            <ArchiveBoxXMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </Section>

            {/* NEW AI MENTOR & REVISION SYSTEM */}
             <Section title="AI Mentor & Revision System" icon={BrainIcon}>
                 {/* AI Behavior Mode */}
                 <SettingRow label="AI Behavior Mode" description="Choose how the AI mentor interacts with you.">
                     <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                         {['calm', 'balanced', 'strict'].map(mode => (
                             <button key={mode} onClick={() => setAiSettings(s => ({ ...s, personalityMode: mode as any }))}
                                 className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${aiSettings.personalityMode === mode ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500'}`}>
                                 {mode.charAt(0).toUpperCase() + mode.slice(1)}
                             </button>
                         ))}
                     </div>
                 </SettingRow>

                 {/* AI Talk Style */}
                 <SettingRow label="AI Talk Style" description="Select the mentor's communication style.">
                     <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                         {['short', 'teaching', 'motivational'].map(style => (
                             <button key={style} onClick={() => setAiSettings(s => ({ ...s, talkStyle: style as any }))}
                                 className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${aiSettings.talkStyle === style ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500'}`}>
                                 {style === 'short' ? 'Direct' : style.charAt(0).toUpperCase() + style.slice(1)}
                             </button>
                         ))}
                     </div>
                 </SettingRow>

                 {/* AI Discipline Level */}
                 <SettingRow label="AI Discipline Level" description="How strict the mentor is about reminders and focus.">
                     <div className="flex items-center gap-4 w-full sm:w-48">
                         <input type="range" min="1" max="5" value={aiSettings.disciplineLevel || 3}
                             onChange={e => setAiSettings(s => ({ ...s, disciplineLevel: parseInt(e.target.value) }))}
                             className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary" />
                         <span className="font-bold text-primary">{aiSettings.disciplineLevel}</span>
                     </div>
                 </SettingRow>

                {/* AI Memory Permissions */}
                 <div>
                     <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">AI Memory Permissions</label>
                     <div className="space-y-2">
                         {['canReadKnowledgeBase', 'canReadTimeLogs', 'canReadInfoFiles'].map(perm => (
                             <label key={perm} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                 <input type="checkbox"
                                     checked={aiSettings.memoryPermissions?.[perm as keyof typeof aiSettings.memoryPermissions] || false}
                                     onChange={e => setAiSettings(s => ({ ...s, memoryPermissions: { ...s.memoryPermissions, [perm]: e.target.checked } }))}
                                     className="w-4 h-4 rounded text-primary border-slate-300" />
                                 <span className="text-sm text-slate-700 dark:text-slate-200">
                                     AI can read {perm.replace('canRead', '').replace(/([A-Z])/g, ' $1').trim()}
                                 </span>
                             </label>
                         ))}
                     </div>
                 </div>

                <div className="border-t border-slate-100 dark:border-slate-700 pt-6 space-y-6">
                     {/* Spaced Repetition Mode */}
                     <SettingRow label="Spaced Repetition Mode" description="Adjusts the intervals for your revisions.">
                         <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                             {['fast', 'balanced', 'deep'].map(mode => (
                                 <button key={mode} onClick={() => setRevisionSettings(s => ({ ...s, mode: mode as any }))}
                                     className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${revisionSettings.mode === mode ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500'}`}>
                                     {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                 </button>
                             ))}
                         </div>
                     </SettingRow>

                    {/* Target Revision Count */}
                     <SettingRow label="Target Revision Count" description="Number of revisions before a topic is considered 'mastered'.">
                         <div className="flex items-center gap-4 w-full sm:w-48">
                             <input type="range" min="5" max="15" value={revisionSettings.targetCount || 7}
                                 onChange={e => setRevisionSettings(s => ({ ...s, targetCount: parseInt(e.target.value) }))}
                                 className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary" />
                             <span className="font-bold text-primary">{revisionSettings.targetCount}x</span>
                         </div>
                     </SettingRow>

                    {/* Carry Forward Rule */}
                     <SettingRow label="Carry Forward Rule" description="How to handle partially completed tasks.">
                         <select value={revisionSettings.carryForwardRule || 'next_block'}
                             onChange={e => setRevisionSettings(s => ({ ...s, carryForwardRule: e.target.value as any }))}
                             className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium"
                         >
                             <option value="next_block">Carry to next block</option>
                             <option value="end_of_day">Carry to end of today</option>
                             <option value="next_day">Carry to next day</option>
                         </select>
                     </SettingRow>
                </div>
                 
                 <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                     <button onClick={handleSaveAllConfig} disabled={isLoading} className="w-full sm:w-auto px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors text-sm shadow-md disabled:opacity-50">
                         {isLoading ? "Saving..." : "Save AI & Revision Settings"}
                     </button>
                 </div>
            </Section>

            <Section title="Notifications" icon={BellIcon}>
                <SettingRow label="Enable Notifications" description="Get alerts for timers and mentor nudges">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={settings.notifications?.enabled || false} onChange={(e) => handleNotificationToggle(e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </SettingRow>
            </Section>

            <div className="text-center pt-8 text-slate-400 text-xs">
                <p>FocusFlow v1.7</p>
            </div>
        </div>
    </div>
  );
};
