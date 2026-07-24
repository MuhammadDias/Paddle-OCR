import React, { useState, useEffect, useRef } from 'react';
import { 
  Undo2, Redo2, Search, Replace, Copy, Save, Check, FileText, Sparkles 
} from 'lucide-react';

interface OCRBlock {
  index: number;
  text: string;
  confidence: number;
  box: number[][];
}

interface OcrEditorProps {
  blocks: OCRBlock[];
  onChangeBlocks: (updatedBlocks: OCRBlock[]) => void;
  hoveredIndex: number | null;
  selectedIndex: number | null;
  onSelectBlock: (index: number | null) => void;
  onHoverBlock: (index: number | null) => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const OcrEditor: React.FC<OcrEditorProps> = ({
  blocks,
  onChangeBlocks,
  hoveredIndex,
  selectedIndex,
  onSelectBlock,
  onHoverBlock,
  onShowToast,
}) => {
  // Undo / Redo history
  const [history, setHistory] = useState<OCRBlock[][]>([blocks]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  
  // Find & Replace state
  const [isFindOpen, setIsFindOpen] = useState<boolean>(false);
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  
  // Status states
  const [copied, setCopied] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [autoSaveActive, setAutoSaveActive] = useState<boolean>(false);

  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const autoSaveTimerRef = useRef<any | null>(null);

  // Sync ref array size
  useEffect(() => {
    blockRefs.current = blockRefs.current.slice(0, blocks.length);
  }, [blocks]);

  // Scroll active block into view when selectedIndex changes
  useEffect(() => {
    if (selectedIndex !== null && blockRefs.current[selectedIndex]) {
      blockRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Push new state to history if it changed
  const pushToHistory = (newBlocks: OCRBlock[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    setHistory([...updatedHistory, newBlocks]);
    setHistoryIndex(updatedHistory.length);
  };

  // Block change handler
  const handleBlockChange = (idx: number, newText: string) => {
    const updated = blocks.map((b, i) => i === idx ? { ...b, text: newText } : b);
    onChangeBlocks(updated);
    setIsSaved(false);

    // Auto save with debounce (2 seconds)
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      pushToHistory(updated);
      setIsSaved(true);
      setAutoSaveActive(true);
      setTimeout(() => setAutoSaveActive(false), 1500);
    }, 2000);
  };

  // Manual save
  const handleManualSave = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    pushToHistory(blocks);
    setIsSaved(true);
    if (onShowToast) {
      onShowToast('Perubahan berhasil disimpan.', 'success');
    }
  };

  // Undo / Redo actions
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      onChangeBlocks(history[prevIndex]);
      setIsSaved(true);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      onChangeBlocks(history[nextIndex]);
      setIsSaved(true);
    }
  };

  // Copy full text
  const handleCopyAll = () => {
    const fullText = blocks.map((b) => b.text).join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onShowToast) {
        onShowToast('Seluruh teks disalin ke clipboard.', 'success');
      }
    });
  };

  // Find and Replace
  const handleFindReplace = (replaceMultiple: boolean) => {
    if (!findText) return;
    
    let replacedCount = 0;
    const updated = blocks.map((b) => {
      let text = b.text;
      if (text.includes(findText)) {
        if (replaceMultiple) {
          // Replace all occurrences
          const regex = new RegExp(findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
          const originalLen = text.length;
          text = text.replace(regex, replaceText);
          if (text.length !== originalLen) replacedCount++;
        } else {
          // Replace first occurrence
          text = text.replace(findText, replaceText);
          replacedCount++;
        }
      }
      return { ...b, text };
    });

    if (replacedCount > 0) {
      onChangeBlocks(updated);
      pushToHistory(updated);
      setIsSaved(true);
      if (onShowToast) {
        onShowToast(`Berhasil mengganti ${replacedCount} kata.`, 'success');
      }
    } else {
      if (onShowToast) {
        onShowToast('Kata tidak ditemukan.', 'info');
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pb-4 border-b border-neo-shadow/15 mb-4">
        <div className="flex items-center gap-2">
          {/* Undo Button */}
          <button
            onClick={handleUndo}
            disabled={historyIndex === 0}
            title="Undo (Urungkan)"
            className={`p-2 rounded-full border border-white/50 transition-all duration-200 ${
              historyIndex === 0 
                ? 'bg-neo-bg text-neo-muted opacity-50 shadow-none cursor-not-allowed' 
                : 'bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-neo-text hover:text-indigo-600'
            }`}
          >
            <Undo2 className="w-4 h-4" />
          </button>

          {/* Redo Button */}
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ulangi)"
            className={`p-2 rounded-full border border-white/50 transition-all duration-200 ${
              historyIndex >= history.length - 1 
                ? 'bg-neo-bg text-neo-muted opacity-50 shadow-none cursor-not-allowed' 
                : 'bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-neo-text hover:text-indigo-600'
            }`}
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {/* Find & Replace Accordion Toggle */}
          <button
            onClick={() => setIsFindOpen(!isFindOpen)}
            title="Cari & Ganti"
            className={`p-2 rounded-full border border-white/50 transition-all duration-200 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover ${
              isFindOpen ? 'text-indigo-600 bg-neo-shadow/10' : 'text-neo-text'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Save / Copy Toolbar */}
        <div className="flex items-center gap-3">
          {/* Auto Save Status */}
          <span className="text-[10px] text-neo-muted flex items-center gap-1.5 font-semibold">
            {autoSaveActive ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                <span>Auto Saved...</span>
              </>
            ) : isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Tersimpan</span>
              </>
            ) : (
              <span className="text-amber-500">Ada perubahan...</span>
            )}
          </span>

          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover rounded-full text-xs font-bold text-neo-text border border-white transition-all duration-200"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-indigo-500" />}
            <span>Copy Teks</span>
          </button>

          <button
            onClick={handleManualSave}
            disabled={isSaved}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border border-white transition-all duration-200 ${
              isSaved 
                ? 'bg-neo-bg text-neo-muted shadow-none cursor-not-allowed opacity-50' 
                : 'bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-indigo-600 hover:text-indigo-700'
            }`}
          >
            <Save className="w-3.5 h-3.5 text-indigo-500" />
            <span>Simpan</span>
          </button>
        </div>
      </div>

      {/* Find & Replace Panel */}
      {isFindOpen && (
        <div className="bg-neo-bg shadow-neo-pressed rounded-neo p-3 border border-neo-shadow/20 mb-4 flex flex-col gap-3 animate-slide-down">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari kata..."
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 border border-neo-shadow/30 rounded-full bg-neo-bg shadow-neo-pressed focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neo-text"
              />
              <Search className="w-3.5 h-3.5 text-neo-muted absolute left-3 top-2.5" />
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Ganti dengan..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 border border-neo-shadow/30 rounded-full bg-neo-bg shadow-neo-pressed focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neo-text"
              />
              <Replace className="w-3.5 h-3.5 text-neo-muted absolute left-3 top-2.5" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => handleFindReplace(false)}
              className="px-3.5 py-1.5 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover rounded-full text-[10px] font-bold text-neo-text border border-white transition-all duration-200"
            >
              Ganti Pertama
            </button>
            <button
              onClick={() => handleFindReplace(true)}
              className="px-3.5 py-1.5 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover rounded-full text-[10px] font-bold text-indigo-600 border border-white transition-all duration-200"
            >
              Ganti Semua
            </button>
          </div>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="flex-grow overflow-y-auto pr-1 flex flex-col gap-3 max-h-[500px]">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-neo-muted">
            <FileText className="w-12 h-12 stroke-[1.25] mb-2 text-neo-muted/50" />
            <span className="text-xs font-semibold">Tidak ada teks terdeteksi.</span>
          </div>
        ) : (
          blocks.map((block, idx) => {
            const isHovered = hoveredIndex === idx;
            const isSelected = selectedIndex === idx;
            
            return (
              <div
                key={block.index}
                ref={(el) => { blockRefs.current[idx] = el; }}
                onMouseEnter={() => onHoverBlock(idx)}
                onMouseLeave={() => onHoverBlock(null)}
                onClick={() => onSelectBlock(idx)}
                className={`transition-all duration-200 border rounded-neo p-3 flex flex-col gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-neo-bg border-indigo-500 shadow-neo-pressed ring-1 ring-indigo-500/20'
                    : isHovered
                    ? 'bg-neo-bg border-indigo-400 shadow-neo-card'
                    : 'bg-neo-bg border-white/50 shadow-neo-card hover:border-neo-shadow/30'
                }`}
              >
                <div className="flex justify-between items-center text-[9px] font-bold text-neo-muted select-none">
                  <span>Region #{block.index}</span>
                  <span className={`${
                    block.confidence >= 90 
                      ? 'text-emerald-500' 
                      : block.confidence >= 75 
                      ? 'text-amber-500' 
                      : 'text-rose-500'
                  }`}>
                    Akurasi: {block.confidence}%
                  </span>
                </div>
                <textarea
                  value={block.text}
                  onChange={(e) => handleBlockChange(idx, e.target.value)}
                  className="w-full text-xs font-mono bg-transparent border-0 focus:ring-0 p-0 text-neo-text resize-none focus:outline-none min-h-[30px] leading-relaxed"
                  style={{ height: 'auto' }}
                  onClick={(e) => e.stopPropagation()} // Prevent focus block scroll loop
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
