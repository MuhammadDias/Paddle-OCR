import React from 'react';
import { Copy, Check } from 'lucide-react';
import type { TextRegion } from '../services/api';

interface OCRResultItemProps {
  region: TextRegion;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (hovered: boolean) => void;
  onSelect: () => void;
  copiedText: string | null;
  onCopy: (text: string) => void;
}

export const OCRResultItem: React.FC<OCRResultItemProps> = ({
  region,
  isHovered,
  isSelected,
  onHover,
  onSelect,
  copiedText,
  onCopy,
}) => {
  const isItemCopied = copiedText === region.text;

  // Custom styling based on active states
  const getContainerClass = () => {
    if (isSelected) {
      return 'border-indigo-300 bg-indigo-50/20 shadow-neo-pressed';
    }
    if (isHovered) {
      return 'border-indigo-100 bg-indigo-50/5 shadow-neo-hover';
    }
    return 'border-white/50 bg-neo-bg shadow-neo-btn';
  };

  const getProgressColor = (confidence: number) => {
    if (confidence >= 85) return 'bg-emerald-500';
    if (confidence >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onSelect}
      className={`w-full p-4 border rounded-neo transition-all duration-200 flex flex-col gap-3 cursor-pointer select-none ${getContainerClass()}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-6 h-6 rounded-full bg-neo-bg shadow-neo-btn flex items-center justify-center text-[10px] font-extrabold text-neo-muted flex-shrink-0 border border-white">
            {region.index}
          </div>
          <p className="text-sm font-medium text-neo-text leading-relaxed break-words whitespace-pre-wrap min-w-0">
            {region.text}
          </p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy(region.text);
          }}
          title="Salin Baris Teks"
          className="p-2 rounded-full bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover border border-white flex-shrink-0 text-neo-muted hover:text-indigo-600 transition-all duration-200"
        >
          {isItemCopied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Confidence Score & Progress Bar */}
      <div className="flex flex-col gap-1.5 mt-1 border-t border-neo-shadow/20 pt-2">
        <div className="flex justify-between items-center text-[10px] font-bold text-neo-muted">
          <span>Tingkat Keyakinan (Confidence)</span>
          <span className={region.confidence >= 85 ? 'text-emerald-600' : 'text-neo-text'}>
            {region.confidence.toFixed(1)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-neo-shadow/40 rounded-full overflow-hidden neo-inset p-[1px]">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor(
              region.confidence
            )}`}
            style={{ width: `${region.confidence}%` }}
          />
        </div>
      </div>
    </div>
  );
};
