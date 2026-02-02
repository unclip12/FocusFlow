
import React, { useState } from 'react';
import { loginWithSecretId } from '../services/firebase';
import { AppLogo } from './Icons';

export const LoginView = () => {
  const [secretId, setSecretId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!secretId.trim()) return;

      setLoading(true);
      setError('');
      try {
          await loginWithSecretId(secretId);
      } catch (err: any) {
          setError("Failed to login. Please try a simple ID (letters/numbers only) or check connection.");
          console.error(err);
      } finally {
          setLoading(false);
      }
  };

  return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700 animate-fade-in-up">
              <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
                       <AppLogo className="w-full h-full" />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Welcome Back</h1>
                  <p className="text-slate-500 dark:text-slate-400">Enter your Secret ID to sync your study progress.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Secret ID</label>
                      <input 
                          type="text" 
                          value={secretId}
                          onChange={(e) => setSecretId(e.target.value)}
                          placeholder="e.g. DracoMalfoy99"
                          className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg"
                          autoCapitalize="none"
                      />
                  </div>

                  {error && (
                      <div className="p-3 bg-red-50 text-red-500 text-sm rounded-lg text-center font-medium">
                          {error}
                      </div>
                  )}

                  <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                  >
                      {loading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Syncing...</span>
                          </>
                      ) : (
                          "Access FocusFlow"
                      )}
                  </button>
              </form>
              
              <p className="text-center text-xs text-slate-400 mt-6">
                  New? Just type any ID and we'll create your space automatically.
              </p>
          </div>
      </div>
  );
};
