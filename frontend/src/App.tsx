import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Dropzone } from './components/Dropzone';
import { ImagePreview } from './components/ImagePreview';
import { OCRImageViewer } from './components/OCRImageViewer';
import { OCRResultList } from './components/OCRResultList';
import { StatsCard } from './components/StatsCard';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { Toast } from './components/Toast';
import type { ToastType } from './components/Toast';
import { processOCR, checkStatus } from './services/api';
import type { OCRResponse } from './services/api';
import { SystemDiagnostics } from './components/SystemDiagnostics';
import { LandingPage } from './components/LandingPage';
import { Image, ArrowLeft, RefreshCw } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrResponse, setOcrResponse] = useState<OCRResponse | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  // Backend status tracking
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'loading'>('loading');
  const [backendDevice, setBackendDevice] = useState<string>('...');

  // Navigation state
  const [view, setView] = useState<'landing' | 'workspace'>('landing');

  // Check backend status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await checkStatus();
        setBackendStatus(response.status === 'online' ? 'online' : 'offline');
        setBackendDevice(response.device);
      } catch (err) {
        console.error('Failed to connect to backend server:', err);
        setBackendStatus('offline');
        setBackendDevice('Tidak Aktif');
      }
    };
    fetchStatus();
  }, []);

  // Interactive highlighting states
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Clear URL helper on unmount or file change
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const handleShowToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  };

  const handleFileSelect = (selectedFile: File) => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setFile(selectedFile);
    setImageUrl(URL.createObjectURL(selectedFile));
    setOcrResponse(null);
    setSelectedIndex(null);
    setHoveredIndex(null);
    handleShowToast('Gambar berhasil diunggah. Siap memproses OCR.', 'success');
  };

  const handleRemoveImage = () => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setFile(null);
    setImageUrl(null);
    setOcrResponse(null);
    setSelectedIndex(null);
    setHoveredIndex(null);
  };

  const handleRunOCR = async () => {
    if (!file) return;
    setProcessing(true);
    setOcrResponse(null);
    setSelectedIndex(null);
    setHoveredIndex(null);

    try {
      const response = await processOCR(file);
      setOcrResponse(response);
      handleShowToast('Pemrosesan OCR selesai dengan sukses.', 'success');
    } catch (error: any) {
      console.error('OCR API Error:', error);
      const errMsg = error.response?.data?.detail || 'Terjadi kegagalan koneksi atau pemrosesan OCR pada backend.';
      handleShowToast(errMsg, 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-neo-bg text-neo-text flex flex-col justify-between selection:bg-indigo-200">
      <div className="w-full flex flex-col gap-8 pb-12">
        <Navbar onLogoClick={() => setView('landing')} />

        <main className="max-w-6xl w-full mx-auto px-4 md:px-8 flex flex-col gap-8 items-center">
          
          {/* Main Workspace */}
          {/* Navigation View Routing */}
          {view === 'landing' ? (
            <LandingPage
              onEnterWorkspace={() => setView('workspace')}
              status={backendStatus}
              device={backendDevice}
            />
          ) : (
            /* Main Workspace */
            <div className="w-full flex flex-col gap-8">
              {!file ? (
                /* Dashboard Workspace Page */
                <div className="w-full flex flex-col gap-10 mt-4">
                  {/* Hero Banner Section */}
                  <div className="text-center flex flex-col gap-3 relative">
                    <button
                      onClick={() => setView('landing')}
                      className="absolute left-0 top-1/2 -translate-y-1/2 p-2.5 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-neo-muted hover:text-neo-text border border-white/50 rounded-full transition-all duration-200"
                      title="Kembali ke Beranda"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h2 className="text-3xl font-extrabold tracking-tight text-neo-text sm:text-4xl">
                      Sistem OCR Workspace
                    </h2>
                    <p className="text-sm text-neo-muted max-w-xl mx-auto leading-relaxed">
                      Ekstraksi teks gambar terintegrasi dengan penyesuaian filter OpenCV adaptif secara lokal.
                    </p>
                  </div>

                  {/* Workspace Dashboard Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-stretch">
                    {/* Column 1: System Diagnostics */}
                    <div className="lg:col-span-5 w-full">
                      <SystemDiagnostics status={backendStatus} device={backendDevice} />
                    </div>

                    {/* Column 2: Upload Area */}
                    <div className="lg:col-span-7 w-full flex flex-col gap-6 justify-center">
                      <div className="bg-neo-bg rounded-neo p-6 shadow-neo-card border border-white/50 flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <h4 className="text-sm font-bold text-neo-text">Mulai Deteksi Teks</h4>
                          <p className="text-[10px] text-neo-muted">Seret berkas gambar Anda ke kotak di bawah</p>
                        </div>
                        <Dropzone onFileSelect={handleFileSelect} onError={(msg) => handleShowToast(msg, 'error')} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* File Loaded Screen */
                <div className="w-full flex flex-col gap-8">
                  
                  {/* Image Preview & Upload Details (Visible when not processed yet OR during processing) */}
                  {!ocrResponse && (
                    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleRemoveImage}
                          disabled={processing}
                          className="p-2 rounded-full bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-neo-muted hover:text-neo-text border border-white/50 transition-all duration-200 disabled:opacity-50"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-neo-muted uppercase tracking-wider">
                          Kembali ke Unggahan
                        </span>
                      </div>

                      <ImagePreview
                        file={file}
                        onProcess={handleRunOCR}
                        onRemove={handleRemoveImage}
                        onChangeImage={handleRemoveImage} // will redirect back to dropzone
                        processing={processing}
                      />
                    </div>
                  )}

                  {/* Loader Skeleton during API call */}
                  {processing && (
                    <div className="w-full mt-4 flex flex-col gap-6">
                      <div className="w-full flex items-center justify-center py-4 gap-3 bg-neo-bg rounded-neo border border-white/60 shadow-neo-pressed text-sm text-indigo-600 font-bold">
                        <div className="w-4 h-4 rounded-full border-2 border-t-indigo-600 border-indigo-200 animate-spin" />
                        <span>Mengekstrak teks dengan PaddleOCR...</span>
                      </div>
                      <LoadingSkeleton />
                    </div>
                  )}

                  {/* OCR Results Display */}
                  {ocrResponse && !processing && (
                    <div className="w-full flex flex-col gap-8">
                      {/* Result Header Navigation */}
                      <div className="flex flex-wrap justify-between items-center gap-4 bg-neo-bg p-4 rounded-neo shadow-neo-flat border border-white/60">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-neo-bg shadow-neo-btn flex items-center justify-center text-indigo-600 border border-white">
                            <Image className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-neo-text">Hasil Pemrosesan OCR</h4>
                            <p className="text-[10px] text-neo-muted">Analisis deteksi dan klasifikasi selesai</p>
                          </div>
                        </div>

                        <button
                          onClick={handleRemoveImage}
                          className="flex items-center gap-2 px-4 py-2.5 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover text-xs font-bold text-indigo-600 rounded-full border border-white transition-all duration-200"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Proses Gambar Lain</span>
                        </button>
                      </div>

                      {/* Dashboard Stats */}
                      <StatsCard stats={ocrResponse.stats} />

                      {/* Dual Panel Layout */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start">
                        
                        {/* Left Column: Interactive Image Viewer */}
                        <div className="lg:col-span-7 w-full">
                          {imageUrl && (
                            <OCRImageViewer
                              imageUrl={imageUrl}
                              annotatedImageUrl={ocrResponse.annotated_image}
                              regions={ocrResponse.text_regions}
                              hoveredIndex={hoveredIndex}
                              selectedIndex={selectedIndex}
                              onSelectRegion={setSelectedIndex}
                              onHoverRegion={setHoveredIndex}
                            />
                          )}
                        </div>

                        {/* Right Column: Searchable Text List */}
                        <div className="lg:col-span-5 w-full">
                          <OCRResultList
                            regions={ocrResponse.text_regions}
                            hoveredIndex={hoveredIndex}
                            selectedIndex={selectedIndex}
                            onHoverRegion={setHoveredIndex}
                            onSelectRegion={setSelectedIndex}
                            onShowToast={handleShowToast}
                          />
                        </div>

                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

        </main>
      </div>

      <Footer />

      {/* Floating Toast Alerts */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;
