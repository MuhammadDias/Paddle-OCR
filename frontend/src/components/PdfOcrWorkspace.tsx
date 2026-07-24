import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileText, Upload, Play, X, Trash2, Download, 
  RefreshCw, Maximize2, AlertTriangle, ZoomIn, ZoomOut, RotateCcw,
  Languages, ChevronDown
} from 'lucide-react';
import { processPdfOCR, exportOcrResults } from '../services/api';
import type { PDFPageResult, PDFProgressUpdate } from '../services/api';
import { OcrEditor } from './OcrEditor';
import { ConfirmationDialog } from './ConfirmationDialog';

interface PdfOcrWorkspaceProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onBackToHome: () => void;
  initialResults?: PDFPageResult[] | null;
  initialFilename?: string | null;
  onClearInitialResults?: () => void;
}

export const PdfOcrWorkspace: React.FC<PdfOcrWorkspaceProps> = ({
  onShowToast,
  onBackToHome,
  initialResults = null,
  initialFilename = null,
  onClearInitialResults,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');
  const [results, setResults] = useState<PDFPageResult[]>([]);
  const [activePage, setActivePage] = useState<number>(1);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Advanced features states
  const [lang, setLang] = useState<string>('id');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [pageImgDims, setPageImgDims] = useState<Record<number, { width: number; height: number }>>({});
  
  // Confirmation states
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState<string>('');
  const [confirmMsg, setConfirmMsg] = useState<string>('');

  const triggerConfirmation = (title: string, msg: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmMsg(msg);
    setConfirmAction(() => action);
    setIsConfirmOpen(true);
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync initial results from history
  useEffect(() => {
    if (initialResults && initialResults.length > 0) {
      setResults(initialResults);
      setActivePage(1);
      if (initialFilename) {
        setSelectedFile(new File([""], initialFilename, { type: "application/pdf" }));
      }
      if (onClearInitialResults) {
        onClearInitialResults();
      }
    }
  }, [initialResults, initialFilename]);
  
  // Refs for left scrolling
  const leftScrollRef = useRef<HTMLDivElement>(null);

  // Jump to specific page
  const handlePageSelect = (pageNum: number) => {
    setActivePage(pageNum);
    setSelectedIndex(null);
    setHoveredIndex(null);
    
    if (leftScrollRef.current) {
      const idx = pageNum - 1;
      const total = results.length;
      const left = leftScrollRef.current;
      const targetRatio = total > 1 ? idx / (total - 1) : 0;
      left.scrollTop = targetRatio * (left.scrollHeight - left.clientHeight);
    }
  };

  // React Dropzone configuration
  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        onShowToast('Berkas harus berupa dokumen PDF.', 'error');
        return;
      }
      setSelectedFile(file);
      setErrorMsg(null);
      setResults([]);
      setProgressPercent(0);
      setProgressText('');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const handleStartOCR = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setResults([]);
    setProgressPercent(5);
    setProgressText('Menghubungi server...');

    abortControllerRef.current = new AbortController();

    try {
      const ocrResults = await processPdfOCR(
        selectedFile, 
        (update: PDFProgressUpdate) => {
          if (update.status === 'start' && update.total_pages) {
            setProgressText(`Mulai memproses. Total ${update.total_pages} halaman.`);
            setProgressPercent(10);
          } else if (update.status === 'progress' && update.page && update.total) {
            const percent = Math.round((update.page / update.total) * 90) + 5;
            setProgressPercent(percent);
            setProgressText(`Memproses halaman ${update.page} / ${update.total} (${update.source === 'text_layer' ? 'Text Layer' : 'PaddleOCR'})`);
          } else if (update.status === 'completed') {
            setProgressPercent(100);
            setProgressText('Pemrosesan PDF OCR selesai.');
          } else if (update.status === 'error' && update.message) {
            throw new Error(update.message);
          }
        },
        lang,
        abortControllerRef.current.signal
      );

      setResults(ocrResults);
      setActivePage(1);
      onShowToast('Dokumen PDF berhasil diproses.', 'success');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        onShowToast('Proses PDF OCR dibatalkan oleh pengguna.', 'info');
      } else {
        const msg = err.message || 'Gagal memproses berkas PDF.';
        setErrorMsg(msg);
        onShowToast(msg, 'error');
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelOCR = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      setProgressPercent(0);
      setProgressText('Dibatalkan.');
    }
  };

  const handleRemoveFile = () => {
    const performRemove = () => {
      setSelectedFile(null);
      setResults([]);
      setProgressPercent(0);
      setProgressText('');
      setErrorMsg(null);
      setPageImgDims({});
    };

    if (results.length > 0) {
      triggerConfirmation(
        'Mulai Unggahan Baru',
        'Apakah Anda yakin ingin menghapus berkas ini? Seluruh hasil ekstraksi teks dokumen ini akan hilang.',
        performRemove
      );
    } else {
      performRemove();
    }
  };

  const handleExport = async (format: 'txt' | 'json' | 'docx' | 'pdf' | 'zip') => {
    if (results.length === 0) return;
    try {
      setIsExportDropdownOpen(false);
      onShowToast('Menyiapkan file ekspor...', 'info');
      await exportOcrResults(selectedFile?.name || 'ocr_result.pdf', results, format);
      onShowToast('Ekspor berhasil diunduh.', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Gagal mengekspor hasil.', 'error');
    }
  };

  const handleUpdateBlocks = (updatedBlocks: any[]) => {
    const updatedResults = results.map((page, idx) => {
      if (idx === activePage - 1) {
        const text = updatedBlocks.map((b) => b.text).join('\n');
        return {
          ...page,
          blocks: updatedBlocks,
          text: text
        };
      }
      return page;
    });
    setResults(updatedResults);
  };

  return (
    <div className="w-full flex flex-col gap-8 animate-scale-in">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-neo-bg p-5 rounded-neo shadow-neo-flat border border-white/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neo-bg shadow-neo-btn flex items-center justify-center text-indigo-600 border border-white">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-neo-text">Workspace PDF OCR</h4>
            <p className="text-[10px] text-neo-muted">Mengekstrak file PDF digital secara asinkron lewat text layer atau PaddleOCR adaptif.</p>
          </div>
        </div>

        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 px-4.5 py-2.5 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-xs font-bold text-neo-muted hover:text-neo-text rounded-full border border-white transition-all duration-200"
        >
          <span>Kembali ke Beranda</span>
        </button>
      </div>

      {/* Main Upload / Control Panel */}
      {results.length === 0 && (
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
          {!selectedFile ? (
            /* Drag and Drop Container */
            <div 
              {...getRootProps()} 
              className={`w-full py-16 px-6 bg-neo-bg rounded-neo border border-dashed border-indigo-300 hover:border-indigo-500 shadow-neo-pressed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 ${isDragActive ? 'scale-[0.99] border-indigo-600 bg-indigo-50/5' : ''}`}
            >
              <input {...getInputProps()} />
              <div className="w-14 h-14 rounded-full bg-neo-bg shadow-neo-btn flex items-center justify-center text-indigo-500 border border-white">
                <Upload className="w-6 h-6 animate-bounce" />
              </div>
              <div className="text-center flex flex-col gap-1.5">
                <span className="text-xs font-bold text-neo-text">
                  {isDragActive ? 'Lepaskan berkas PDF di sini' : 'Pilih atau seret berkas PDF Anda ke sini'}
                </span>
                <p className="text-[10px] text-neo-muted">Format yang didukung: berkas PDF digital atau PDF hasil scan (Maks. 20MB)</p>
              </div>
            </div>
          ) : (
            /* Selected File Details */
            <div className="p-6 bg-neo-bg rounded-neo shadow-neo-card border border-white flex flex-col gap-6 transition-all duration-300">
              <div className="flex items-center justify-between border-b border-neo-shadow/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neo-bg shadow-neo-pressed flex items-center justify-center text-indigo-500 border border-white/60">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-neo-text truncate max-w-[200px] md:max-w-md">{selectedFile.name}</h5>
                    <p className="text-[9px] text-neo-muted">Ukuran: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>

                <button
                  onClick={handleRemoveFile}
                  disabled={isProcessing}
                  className="p-2 rounded-full bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-rose-500 hover:scale-105 border border-white/50 transition-all duration-200 disabled:opacity-50"
                  title="Hapus file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Error Box */}
              {errorMsg && (
                <div className="p-4 bg-rose-500/10 rounded-neo border border-rose-200 flex items-start gap-2.5 text-xs font-bold text-rose-600 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Progress Panel */}
              {isProcessing && (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-[10px] font-bold text-neo-muted">
                    <span className="truncate max-w-[80%]">{progressText}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-3 bg-neo-bg shadow-neo-pressed rounded-full overflow-hidden p-[2px] border border-white">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 mt-2">
                {isProcessing ? (
                  <button
                    onClick={handleCancelOCR}
                    className="px-5 py-3 rounded-full bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-xs font-bold text-rose-500 border border-white transition-all duration-200 hover:scale-[1.01]"
                  >
                    Batal
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleRemoveFile}
                      className="px-5 py-3 rounded-full bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-xs font-bold text-neo-muted hover:text-neo-text border border-white transition-all duration-200 hover:scale-[1.01]"
                    >
                      Unggah Ulang
                    </button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-neo-bg shadow-neo-pressed rounded-full border border-white/40 text-xs text-neo-text font-bold">
                      <Languages className="w-3.5 h-3.5 text-indigo-500" />
                      <select
                        value={lang}
                        onChange={(e) => setLang(e.target.value)}
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
                      onClick={handleStartOCR}
                      className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-xs font-extrabold text-indigo-600 border border-white transition-all duration-200 hover:scale-[1.01] active:shadow-neo-pressed"
                    >
                      <Play className="w-4 h-4" />
                      <span>Mulai Ekstraksi PDF</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Dual Panel Viewer */}
      {results.length > 0 && (
        <div className="w-full flex flex-col gap-6 animate-scale-in">
          
          {/* Results Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-neo-bg p-4 rounded-neo shadow-neo-flat border border-white/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neo-text truncate max-w-[200px]">{selectedFile?.name}</span>
              <span className="text-[9px] bg-indigo-50/50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-bold">
                {results.length} Halaman
              </span>
            </div>

            <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-xs font-bold text-indigo-600 rounded-full border border-white transition-all duration-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Hasil</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              
              {isExportDropdownOpen && (
                <div className="absolute right-32 top-12 z-20 w-44 bg-neo-bg border border-white/60 rounded-neo shadow-neo-card p-1.5 flex flex-col gap-1 animate-scale-in">
                  <button
                    onClick={() => handleExport('txt')}
                    className="w-full text-left px-3 py-1.5 rounded-full text-xs font-bold text-neo-text hover:bg-neo-shadow/15 transition-all text-indigo-600"
                  >
                    Text (.txt)
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-3 py-1.5 rounded-full text-xs font-bold text-neo-text hover:bg-neo-shadow/15 transition-all text-indigo-600"
                  >
                    JSON (.json)
                  </button>
                  <button
                    onClick={() => handleExport('docx')}
                    className="w-full text-left px-3 py-1.5 rounded-full text-xs font-bold text-neo-text hover:bg-neo-shadow/15 transition-all text-indigo-600"
                  >
                    Word (.docx)
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full text-left px-3 py-1.5 rounded-full text-xs font-bold text-neo-text hover:bg-neo-shadow/15 transition-all text-indigo-600"
                  >
                    Searchable PDF (.pdf)
                  </button>
                  <button
                    onClick={() => handleExport('zip')}
                    className="w-full text-left px-3 py-1.5 rounded-full text-xs font-bold text-neo-text hover:bg-neo-shadow/15 transition-all text-indigo-600"
                  >
                    ZIP (Semua Format)
                  </button>
                </div>
              )}

              <button
                onClick={handleRemoveFile}
                className="flex items-center gap-1.5 px-4.5 py-2.5 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-[11px] font-bold text-rose-500 rounded-full border border-white transition-all duration-200"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Mulai Baru</span>
              </button>
            </div>
            </div>
          </div>

          {/* Dual Panel Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-stretch">
            
            {/* Panel Kiri: Preview Pages */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="px-1 flex justify-between items-center text-xs font-bold text-neo-muted">
                <span>Pratinjau Halaman Dokumen</span>
                <span className="text-[10px]">Pilih kartu untuk melompat ke hasil</span>
              </div>
              
              <div 
                ref={leftScrollRef}
                className="h-[580px] overflow-y-auto pr-2 flex flex-col gap-6"
              >
                {results.map((page) => (
                  <div
                    key={page.page}
                    onClick={() => handlePageSelect(page.page)}
                    className={`p-4 bg-neo-bg rounded-neo border cursor-pointer transition-all duration-300 relative group flex flex-col gap-3 ${
                      activePage === page.page 
                        ? 'border-indigo-400 shadow-neo-pressed scale-[0.99]' 
                        : 'border-white/50 shadow-neo-btn hover:shadow-neo-btn-hover'
                    }`}
                  >
                    {/* Header Info */}
                    <div className="flex justify-between items-center text-[10px] font-bold text-neo-muted">
                      <span>Halaman {page.page}</span>
                      
                      {/* Badge Source */}
                      <span className={`px-2 py-0.5 rounded-full border ${
                        page.source === 'text_layer'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
                          : page.source === 'ocr'
                          ? 'bg-indigo-500/10 text-indigo-600 border-indigo-200'
                          : 'bg-rose-500/10 text-rose-600 border-rose-200'
                      }`}>
                        {page.source === 'text_layer' ? 'Text Layer' : page.source === 'ocr' ? 'PaddleOCR' : 'Error'}
                      </span>
                    </div>

                    {/* Image Page Container */}
                    {page.preview_image ? (
                      <div className="w-full aspect-[4/3] bg-neo-bg rounded-neo border border-neo-shadow/20 shadow-neo-pressed overflow-hidden relative group">
                        <img 
                          id={`pdf-page-img-${page.page}`}
                          src={page.preview_image} 
                          alt={`Page ${page.page}`}
                          className="w-full h-full object-contain p-1"
                          onLoad={(e) => {
                            const target = e.target as HTMLImageElement;
                            setPageImgDims(prev => ({
                              ...prev,
                              [page.page]: { width: target.naturalWidth, height: target.naturalHeight }
                            }));
                          }}
                        />
                        
                        {/* Interactive Bounding Box SVGs (Sync Highlight) */}
                        {pageImgDims[page.page] && page.blocks && page.blocks.length > 0 && (
                          <svg
                            viewBox={`0 0 ${pageImgDims[page.page].width} ${pageImgDims[page.page].height}`}
                            className="absolute top-0 left-0 w-full h-full pointer-events-none p-1"
                            style={{ objectFit: 'contain' }}
                          >
                            {page.blocks.map((block, idx) => {
                              if (!block.box || block.box.length < 4) return null;
                              const pointsString = block.box.map((pt: any) => `${pt[0]},${pt[1]}`).join(' ');
                              const isHovered = hoveredIndex === idx;
                              const isSelected = selectedIndex === idx;
                              const isActive = isHovered || isSelected;

                              return (
                                <polygon
                                  key={idx}
                                  points={pointsString}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedIndex(isSelected ? null : idx);
                                  }}
                                  onMouseEnter={() => setHoveredIndex(idx)}
                                  onMouseLeave={() => setHoveredIndex(null)}
                                  className={`transition-all duration-200 cursor-pointer pointer-events-auto ${
                                    isActive
                                      ? 'fill-indigo-600/35 stroke-indigo-600 stroke-[3.5px]'
                                      : 'fill-indigo-500/5 stroke-indigo-500/35 stroke-[1px]'
                                  }`}
                                />
                              );
                            })}
                          </svg>
                        )}

                        {/* Zoom Action overlay */}
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullscreenImage(page.preview_image);
                            }}
                            className="p-2.5 bg-neo-bg text-indigo-600 rounded-full shadow-neo-btn border border-white hover:scale-105 transition-all duration-200 pointer-events-auto"
                            title="Tampilan Penuh"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-[4/3] bg-neo-bg rounded-neo border border-neo-shadow/20 shadow-neo-pressed flex flex-col items-center justify-center text-rose-500 text-[10px] font-bold gap-2">
                        <AlertTriangle className="w-6 h-6" />
                        <span>Halaman ini gagal diproses</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Panel Kanan: Hasil Teks (OcrEditor) */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="px-1 flex justify-between items-center text-xs font-bold text-neo-muted">
                <span>Editor Hasil Ekstraksi Halaman</span>
                <span className="text-[10px]">Halaman Terpilih: {activePage} / {results.length}</span>
              </div>
              
              <div className="h-[580px] overflow-y-auto pr-2 flex flex-col gap-6 bg-neo-bg rounded-neo border border-white/50 shadow-neo-card p-4">
                <OcrEditor
                  blocks={results[activePage - 1]?.blocks || []}
                  onChangeBlocks={handleUpdateBlocks}
                  hoveredIndex={hoveredIndex}
                  selectedIndex={selectedIndex}
                  onSelectBlock={setSelectedIndex}
                  onHoverBlock={setHoveredIndex}
                  onShowToast={onShowToast}
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Dialog Popup */}
      <ConfirmationDialog
        isOpen={isConfirmOpen}
        title={confirmTitle}
        message={confirmMsg}
        onConfirm={() => {
          setIsConfirmOpen(false);
          if (confirmAction) confirmAction();
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />

      {/* Loading overlay during process */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-neo-shadow/20 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-full bg-neo-bg shadow-neo-card border border-white flex items-center justify-center text-indigo-600 animate-spin-slow">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <span className="text-xs font-extrabold text-indigo-700 bg-neo-bg shadow-neo-btn border border-white px-4 py-2 rounded-full">
            Sedang Memproses Dokumen PDF...
          </span>
        </div>
      )}

      {/* Fullscreen Page Preview Modal (Zoomable) */}
      {fullscreenImage && (
        <PDFPageZoomViewer
          imageUrl={fullscreenImage}
          onClose={() => setFullscreenImage(null)}
        />
      )}

    </div>
  );
};

interface PDFPageZoomViewerProps {
  imageUrl: string;
  onClose: () => void;
}

const PDFPageZoomViewer: React.FC<PDFPageZoomViewerProps> = ({ imageUrl, onClose }) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const isDraggingRef = useRef(isDragging);
  const dragStartRef = useRef(dragStart);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
    isDraggingRef.current = isDragging;
    dragStartRef.current = dragStart;
  }, [zoom, pan, isDragging, dragStart]);

  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 0.15;
      setZoom((prevZoom) => {
        let nextZoom = prevZoom;
        if (e.deltaY < 0) {
          nextZoom = Math.min(prevZoom + zoomFactor, 4);
        } else {
          nextZoom = Math.max(prevZoom - zoomFactor, 0.5);
        }
        if (nextZoom === 1) setPan({ x: 0, y: 0 });
        return nextZoom;
      });
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartDistRef.current = dist;
        touchStartZoomRef.current = zoomRef.current;
        setIsDragging(false);
      } else if (e.touches.length === 1) {
        if (zoomRef.current <= 1) return;
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - panRef.current.x,
          y: e.touches[0].clientY - panRef.current.y,
        });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistRef.current !== null) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / touchStartDistRef.current;
        const nextZoom = Math.min(Math.max(touchStartZoomRef.current * factor, 0.5), 4);
        setZoom(nextZoom);
        if (nextZoom === 1) setPan({ x: 0, y: 0 });
      } else if (e.touches.length === 1 && isDraggingRef.current) {
        e.preventDefault();
        setPan({
          x: e.touches[0].clientX - dragStartRef.current.x,
          y: e.touches[0].clientY - dragStartRef.current.y,
        });
      }
    };

    const handleTouchEnd = () => {
      touchStartDistRef.current = null;
      setIsDragging(false);
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => {
    setZoom((z) => {
      const nextZoom = Math.max(z - 0.25, 0.5);
      if (nextZoom === 1) setPan({ x: 0, y: 0 });
      return nextZoom;
    });
  };
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-neo-bg rounded-neo p-6 shadow-neo-card border border-white/60 flex flex-col gap-4 animate-scale-in">
        
        {/* Header with Zoom Controls */}
        <div className="flex justify-between items-center mr-12">
          <h4 className="text-xs font-extrabold text-neo-text uppercase tracking-wider">Pratinjau Halaman Dokumen</h4>
          
          <div className="flex gap-2 bg-neo-bg shadow-neo-btn border border-white/40 p-1 rounded-full">
            <button
              onClick={handleZoomIn}
              title="Perbesar"
              className="p-2 rounded-full text-neo-muted hover:text-indigo-600 hover:bg-neo-shadow/30 transition-all duration-200"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              title="Perkecil"
              className="p-2 rounded-full text-neo-muted hover:text-indigo-600 hover:bg-neo-shadow/30 transition-all duration-200"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              title="Reset"
              className="p-2 rounded-full text-neo-muted hover:text-indigo-600 hover:bg-neo-shadow/30 transition-all duration-200"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-neo-muted hover:text-rose-500 border border-white transition-all duration-200"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Image Viewport Container */}
        <div
          ref={viewportRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full aspect-[4/3] overflow-hidden rounded-neo neo-inset border border-white/40 bg-neo-shadow/10 flex items-center justify-center relative ${
            zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
        >
          <div
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
            }}
            className="relative max-w-full max-h-full flex items-center justify-center transform-gpu"
          >
            <img
              src={imageUrl}
              alt="Page Preview Zoom"
              className="max-w-full max-h-[70vh] object-contain pointer-events-none select-none rounded-neo"
            />
          </div>
        </div>
        
        <div className="text-[10px] text-neo-muted text-center">
          Gunakan cubitan (pinch) pada layar sentuh atau scroll mouse untuk memperbesar gambar, lalu geser untuk memindahkan.
        </div>

      </div>
    </div>
  );
};
