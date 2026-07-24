import React from 'react';
import { Scan, ArrowRight, Zap, Sliders, FileJson, ShieldCheck, ShieldAlert, Key, History, Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface LandingPageProps {
  onEnterWorkspace: () => void;
  status: 'online' | 'offline' | 'loading';
  device: string;
  isLoggedIn: boolean;
  userEmail: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterWorkspace,
  status,
  device,
  isLoggedIn,
  userEmail,
}) => {
  const features = [
    {
      title: 'Akselerasi GPU CUDA',
      desc: 'Memanfaatkan kartu grafis NVIDIA untuk inferensi neural network berkecepatan tinggi, memproses teks dalam hitungan milidetik.',
      icon: <Zap className="w-6 h-6 text-indigo-500" />,
    },
    {
      title: 'Enhancement Adaptif',
      desc: 'OpenCV otomatis mendeteksi kategori gambar untuk koreksi kemiringan (deskew), pembersihan derau, dan penajaman kontur teks.',
      icon: <Sliders className="w-6 h-6 text-indigo-500" />,
    },
    {
      title: 'Ekstraksi Entitas Cerdas',
      desc: 'Mengenali otomatis data penting seperti mata uang (Rupiah/USD), nomor telepon, email, dan tautan web dari hasil pemindaian.',
      icon: <Search className="w-6 h-6 text-indigo-500" />,
    },
    {
      title: 'Autentikasi Sempurna',
      desc: 'Masuk secara aman menggunakan email dan kata sandi untuk melindungi data serta sinkronisasi aktivitas pemindaian.',
      icon: <Key className="w-6 h-6 text-indigo-500" />,
    },
    {
      title: 'Riwayat Retensi 24 Jam',
      desc: 'Aktivitas pemindaian dicatat rapi dan otomatis terhapus secara permanen setelah 1 hari untuk menjamin keamanan privasi Anda.',
      icon: <History className="w-6 h-6 text-indigo-500" />,
    },
    {
      title: 'Ekspor Terstruktur',
      desc: 'Simpan hasil bacaan langsung sebagai dokumen teks alami (.txt) atau skema data JSON lengkap dengan koordinat koordinat kotak deteksi.',
      icon: <FileJson className="w-6 h-6 text-indigo-500" />,
    },
  ];

  return (
    <div className="w-full flex flex-col gap-16 py-8 items-center max-w-5xl mx-auto px-4">
      {/* Hero Section */}
      <div className="flex flex-col items-center gap-8 text-center mt-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-20 h-20 rounded-full bg-neo-bg shadow-neo-card flex items-center justify-center text-indigo-600 border border-white/60 relative animate-pulse-slow"
        >
          <Scan className="w-10 h-10" />
          {status === 'online' && (
            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-neo-bg animate-pulse" />
          )}
        </motion.div>

        <div className="flex flex-col gap-3 max-w-3xl">
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neo-text leading-tight"
          >
            Deteksi dan Ekstrak Teks Gambar Secara Presisi
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-sm md:text-base text-neo-muted leading-relaxed max-w-2xl mx-auto"
          >
            Mengintegrasikan OpenCV Image Preprocessing adaptif dan PaddleOCR arsitektur PaddleX untuk akurasi pembacaan teks tingkat tinggi dalam Bahasa Indonesia & Inggris.
          </motion.p>
        </div>

        {/* Live Status indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-3 px-6 py-3.5 bg-neo-bg shadow-neo-btn rounded-neo border border-white text-xs font-bold"
        >
          <div className="flex items-center gap-2">
            {status === 'online' ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-neo-text">
                  Status: Online | Akselerasi Hardware: <span className="text-indigo-600 uppercase">{device}</span>
                </span>
              </>
            ) : status === 'loading' ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-t-indigo-600 border-indigo-200 animate-spin" />
                <span className="text-neo-muted">Menghubungkan ke server lokal...</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span className="text-rose-600">Status: Server Offline (Silakan jalankan backend server.py)</span>
              </>
            )}
          </div>
          
          {isLoggedIn && userEmail && (
            <div className="sm:border-l sm:border-neo-shadow/45 sm:pl-3 text-indigo-600">
              Pengguna aktif: <span className="underline">{userEmail}</span>
            </div>
          )}
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-2"
        >
          <button
            onClick={onEnterWorkspace}
            className="flex items-center gap-3 px-8 py-4 bg-neo-bg shadow-neo-card hover:shadow-neo-hover rounded-full text-base font-extrabold text-indigo-600 border-2 border-white transition-all duration-300 transform hover:scale-[1.01] active:shadow-neo-pressed"
          >
            <span>{isLoggedIn ? 'Buka OCR Workspace' : 'Mulai Ekstraksi Teks'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full mt-4">
        {features.map((feat, idx) => (
          <motion.div
            key={idx}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 + idx * 0.08, duration: 0.5 }}
            className="flex flex-col gap-3 p-6 bg-neo-bg rounded-neo shadow-neo-btn border border-white/50 hover:shadow-neo-btn-hover transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-full bg-neo-bg shadow-neo-btn flex items-center justify-center border border-white/40 mb-2">
              {feat.icon}
            </div>
            <h4 className="text-base font-bold text-neo-text">{feat.title}</h4>
            <p className="text-xs text-neo-muted leading-relaxed">{feat.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
