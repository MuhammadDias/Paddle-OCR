import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, Eye, EyeOff, X } from 'lucide-react';
import { loginUser, registerUser } from '../services/api';

interface AuthCardProps {
  onSuccess: (token: string, email: string) => void;
  onClose: () => void;
}

export const AuthCard: React.FC<AuthCardProps> = ({ onSuccess, onClose }) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Harap isi semua kolom input.');
      return;
    }
    if (!email.includes('@')) {
      setError('Format email tidak valid.');
      return;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal terdiri dari 6 karakter.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const response = await loginUser(email, password);
        onSuccess(response.access_token, response.user.email);
      } else {
        const response = await registerUser(email, password);
        onSuccess(response.access_token, response.user.email);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const errMsg = err.response?.data?.detail || 'Terjadi kesalahan otentikasi. Silakan periksa koneksi Anda.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neo-shadow/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-neo-bg rounded-neo p-6 shadow-neo-card border border-white/60 relative flex flex-col gap-6 animate-scale-in">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-neo-muted hover:text-rose-500 border border-white/50 transition-all duration-200"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="text-center flex flex-col gap-1 mt-2">
          <h3 className="text-xl font-extrabold text-neo-text">
            {isLogin ? 'Masuk Akun' : 'Daftar Akun'}
          </h3>
          <p className="text-xs text-neo-muted">
            {isLogin 
              ? 'Silakan masuk untuk mencatat riwayat pemindaian Anda' 
              : 'Daftarkan email Anda untuk mulai mengelola riwayat OCR'
            }
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 rounded-neo border border-rose-200 text-xs font-bold text-rose-600 animate-shake text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Email input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-neo-muted uppercase tracking-wider ml-1">Email</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-4 w-4 h-4 text-neo-muted" />
              <input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full pl-11 pr-4 py-3 bg-neo-bg shadow-neo-pressed rounded-neo border border-white/30 text-sm text-neo-text focus:outline-none focus:border-indigo-400 transition-all duration-200"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-neo-muted uppercase tracking-wider ml-1">Kata Sandi</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 w-4 h-4 text-neo-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-11 pr-11 py-3 bg-neo-bg shadow-neo-pressed rounded-neo border border-white/30 text-sm text-neo-text focus:outline-none focus:border-indigo-400 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute right-4 text-neo-muted hover:text-neo-text transition-all duration-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover rounded-neo border border-white/50 text-sm font-extrabold text-indigo-600 flex items-center justify-center gap-2 hover:scale-[1.01] active:shadow-neo-pressed transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-t-indigo-600 border-indigo-200 animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Masuk Sekarang</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Daftar Akun Baru</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="text-center text-xs text-neo-muted border-t border-neo-shadow/20 pt-4">
          {isLogin ? 'Belum memiliki akun?' : 'Sudah memiliki akun?'}{' '}
          <button
            type="button"
            onClick={toggleMode}
            disabled={loading}
            className="font-bold text-indigo-600 hover:underline hover:text-indigo-700 transition-all duration-200"
          >
            {isLogin ? 'Daftar di sini' : 'Masuk di sini'}
          </button>
        </div>

      </div>
    </div>
  );
};
