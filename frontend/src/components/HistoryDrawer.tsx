import React, { useState, useEffect } from 'react';
import { X, Clock, ChevronRight, History, ShieldAlert, FileImage } from 'lucide-react';
import { getHistory } from '../services/api';
import type { HistoryItem, OCRResponse } from '../services/api';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem: (result: OCRResponse, filename: string) => void;
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  onSelectItem,
  onShowToast,
}) => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const items = await getHistory();
      setHistoryItems(items);
    } catch (err: any) {
      console.error('Failed to fetch history:', err);
      if (err.response?.status === 401) {
        onShowToast('Sesi telah kedaluwarsa. Silakan masuk kembali.', 'error');
      } else {
        onShowToast('Gagal memuat daftar riwayat.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr: string) => {
    try {
      // timeStr is standard SQLite TIMESTAMP: YYYY-MM-DD HH:MM:SS
      // SQLite returns UTC by default, let's parse and calculate difference
      const t = new Date(timeStr.replace(' ', 'T') + 'Z');
      const now = new Date();
      const diffMs = now.getTime() - t.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins} menit lalu`;
      if (diffHrs < 24) return `${diffHrs} jam lalu`;
      
      return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return timeStr;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-neo-shadow/30 backdrop-blur-sm">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Body */}
      <div className="w-full max-w-md bg-neo-bg h-screen shadow-neo-card border-l border-white/60 relative flex flex-col justify-between animate-slide-in z-10">
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-neo-shadow/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-neo-bg shadow-neo-btn flex items-center justify-center text-indigo-600 border border-white">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-neo-text">Riwayat Pemindaian</h4>
              <p className="text-[10px] text-neo-muted">Maksimal 24 jam terakhir</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-neo-muted hover:text-neo-text border border-white/50 transition-all duration-200"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative Alert for Auto Delete */}
        <div className="mx-5 mt-4 p-3 bg-indigo-50/20 rounded-neo border border-indigo-100 flex items-start gap-2.5 text-[10px] text-indigo-600 leading-normal">
          <ShieldAlert className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <span>Keamanan Terjamin: Demi privasi Anda, data riwayat pemindaian ini hanya bertahan selama 1 hari saja dan akan otomatis dihapus oleh sistem setelah masa retensi berakhir.</span>
        </div>

        {/* History Items Container */}
        <div className="flex-grow overflow-y-auto p-5 flex flex-col gap-4">
          {loading ? (
            <div className="flex-grow flex flex-col items-center justify-center gap-2 py-12">
              <div className="w-6 h-6 rounded-full border-2 border-t-indigo-600 border-indigo-200 animate-spin" />
              <span className="text-xs font-bold text-neo-muted">Memuat riwayat...</span>
            </div>
          ) : historyItems.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center gap-2 py-12 text-center">
              <History className="w-8 h-8 text-neo-shadow/60" />
              <span className="text-xs font-bold text-neo-muted">Belum ada riwayat pemindaian</span>
              <p className="text-[10px] text-neo-muted max-w-[200px]">Proses dokumen Anda di workspace dan riwayat akan muncul di sini.</p>
            </div>
          ) : (
            historyItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelectItem(item.ocr_result, item.filename);
                  onClose();
                }}
                className="w-full p-4 bg-neo-bg rounded-neo shadow-neo-btn hover:shadow-neo-btn-hover border border-white/50 text-left flex items-center justify-between group transition-all duration-200 hover:scale-[1.01] active:shadow-neo-pressed"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-neo-bg shadow-neo-pressed flex items-center justify-center text-indigo-400 group-hover:text-indigo-600 flex-shrink-0 border border-white/40 transition-all duration-200">
                    <FileImage className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-neo-text truncate group-hover:text-indigo-600 transition-colors duration-200">
                      {item.filename}
                    </h5>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-[9px] text-neo-muted">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(item.created_at)}</span>
                      </div>
                      <span className="text-[8px] bg-neo-shadow/30 px-1.5 py-0.5 rounded-full text-neo-muted font-semibold">
                        {item.ocr_result.stats.total_regions} Region
                      </span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-neo-muted group-hover:text-indigo-600 transform group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neo-shadow/20 text-center text-[9px] text-neo-muted bg-neo-shadow/5 rounded-b-neo">
          PaddleOCR Secure History System
        </div>
      </div>
    </div>
  );
};
