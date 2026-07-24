import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type,
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-indigo-600" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-emerald-200';
      case 'error':
        return 'border-red-200';
      case 'info':
      default:
        return 'border-indigo-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 p-4 bg-neo-bg border ${getBorderColor()} rounded-neo shadow-neo-card max-w-sm`}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <div className="flex-grow text-sm font-medium text-neo-text pr-2 leading-relaxed">
        {message}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded-full text-neo-muted hover:text-neo-text hover:bg-neo-shadow/30 transition-all duration-200"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
