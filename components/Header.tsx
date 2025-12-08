import React from 'react';
import type { Language } from '../types';
import { getTranslation } from '../utils/translations';

interface HeaderProps {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const Header: React.FC<HeaderProps> = ({ language, setLanguage }) => {
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

      <div className="mt-4 md:mt-0 flex gap-2 bg-gray-800 p-1 rounded-lg border border-gray-700">
        {(['pt-BR', 'en', 'es'] as Language[]).map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`px-3 py-1 text-xs font-bold rounded uppercase transition-colors ${
              language === lang 
                ? 'bg-teal-600 text-white shadow' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            {lang === 'pt-BR' ? 'PT' : lang}
          </button>
        ))}
      </div>
    </header>
  );
};

export default Header;