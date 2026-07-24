import React, { useCallback } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { UploadCloud, FileImage } from 'lucide-react';
import { motion } from 'framer-motion';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  onError,
  disabled = false,
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (disabled) return;

      if (fileRejections.length > 0) {
        const rejection = fileRejections[0];
        const error = rejection.errors[0];

        if (error.code === 'file-too-large') {
          onError(`Ukuran file terlalu besar. Maksimal ukuran adalah ${MAX_SIZE_MB} MB.`);
        } else if (error.code === 'file-invalid-type') {
          onError('Format file tidak didukung. Silakan gunakan JPG, JPEG, PNG, atau WEBP.');
        } else {
          onError(error.message);
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect, onError, disabled]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    maxSize: MAX_SIZE_BYTES,
    multiple: false,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`w-full cursor-pointer outline-none select-none transition-all duration-300 rounded-neo ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <input {...getInputProps()} />
      <motion.div
        animate={{
          scale: isDragActive ? 1.01 : 1,
        }}
        transition={{ duration: 0.2 }}
        className={`w-full py-12 px-6 flex flex-col items-center justify-center gap-4 bg-neo-bg rounded-neo border-2 border-dashed transition-all duration-300 ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-500/5 shadow-neo-pressed'
            : 'border-neo-shadow hover:border-indigo-400 shadow-neo-flat hover:shadow-neo-hover'
        } border-white/40`}
      >
        <div
          className={`w-16 h-16 rounded-full bg-neo-bg shadow-neo-btn flex items-center justify-center text-neo-muted transition-all duration-300 ${
            isDragActive ? 'text-indigo-600 shadow-neo-pressed' : ''
          }`}
        >
          {isDragActive ? (
            <FileImage className="w-8 h-8 animate-bounce text-indigo-500" />
          ) : (
            <UploadCloud className="w-8 h-8 text-neo-muted" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-neo-text">
            {isDragActive ? 'Lepaskan file di sini' : 'Tarik dan lepaskan gambar di sini'}
          </p>
          <p className="text-xs text-neo-muted mt-1">
            atau klik untuk memilih file dari komputer
          </p>
        </div>
        <div className="text-[10px] text-neo-muted bg-neo-shadow/30 px-3 py-1 rounded-full border border-white/50">
          JPG, JPEG, PNG, WEBP (Maksimal {MAX_SIZE_MB} MB)
        </div>
      </motion.div>
    </div>
  );
};
