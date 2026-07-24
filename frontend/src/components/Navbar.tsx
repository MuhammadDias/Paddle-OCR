import React, { useState } from 'react';
import { Scan, Info, X, Cpu, Eye, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar: React.FC = () => {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <>
      <nav className="w-full py-4 px-6 md:px-12 flex justify-between items-center bg-neo-bg shadow-neo-flat rounded-b-neo border-b border-white/50 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neo-bg shadow-neo-btn flex items-center justify-center text-neo-primary border border-white/80">
            <Scan className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-neo-text">
            Paddle OCR
          </span>
        </div>
        <button
          onClick={() => setIsAboutOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover rounded-full text-sm font-medium text-neo-muted hover:text-neo-text border border-white/50 transition-all duration-200"
        >
          <Info className="w-4 h-4" />
          <span>About</span>
        </button>
      </nav>

      {/* About Modal */}
      <AnimatePresence>
        {isAboutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAboutOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-2xl bg-neo-bg rounded-neo p-8 shadow-neo-card border border-white/60 z-10 flex flex-col gap-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neo-bg shadow-neo-btn flex items-center justify-center text-neo-primary border border-white">
                    <Scan className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neo-text">Paddle OCR System</h3>
                    <p className="text-xs text-neo-muted">Sistem Optical Character Recognition Modular</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAboutOpen(false)}
                  className="p-2 rounded-full bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover hover:text-red-500 border border-white text-neo-muted transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-sm leading-relaxed text-neo-text flex flex-col gap-4">
                <p>
                  Sistem OCR modular berbasis Python yang diintegrasikan dengan antarmuka web modern. Proyek ini memisahkan logika pemrosesan tingkat rendah di backend dengan antarmuka neomorfik responsif di frontend.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div className="p-4 bg-neo-bg rounded-neo shadow-neo-btn border border-white flex flex-col gap-2">
                    <div className="text-neo-primary flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      <span className="font-semibold text-xs uppercase tracking-wider">Preprocessing</span>
                    </div>
                    <p className="text-xs text-neo-muted leading-normal">
                      Menggunakan filter adaptif OpenCV (Denoise, Deskew, CLAHE Contrast, Gaussian Threshold, Sharpen) sesuai klasifikasi gambar.
                    </p>
                  </div>

                  <div className="p-4 bg-neo-bg rounded-neo shadow-neo-btn border border-white flex flex-col gap-2">
                    <div className="text-neo-primary flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <span className="font-semibold text-xs uppercase tracking-wider">Detection & Rec</span>
                    </div>
                    <p className="text-xs text-neo-muted leading-normal">
                      Didukung oleh teknologi PaddleOCR versi terbaru dengan arsitektur PaddleX untuk deteksi box presisi tinggi dan pengenalan karakter.
                    </p>
                  </div>

                  <div className="p-4 bg-neo-bg rounded-neo shadow-neo-btn border border-white flex flex-col gap-2">
                    <div className="text-neo-primary flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      <span className="font-semibold text-xs uppercase tracking-wider">Postprocessing</span>
                    </div>
                    <p className="text-xs text-neo-muted leading-normal">
                      Merekonstruksi urutan baca alami (atas-bawah, kiri-kanan) dan membersihkan sisa spasi liar untuk hasil teks yang koheren.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-neo-shadow/50 pt-4 flex justify-between items-center text-xs text-neo-muted">
                <span>Teknologi: React + TypeScript + Vite + Tailwind + FastAPI</span>
                <span>Lisensi Bebas</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
