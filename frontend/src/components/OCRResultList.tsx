import React, { useState, useMemo } from 'react';
import { 
  Sparkles, ListFilter, DollarSign, Phone, Mail, 
  Globe, ExternalLink, Check, Copy 
} from 'lucide-react';
import type { TextRegion, Entities } from '../services/api';
import { OcrEditor } from './OcrEditor';

interface OCRResultListProps {
  regions: TextRegion[];
  onChangeRegions: (updatedRegions: TextRegion[]) => void;
  entities?: Entities;
  hoveredIndex: number | null;
  selectedIndex: number | null;
  onHoverRegion: (index: number | null) => void;
  onSelectRegion: (index: number | null) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const OCRResultList: React.FC<OCRResultListProps> = ({
  regions,
  onChangeRegions,
  entities,
  hoveredIndex,
  selectedIndex,
  onHoverRegion,
  onSelectRegion,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'ocr' | 'entities'>('ocr');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Total count of detected entities
  const totalEntities = useMemo(() => {
    if (!entities) return 0;
    return (
      (entities.currencies?.length || 0) +
      (entities.phones?.length || 0) +
      (entities.emails?.length || 0) +
      (entities.urls?.length || 0)
    );
  }, [entities]);

  // Copy helper for entities
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(text);
      onShowToast('Teks berhasil disalin ke clipboard.', 'success');
      setTimeout(() => setCopiedText(null), 2000);
    }).catch(() => {
      onShowToast('Gagal menyalin teks.', 'error');
    });
  };

  return (
    <div className="w-full bg-neo-bg rounded-neo p-6 shadow-neo-card border border-white/50 flex flex-col gap-6 h-full">
      
      {/* Tab Switcher Header */}
      <div className="flex bg-neo-bg p-1.5 rounded-full shadow-neo-pressed border border-white/30">
        <button
          onClick={() => setActiveTab('ocr')}
          className={`flex-1 py-2.5 px-4 rounded-full text-xs font-extrabold flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'ocr'
              ? 'bg-neo-bg shadow-neo-btn text-indigo-600 border border-white'
              : 'text-neo-muted hover:text-neo-text'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>Editor OCR ({regions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('entities')}
          className={`flex-1 py-2.5 px-4 rounded-full text-xs font-extrabold flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'entities'
              ? 'bg-neo-bg shadow-neo-btn text-indigo-600 border border-white'
              : 'text-neo-muted hover:text-neo-text'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span>Entitas Cerdas ({totalEntities})</span>
        </button>
      </div>

      {/* Tab 1 Content: OCR Editor */}
      {activeTab === 'ocr' && (
        <OcrEditor
          blocks={regions}
          onChangeBlocks={onChangeRegions}
          hoveredIndex={hoveredIndex}
          selectedIndex={selectedIndex}
          onSelectBlock={onSelectRegion}
          onHoverBlock={onHoverRegion}
          onShowToast={onShowToast}
        />
      )}

      {/* Tab 2 Content: Smart Entity Extraction */}
      {activeTab === 'entities' && (
        <div className="flex-grow flex flex-col gap-5 overflow-y-auto max-h-[500px] pr-2 scrollbar-thin">
          
          {totalEntities === 0 ? (
            <div className="w-full py-16 flex flex-col items-center justify-center gap-2 border border-dashed border-neo-shadow/60 rounded-neo bg-neo-shadow/5 text-center">
              <Sparkles className="w-8 h-8 text-neo-shadow/60" />
              <span className="text-sm font-semibold text-neo-muted">Tidak ada entitas khusus terdeteksi</span>
              <span className="text-xs text-neo-muted/60">Dokumen tidak memuat pola mata uang, nomor telp, email, atau link</span>
            </div>
          ) : (
            <>
              {/* Currency Section */}
              {entities?.currencies && entities.currencies.length > 0 && (
                <div className="flex flex-col gap-2.5 p-4 bg-neo-bg rounded-neo shadow-neo-btn border border-white/50">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-600">
                    <DollarSign className="w-4 h-4" />
                    <span>Mata Uang & Harga ({entities.currencies.length})</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {entities.currencies.map((curr, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-neo-bg rounded-neo shadow-neo-pressed border border-white/30 text-xs font-bold text-neo-text">
                        <span>{curr}</span>
                        <button
                          onClick={() => handleCopyText(curr)}
                          className="p-1.5 rounded-full hover:bg-neo-shadow/30 text-neo-muted hover:text-indigo-600 transition-all"
                          title="Salin Nilai"
                        >
                          {copiedText === curr ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phone Numbers Section */}
              {entities?.phones && entities.phones.length > 0 && (
                <div className="flex flex-col gap-2.5 p-4 bg-neo-bg rounded-neo shadow-neo-btn border border-white/50">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-600">
                    <Phone className="w-4 h-4" />
                    <span>Nomor Telepon ({entities.phones.length})</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {entities.phones.map((phone, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-neo-bg rounded-neo shadow-neo-pressed border border-white/30 text-xs font-bold text-neo-text">
                        <span>{phone}</span>
                        <button
                          onClick={() => handleCopyText(phone)}
                          className="p-1.5 rounded-full hover:bg-neo-shadow/30 text-neo-muted hover:text-indigo-600 transition-all"
                          title="Salin Nomor"
                        >
                          {copiedText === phone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Emails Section */}
              {entities?.emails && entities.emails.length > 0 && (
                <div className="flex flex-col gap-2.5 p-4 bg-neo-bg rounded-neo shadow-neo-btn border border-white/50">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-amber-600">
                    <Mail className="w-4 h-4" />
                    <span>Alamat Email ({entities.emails.length})</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {entities.emails.map((email, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-neo-bg rounded-neo shadow-neo-pressed border border-white/30 text-xs font-bold text-neo-text">
                        <span>{email}</span>
                        <button
                          onClick={() => handleCopyText(email)}
                          className="p-1.5 rounded-full hover:bg-neo-shadow/30 text-neo-muted hover:text-indigo-600 transition-all"
                          title="Salin Email"
                        >
                          {copiedText === email ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Web Links / URLs Section */}
              {entities?.urls && entities.urls.length > 0 && (
                <div className="flex flex-col gap-2.5 p-4 bg-neo-bg rounded-neo shadow-neo-btn border border-white/50">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-blue-600">
                    <Globe className="w-4 h-4" />
                    <span>Tautan Web / URL ({entities.urls.length})</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {entities.urls.map((url, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-neo-bg rounded-neo shadow-neo-pressed border border-white/30 text-xs font-bold text-neo-text">
                        <span className="truncate max-w-[200px]">{url}</span>
                        <div className="flex items-center gap-1">
                          <a
                            href={url.startsWith('http') ? url : `https://${url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-full hover:bg-neo-shadow/30 text-neo-muted hover:text-blue-600 transition-all"
                            title="Buka Link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => handleCopyText(url)}
                            className="p-1.5 rounded-full hover:bg-neo-shadow/30 text-neo-muted hover:text-indigo-600 transition-all"
                            title="Salin Link"
                          >
                            {copiedText === url ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      )}

    </div>
  );
};
