import React, { useState, useEffect } from 'react';
import type { GenerationMode, Language } from '../types';
import { getTranslation } from '../utils/translations';

interface LoadingDisplayProps {
  mode: GenerationMode;
  language: Language;
}

const LoadingDisplay: React.FC<LoadingDisplayProps> = ({ mode, language }) => {
  const t = (key: string) => getTranslation(language, key);

  // Simple hardcoded translations for the spinner messages as they are quite specific
  const getMessages = (lang: Language, mode: GenerationMode) => {
    if (lang === 'pt-BR') {
       return mode === 'video' 
       ? ["Inicializando geração de vídeo...", "Isso pode levar alguns minutos...", "Renderizando detalhes arquitetônicos...", "Compondo cenas e iluminação...", "Aplicando efeitos cinematográficos...", "Finalizando o vídeo..."]
       : ["Analisando imagem...", "Melhorando detalhes...", "Aplicando texturas fotorrealistas...", "Ajustando iluminação...", "Finalizando render de alta resolução..."];
    } else if (lang === 'es') {
       return mode === 'video'
       ? ["Inicializando generación de video...", "Esto puede tardar unos minutos...", "Renderizando detalles...", "Componiendo escenas...", "Aplicando efectos...", "Finalizando video..."]
       : ["Analizando imagen...", "Mejorando detalles...", "Aplicando texturas...", "Ajustando iluminación...", "Finalizando render..."];
    }
    // English default
    return mode === 'video'
       ? ["Initializing video generation...", "This can take a few minutes...", "Rendering architectural details...", "Compositing scenes...", "Applying cinematic effects...", "Finalizing video..."]
       : ["Analyzing input image...", "Enhancing details...", "Applying textures...", "Adjusting lighting...", "Finalizing high-res render..."];
  };

  const messages = getMessages(language, mode);
  const [message, setMessage] = useState(messages[0]);

  useEffect(() => {
    setMessage(messages[0]);
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setMessage(messages[index]);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages]);

  return (
    <div className="text-center p-4">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
      <p className="mt-4 text-lg font-semibold text-gray-200">
        {mode === 'video' ? t('generating') : t('rendering')}
      </p>
      <p className="text-gray-400 mt-2 transition-opacity duration-500">{message}</p>
    </div>
  );
};

export default LoadingDisplay;