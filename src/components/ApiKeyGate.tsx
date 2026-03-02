import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Fallback for local dev if window.aistudio is not injected
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // Assume success to avoid race conditions
        setHasKey(true);
      } catch (e: any) {
        console.error(e);
        // If error contains "Requested entity was not found.", reset state
        if (e?.message?.includes('Requested entity was not found.')) {
          setHasKey(false);
        }
      }
    }
  };

  if (hasKey === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-400">Checking API Key...</p>
        </div>
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4">API Key Required</h1>
          <p className="mb-6 text-zinc-400 text-sm leading-relaxed">
            This app uses Gemini 3.1 Flash Image Preview, which requires a paid Google Cloud project API key.
            Please select your API key to continue.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            Select API Key
          </button>
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noreferrer" 
              className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-4 transition-colors"
            >
              Billing Documentation
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
