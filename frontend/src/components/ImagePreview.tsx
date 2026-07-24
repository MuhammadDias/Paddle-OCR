import React, { useState, useEffect } from 'react';
import { Play, Trash2, RefreshCw, FileText, HardDrive, Maximize2, Languages } from 'lucide-react';

interface ImagePreviewProps {
  file: File;
  onProcess: () => void;
  onRemove: () => void;
  onChangeImage: () => void;
  processing?: boolean;
  lang: string;
  onChangeLang: (lang: string) => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  file,
  onProcess,
  onRemove,
  onChangeImage,
  processing = false,
  lang,
  onChangeLang,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [resolution, setResolution] = useState<string>('Memuat...');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      setResolution(`${img.naturalWidth} x ${img.naturalHeight}`);
    };

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full bg-neo-bg rounded-neo p-6 shadow-neo-card border border-white/50 flex flex-col gap-6">
      <div className="w-full h-64 md:h-80 bg-neo-bg rounded-neo flex items-center justify-center neo-inset border border-white/40 overflow-hidden relative group">
        <img
          src={previewUrl}
          alt="Preview"
          className="max-w-full max-h-full object-contain p-2 rounded-neo transition-all duration-300 group-hover:scale-[1.01]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-neo-bg rounded-neo shadow-neo-pressed border border-white/40 text-xs">
        <div className="flex items-center gap-2 text-neo-muted">
          <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-neo-text truncate" title={file.name}>
              {file.name}
            </div>
            <div className="text-[10px]">Nama File</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-neo-muted border-t sm:border-t-0 sm:border-l border-neo-shadow/50 pt-2 sm:pt-0 sm:pl-4">
          <HardDrive className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <div>
            <div className="font-semibold text-neo-text">{formatFileSize(file.size)}</div>
            <div className="text-[10px]">Ukuran File</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-neo-muted border-t sm:border-t-0 sm:border-l border-neo-shadow/50 pt-2 sm:pt-0 sm:pl-4">
          <Maximize2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <div>
            <div className="font-semibold text-neo-text">{resolution}</div>
            <div className="text-[10px]">Resolusi</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={onChangeImage}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2.5 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover hover:text-indigo-600 rounded-full text-xs font-semibold text-neo-muted border border-white/50 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Ganti Gambar</span>
          </button>
          
          <button
            onClick={onRemove}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2.5 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover hover:text-red-600 rounded-full text-xs font-semibold text-neo-muted border border-white/50 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-neo-bg shadow-neo-pressed rounded-full border border-white/40 text-xs text-neo-text font-bold">
            <Languages className="w-3.5 h-3.5 text-indigo-500" />
            <select
              value={lang}
              onChange={(e) => onChangeLang(e.target.value)}
              className="bg-transparent border-none text-xs text-neo-text font-bold focus:ring-0 focus:outline-none cursor-pointer pr-1"
            >
              <option value="auto">Auto Detect</option>
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
              <option value="japan">日本語 (Japanese)</option>
              <option value="ch">中文 (Chinese)</option>
              <option value="korean">한국어 (Korean)</option>
              <option value="ar">العربية (Arabic)</option>
            </select>
          </div>

          <button
            onClick={onProcess}
            disabled={processing}
            className="flex items-center gap-2 px-6 py-2.5 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover rounded-full text-xs font-bold text-indigo-600 border border-white transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Play className="w-3.5 h-3.5 text-indigo-600" />
            <span>{processing ? 'Memproses...' : 'Proses OCR'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
