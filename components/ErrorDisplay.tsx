import React from 'react';

interface ErrorDisplayProps {
  message: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message }) => {
  return (
    <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg relative text-center" role="alert">
      <strong className="font-bold block">Error!</strong>
      <span className="block sm:inline">{message}</span>
    </div>
  );
};

export default ErrorDisplay;
