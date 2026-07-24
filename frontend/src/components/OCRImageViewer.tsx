import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize, Download, Minimize } from 'lucide-react';
import type { TextRegion } from '../services/api';

interface OCRImageViewerProps {
  imageUrl: string;
  annotatedImageUrl: string;
  regions: TextRegion[];
  hoveredIndex: number | null;
  selectedIndex: number | null;
  onSelectRegion: (index: number | null) => void;
  onHoverRegion: (index: number | null) => void;
}

export const OCRImageViewer: React.FC<OCRImageViewerProps> = ({
  imageUrl,
  annotatedImageUrl,
  regions,
  hoveredIndex,
  selectedIndex,
  onSelectRegion,
  onHoverRegion,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imgDims, setImgDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // State refs to keep values fresh in native listeners without recreation
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const isDraggingRef = useRef(isDragging);
  const dragStartRef = useRef(dragStart);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
    isDraggingRef.current = isDragging;
    dragStartRef.current = dragStart;
  }, [zoom, pan, isDragging, dragStart]);

  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Reset zoom & pan when image changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [imageUrl]);

  // Zoom and pan to selected bounding box when selectedIndex changes
  useEffect(() => {
    if (selectedIndex !== null && regions[selectedIndex] && imgRef.current && imgDims.width > 0) {
      const region = regions[selectedIndex];
      const xs = region.box.map((pt) => pt[0]);
      const ys = region.box.map((pt) => pt[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const centerX = minX + (maxX - minX) / 2;
      const centerY = minY + (maxY - minY) / 2;

      const imgWidth = imgRef.current.clientWidth;
      const imgHeight = imgRef.current.clientHeight;

      const dx = (centerX / imgDims.width) * imgWidth;
      const dy = (centerY / imgDims.height) * imgHeight;

      // Center the box in the viewport container
      const panX = imgWidth / 2 - dx;
      const panY = imgHeight / 2 - dy;

      // Zoom in to 1.8x for text readability, or keep current zoom if it's already higher
      setZoom(Math.max(zoom, 1.8));
      setPan({ x: panX, y: panY });
    } else if (selectedIndex === null) {
      // Reset view to original state when selection is cleared
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [selectedIndex, regions, imgDims]);

  // Scroll to zoom on mouse wheel & native touch handlers inside the image viewport
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevent full page scroll

      const zoomFactor = 0.15; // Speed of zoom
      setZoom((prevZoom) => {
        let nextZoom = prevZoom;
        if (e.deltaY < 0) {
          // Zoom in
          nextZoom = Math.min(prevZoom + zoomFactor, 4);
        } else {
          // Zoom out
          nextZoom = Math.max(prevZoom - zoomFactor, 0.5);
        }

        // Reset pan if zoom goes back to 1
        if (nextZoom === 1) {
          setPan({ x: 0, y: 0 });
        }

        return nextZoom;
      });
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch zoom start
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartDistRef.current = dist;
        touchStartZoomRef.current = zoomRef.current;
        setIsDragging(false);
      } else if (e.touches.length === 1) {
        // Panning start
        if (zoomRef.current <= 1) return;
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - panRef.current.x,
          y: e.touches[0].clientY - panRef.current.y,
        });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistRef.current !== null) {
        // Pinch zoom action
        e.preventDefault(); // Prevent browser/page zoom
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / touchStartDistRef.current;
        const nextZoom = Math.min(Math.max(touchStartZoomRef.current * factor, 0.5), 4);
        setZoom(nextZoom);
        if (nextZoom === 1) {
          setPan({ x: 0, y: 0 });
        }
      } else if (e.touches.length === 1 && isDraggingRef.current) {
        // Panning action
        e.preventDefault(); // Prevent page scroll
        setPan({
          x: e.touches[0].clientX - dragStartRef.current.x,
          y: e.touches[0].clientY - dragStartRef.current.y,
        });
      }
    };

    const handleTouchEnd = () => {
      touchStartDistRef.current = null;
      setIsDragging(false);
    };

    // Attach native event listeners as non-passive to allow e.preventDefault()
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Handle image load to get dimensions
  const handleImageLoad = () => {
    if (imgRef.current) {
      setImgDims({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      });
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => {
    setZoom((z) => {
      const nextZoom = Math.max(z - 0.25, 0.5);
      if (nextZoom === 1) setPan({ x: 0, y: 0 });
      return nextZoom;
    });
  };
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };



  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Error enabling fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Synchronize fullscreen escape key
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Download annotated image helper
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = annotatedImageUrl;
    link.download = 'ocr_annotated.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      ref={containerRef}
      className={`bg-neo-bg rounded-neo p-6 shadow-neo-card border border-white/50 flex flex-col gap-4 w-full ${
        isFullscreen ? 'h-screen p-8 justify-center' : ''
      }`}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-neo-text">Visualisasi Gambar OCR</h3>
        
        {/* Controls Toolbar */}
        <div className="flex gap-2 bg-neo-bg shadow-neo-btn border border-white/40 p-1 rounded-full">
          <button
            onClick={handleZoomIn}
            title="Perbesar"
            className="p-2 rounded-full text-neo-muted hover:text-indigo-600 hover:bg-neo-shadow/30 transition-all duration-200"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Perkecil"
            className="p-2 rounded-full text-neo-muted hover:text-indigo-600 hover:bg-neo-shadow/30 transition-all duration-200"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            title="Reset"
            className="p-2 rounded-full text-neo-muted hover:text-indigo-600 hover:bg-neo-shadow/30 transition-all duration-200"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Keluar Fullscreen' : 'Fullscreen'}
            className="p-2 rounded-full text-neo-muted hover:text-indigo-600 hover:bg-neo-shadow/30 transition-all duration-200"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Image Viewport */}
      <div
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full overflow-hidden rounded-neo neo-inset border border-white/40 bg-neo-shadow/10 flex items-center justify-center relative ${
          isFullscreen ? 'flex-grow' : 'h-[400px] md:h-[500px]'
        } ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
          className="relative max-w-full max-h-full flex items-center justify-center transform-gpu"
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="OCR Target"
            onLoad={handleImageLoad}
            className="max-w-full max-h-[400px] md:max-h-[500px] object-contain pointer-events-none select-none rounded-neo"
            style={isFullscreen ? { maxHeight: '80vh' } : {}}
          />

          {/* Interactive Bounding Box SVGs */}
          {imgDims.width > 0 && imgDims.height > 0 && (
            <svg
              viewBox={`0 0 ${imgDims.width} ${imgDims.height}`}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            >
              {regions.map((region, idx) => {
                const pointsString = region.box.map((pt) => `${pt[0]},${pt[1]}`).join(' ');
                const isHovered = hoveredIndex === idx;
                const isSelected = selectedIndex === idx;
                const isActive = isHovered || isSelected;

                return (
                  <polygon
                    key={region.index}
                    points={pointsString}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRegion(isSelected ? null : idx);
                    }}
                    onMouseEnter={() => onHoverRegion(idx)}
                    onMouseLeave={() => onHoverRegion(null)}
                    className={`transition-all duration-200 cursor-pointer pointer-events-auto ${
                      isActive
                        ? 'fill-indigo-600/30 stroke-indigo-600 stroke-[3px]'
                        : 'fill-emerald-500/10 stroke-emerald-500 stroke-[1.5px]'
                    }`}
                  />
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Footer / Downloads */}
      <div className="flex justify-between items-center mt-2 flex-wrap gap-3">
        <span className="text-xs text-neo-muted">
          Geser gambar menggunakan mouse saat diperbesar (Zoom &gt; 100%)
        </span>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2.5 bg-neo-bg shadow-neo-btn hover:shadow-neo-btn-hover rounded-full text-xs font-bold text-indigo-600 border border-white transition-all duration-200"
        >
          <Download className="w-3.5 h-3.5 text-indigo-600" />
          <span>Download Gambar Anotasi</span>
        </button>
      </div>
    </div>
  );
};
