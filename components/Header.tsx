
import React from 'react';
import type { Language } from '../types';
import { getTranslation } from '../utils/translations';

interface HeaderProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  hasApiKey: boolean;
  onEditKey: () => void;
}

const Header: React.FC<HeaderProps> = ({ language, setLanguage, hasApiKey, onEditKey }) => {
  const t = (key: string) => getTranslation(language, key);

  return (
    <header className="flex flex-col md:flex-row justify-between items-center mb-6">
       <div className="text-center md:text-left flex-1">
        <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-500 tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-2 text-sm md:text-lg text-gray-400 max-w-2xl font-light">
          {t('subtitle')}
        </p>
      </div>

      <div className="mt-4 md:mt-0 flex items-center gap-3 bg-gray-800/50 p-2 rounded-xl border border-gray-700">
        
        {/* API Key Status / Editor */}
        <button
            onClick={onEditKey}
            title={`${t('apiKeyStatus')} - ${hasApiKey ? t('apiKeyActive') : t('apiKeyInactive')}`}
            className={`p-2 rounded-lg border transition-all duration-300 flex items-center justify-center group ${
                hasApiKey
                ? 'bg-green-900/20 border-green-500/30 text-green-400 hover:bg-green-900/40 hover:border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.1)]'
                : 'bg-red-900/20 border-red-500/30 text-red-400 hover:bg-red-900/40 hover:border-red-400 shadow-[0_0_10px_rgba(248,113,113,0.1)] animate-pulse'
            }`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
        </button>

        <div className="w-px h-6 bg-gray-700"></div>

        <div className="flex gap-1">
            {(['pt-BR', 'en', 'es'] as Language[]).map((lang) => (
            <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase transition-colors ${
                language === lang 
                    ? 'bg-teal-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
            >
                {lang === 'pt-BR' ? 'PT' : lang}
            </button>
            ))}
        </div>
      </div>
    </header>
  );
};

export default Header;
