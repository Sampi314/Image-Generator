import React from 'react';
import { X, Download } from 'lucide-react';

interface ImageModalProps {
  imageUrl: string | null;
  title: string;
  onClose: () => void;
}

export function ImageModal({ imageUrl, title, onClose }: ImageModalProps) {
  if (!imageUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${title}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-7xl max-h-[90vh] w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button
            onClick={handleDownload}
            className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-md border border-white/10"
            title="Download"
          >
            <Download className="w-6 h-6" />
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-md border border-white/10"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <img
          src={imageUrl}
          alt={title}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        
        <h3 className="mt-4 text-white text-xl font-medium text-center">{title}</h3>
      </div>
    </div>
  );
}
