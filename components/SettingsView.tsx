
import React from 'react';
import { AppSettings, ThemeColor } from '../types';
import { MoonIcon, SunIcon, SwatchIcon, Cog6ToothIcon } from './Icons';

interface SettingsViewProps {
    settings: AppSettings;
    onUpdateSettings: (settings: AppSettings) => void;
}

const COLORS: { name: string, value: ThemeColor, hex: string, rgb: string }[] = [
    { name: 'Indigo', value: 'indigo', hex: '#4f46e5', rgb: '79 70 229' },
    { name: 'Emerald', value: 'emerald', hex: '#10b981', rgb: '16 185 129' },
    { name: 'Rose', value: 'rose', hex: '#f43f5e', rgb: '244 63 94' },
    { name: 'Amber', value: 'amber', hex: '#f59e0b', rgb: '245 158 11' },
    { name: 'Sky', value: 'sky', hex: '#0ea5e9', rgb: '14 165 233' },
    { name: 'Violet', value: 'violet', hex: '#8b5cf6', rgb: '139 92 246' },
];

const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings }) => {
  
  const handleToggleDarkMode = (isDark: boolean) => {
      onUpdateSettings({ ...settings, darkMode: isDark });
  };

  const handleColorChange = (color: ThemeColor) => {
      onUpdateSettings({ ...settings, primaryColor: color });
  };

  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
      onUpdateSettings({ ...settings, fontSize: size });
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
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
            
            {/* Appearance Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Appearance</h3>
                </div>
                
                <div className="p-6 space-y-8">
                    {/* Dark Mode Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-slate-700 rounded-lg text-indigo-600 dark:text-indigo-400">
                                {settings.darkMode ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">Dark Mode</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Switch between light and dark themes</p>
                            </div>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                            <button 
                                onClick={() => handleToggleDarkMode(false)}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${!settings.darkMode ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                Light
                            </button>
                            <button 
                                onClick={() => handleToggleDarkMode(true)}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${settings.darkMode ? 'bg-slate-700 shadow-sm text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                Dark
                            </button>
                        </div>
                    </div>

                    {/* Theme Color Picker */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                             <SwatchIcon className="w-5 h-5 text-slate-400" />
                             <p className="font-bold text-slate-800 dark:text-white">Accent Color</p>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                            {COLORS.map(color => (
                                <button 
                                    key={color.value}
                                    onClick={() => handleColorChange(color.value)}
                                    className={`relative group p-1 rounded-xl border-2 transition-all ${settings.primaryColor === color.value ? 'border-slate-800 dark:border-white scale-105' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600'}`}
                                >
                                    <div className="h-12 w-full rounded-lg flex items-center justify-center" style={{ backgroundColor: color.hex }}>
                                        {settings.primaryColor === color.value && (
                                            <div className="bg-white/20 rounded-full p-1">
                                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <span className="block text-center text-xs font-bold mt-2 text-slate-600 dark:text-slate-400">{color.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Typography Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Typography</h3>
                </div>
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white">Font Size</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Adjust the global text scaling</p>
                        </div>
                        <div className="flex gap-2">
                            {[
                                { label: 'Small', val: 'small', scale: 'Aa' },
                                { label: 'Medium', val: 'medium', scale: 'Aa' },
                                { label: 'Large', val: 'large', scale: 'Aa' }
                            ].map((opt) => (
                                <button 
                                    key={opt.val}
                                    onClick={() => handleFontSizeChange(opt.val as any)}
                                    className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border transition-all ${settings.fontSize === opt.val ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    <span className={`font-bold ${opt.val === 'small' ? 'text-sm' : opt.val === 'large' ? 'text-xl' : 'text-base'}`}>
                                        {opt.scale}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-wider mt-1">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-center pt-8 text-slate-400 text-xs">
                <p>FocusFlow v1.3 • Data stored locally in IndexedDB</p>
            </div>
        </div>
    </div>
  );
};

export default SettingsView;
