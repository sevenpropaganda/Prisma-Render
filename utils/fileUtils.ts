export const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(',');
      if (!header || !base64) {
        reject(new Error('Invalid file format'));
        return;
      }
      const mimeTypeMatch = header.match(/:(.*?);/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'application/octet-stream';
      resolve({ base64, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
};

export const base64ToFile = async (base64: string, filename: string): Promise<File> => {
  const res = await fetch(base64);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/png' });
};
