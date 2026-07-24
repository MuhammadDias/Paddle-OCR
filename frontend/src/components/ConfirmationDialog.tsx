import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Ya',
  cancelText = 'Batal',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-neo-bg rounded-neo p-6 shadow-neo-card border border-white/60 flex flex-col gap-4 animate-scale-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neo-bg shadow-neo-pressed flex items-center justify-center text-amber-500 border border-white/40 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-neo-text uppercase tracking-wider">{title}</h4>
            <p className="text-xs text-neo-muted mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover rounded-full text-xs font-bold text-neo-muted border border-white transition-all duration-200"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-rose-500 rounded-full text-xs font-bold border border-white hover:text-rose-600 transition-all duration-200"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
