import React from 'react';
import { ShieldAlert, ShieldCheck, Cpu, Sliders, Server, Code } from 'lucide-react';

interface SystemDiagnosticsProps {
  status: 'online' | 'offline' | 'loading';
  device: string;
}

export const SystemDiagnostics: React.FC<SystemDiagnosticsProps> = ({
  status,
  device,
}) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'online':
        return {
          text: 'Terhubung',
          colorClass: 'text-emerald-600',
          bgClass: 'bg-emerald-500/10',
          icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
        };
      case 'offline':
        return {
          text: 'Terputus',
          colorClass: 'text-rose-600',
          bgClass: 'bg-rose-500/10',
          icon: <ShieldAlert className="w-5 h-5 text-rose-600" />,
        };
      case 'loading':
      default:
        return {
          text: 'Menghubungkan...',
          colorClass: 'text-amber-600',
          bgClass: 'bg-amber-500/10',
          icon: <div className="w-4 h-4 rounded-full border-2 border-t-amber-600 border-amber-200 animate-spin" />,
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  const profiles = [
    { name: 'Document', desc: 'Scan / Kertas', rules: ['Deskew', 'CLAHE Contrast', 'Adaptive Threshold', 'Upscaling'] },
    { name: 'Screenshot', desc: 'WhatsApp / Web', rules: ['Direct Pass (Clean Raw Render)', 'No Denoise/Deskew'] },
    { name: 'Camera capture', desc: 'Foto Handheld / Indoor', rules: ['Denoise', 'Deskew', 'Contrast', 'Sharpening'] },
    { name: 'Outdoor capture', desc: 'Signage / Poster', rules: ['Denoise', 'Deskew', 'Contrast', 'Sharpening'] },
  ];

  return (
    <div className="w-full bg-neo-bg rounded-neo p-6 shadow-neo-card border border-white/50 flex flex-col gap-6 h-full justify-between">
      <div className="flex flex-col gap-6">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neo-bg shadow-neo-btn flex items-center justify-center text-indigo-600 border border-white">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-neo-text">Diagnostik & Status Sistem</h3>
            <p className="text-[10px] text-neo-muted">Spesifikasi mesin OCR yang aktif</p>
          </div>
        </div>

        {/* Live Diagnostics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Connection Status Card */}
          <div className="p-4 bg-neo-bg rounded-neo shadow-neo-btn border border-white/40 flex flex-col gap-2">
            <span className="text-[9px] uppercase font-bold tracking-wider text-neo-muted">Koneksi Backend</span>
            <div className="flex items-center gap-2 mt-1">
              {statusDisplay.icon}
              <span className={`text-sm font-extrabold ${statusDisplay.colorClass}`}>
                {statusDisplay.text}
              </span>
            </div>
          </div>

          {/* Compute Acceleration Card */}
          <div className="p-4 bg-neo-bg rounded-neo shadow-neo-btn border border-white/40 flex flex-col gap-2">
            <span className="text-[9px] uppercase font-bold tracking-wider text-neo-muted">Akselerasi Perangkat</span>
            <div className="flex items-center gap-2 mt-1">
              <Cpu className="w-5 h-5 text-indigo-500" />
              <span className="text-sm font-extrabold text-neo-text">
                {status === 'online' ? device : 'Tidak Aktif'}
              </span>
            </div>
          </div>
        </div>

        {/* Active Preprocessing Profiles */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-neo-muted border-b border-neo-shadow/20 pb-2">
            <Sliders className="w-3.5 h-3.5 text-indigo-500" />
            <span>Profil Pemrosesan Gambar Adaptif (OpenCV)</span>
          </div>

          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {profiles.map((prof, idx) => (
              <div key={idx} className="p-3 bg-neo-bg rounded-neo shadow-neo-pressed border border-white/30 text-[10px] flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-neo-text">{prof.name}</span>
                  <span className="text-neo-muted text-[9px]">{prof.desc}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {prof.rules.map((rule, rIdx) => (
                    <span key={rIdx} className="px-2 py-0.5 bg-neo-shadow/40 rounded-full text-neo-muted border border-white/60">
                      {rule}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Backend Engine Footer Details */}
      <div className="border-t border-neo-shadow/20 pt-4 flex items-center gap-2 text-[9px] text-neo-muted">
        <Code className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
        <span>PaddleOCR v3.x | PaddlePaddle (CUDA 12.6/12.7) | OpenCV 4.9+ | Tanpa Tesseract</span>
      </div>
    </div>
  );
};
