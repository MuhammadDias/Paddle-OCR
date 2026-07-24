import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-6 text-center text-xs text-neo-muted bg-neo-bg border-t border-neo-shadow/20 mt-12">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
        <span>Paddle OCR - Sistem Pendeteksi Teks Modular</span>
        <span>Dibuat menggunakan React, Vite, Tailwind CSS, dan PaddlePaddle Backend</span>
      </div>
    </footer>
  );
};
