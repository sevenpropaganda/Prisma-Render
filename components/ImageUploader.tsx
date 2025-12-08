import React, { useCallback } from 'react';
import { getTranslation } from '../utils/translations';
import type { Language } from '../types';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  imagePreview: string | null;
  language: Language;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, imagePreview, language }) => {
  const t = (key: string) => getTranslation(language, key);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onImageUpload(event.target.files[0]);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      onImageUpload(event.dataTransfer.files[0]);
    }
  }, [onImageUpload]);

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="w-full">
      <label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        htmlFor="image-upload"
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300
                    ${imagePreview ? 'border-teal-500' : 'border-gray-600 hover:border-teal-500 bg-gray-800/50 hover:bg-gray-800/70'}`}
      >
        {imagePreview ? (
          <img src={imagePreview} alt="Preview" className="object-contain w-full h-full rounded-lg" />
        ) : (
          <div className="text-center">
             <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
             </svg>
            <p className="mt-2 text-sm text-gray-400">
              <span className="font-semibold text-teal-400">{t('clickToUpload')}</span> {t('dragAndDrop')}
            </p>
            <p className="text-xs text-gray-500">{t('uploadFormats')}</p>
          </div>
        )}
        <input id="image-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
      </label>
    </div>
  );
};

export default ImageUploader;