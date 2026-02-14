"use client";

import { useState, useCallback } from "react";
import { getAspectRatioCategory, type AspectRatioCategory } from "@partyquiz/shared";

interface Photo {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
  displayOrder: number;
}

interface PhotoGridProps {
  photos: Photo[];
  className?: string;
}

/**
 * PhotoGrid Component
 * 
 * Intelligently displays 1-6 photos in optimized grid layouts based on:
 * - Number of photos
 * - Aspect ratios of individual photos
 * 
 * Layout strategies:
 * - 1 photo: Full width
 * - 2 photos: Side by side or stacked (based on aspect ratios)
 * - 3 photos: Various asymmetric layouts
 * - 4 photos: 2x2 grid
 * - 5-6 photos: Masonry-style grid
 */
export function PhotoGrid({ photos, className = "" }: PhotoGridProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Sort photos by displayOrder
  const sortedPhotos = [...photos].sort((a, b) => a.displayOrder - b.displayOrder);

  // Get aspect ratio categories for each photo
  const photoCategories = sortedPhotos.map((photo) => {
    if (!photo.width || !photo.height) return "STANDARD" as AspectRatioCategory;
    return getAspectRatioCategory(photo.width, photo.height);
  });

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextPhoto = () => {
    setLightboxIndex((prev) => (prev + 1) % sortedPhotos.length);
  };

  const prevPhoto = () => {
    setLightboxIndex((prev) => (prev - 1 + sortedPhotos.length) % sortedPhotos.length);
  };

  // Handle keyboard navigation in lightbox
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") nextPhoto();
    if (e.key === "ArrowLeft") prevPhoto();
  };

  if (sortedPhotos.length === 0) {
    return null;
  }

  return (
    <>
      {/* Photo Grid */}
      <div className={`photo-grid ${className}`}>
        {sortedPhotos.length === 1 && (
          <SinglePhotoLayout photo={sortedPhotos[0]} onClick={() => openLightbox(0)} />
        )}

        {sortedPhotos.length === 2 && (
          <TwoPhotosLayout 
            photos={sortedPhotos} 
            categories={photoCategories}
            onClickPhoto={openLightbox}
          />
        )}

        {sortedPhotos.length === 3 && (
          <ThreePhotosLayout 
            photos={sortedPhotos} 
            categories={photoCategories}
            onClickPhoto={openLightbox}
          />
        )}

        {sortedPhotos.length === 4 && (
          <FourPhotosLayout 
            photos={sortedPhotos}
            onClickPhoto={openLightbox}
          />
        )}

        {sortedPhotos.length >= 5 && (
          <ManyPhotosLayout 
            photos={sortedPhotos}
            onClickPhoto={openLightbox}
          />
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white text-4xl hover:text-slate-300 z-10"
          >
            ×
          </button>

          {/* Previous Button */}
          {sortedPhotos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
              className="absolute left-4 text-white text-5xl hover:text-slate-300 z-10"
            >
              ‹
            </button>
          )}

          {/* Image */}
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sortedPhotos[lightboxIndex].url}
              alt={`Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>

          {/* Next Button */}
          {sortedPhotos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
              className="absolute right-4 text-white text-5xl hover:text-slate-300 z-10"
            >
              ›
            </button>
          )}

          {/* Counter */}
          {sortedPhotos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-lg">
              {lightboxIndex + 1} / {sortedPhotos.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// === LAYOUT COMPONENTS ===

/**
 * PhotoTile: Renders a single photo at its EXACT aspect ratio.
 * When width/height metadata is available, uses it directly.
 * When missing (null), detects the real dimensions from the loaded image
 * via onLoad and updates the container so nothing gets cropped.
 */
function PhotoTile({ photo, index, onClick }: { photo: Photo; index: number; onClick: () => void }) {
  // Start with known dimensions or null (unknown)
  const knownRatio = (photo.width && photo.height) 
    ? photo.width / photo.height 
    : null;
  
  const [detectedRatio, setDetectedRatio] = useState<number | null>(null);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    // Only detect if we don't already have metadata dimensions
    if (!knownRatio) {
      const img = e.currentTarget;
      if (img.naturalWidth && img.naturalHeight) {
        setDetectedRatio(img.naturalWidth / img.naturalHeight);
      }
    }
  }, [knownRatio]);

  // Use known ratio, or detected ratio, or fallback 16/9 while loading
  const aspectRatio = knownRatio ?? detectedRatio ?? 16 / 9;

  return (
    <div className="cursor-pointer group" onClick={onClick}>
      <div 
        className="relative w-full overflow-hidden rounded-xl"
        style={{ aspectRatio }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={`Photo ${index + 1}`}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onLoad={handleImageLoad}
        />
      </div>
    </div>
  );
}

function SinglePhotoLayout({ photo, onClick }: { photo: Photo; onClick: () => void }) {
  // Single photo at exact aspect ratio, centered, max-w so it doesn't stretch too wide
  return (
    <div className="max-w-2xl mx-auto">
      <PhotoTile photo={photo} index={0} onClick={onClick} />
    </div>
  );
}

function TwoPhotosLayout({ 
  photos, 
  categories,
  onClickPhoto 
}: { 
  photos: Photo[]; 
  categories: AspectRatioCategory[];
  onClickPhoto: (index: number) => void;
}) {
  // Always side by side — both with matching aspect ratio for clean look
  return (
    <div className="grid grid-cols-2 gap-3">
      {photos.map((photo, idx) => (
        <PhotoTile key={photo.id} photo={photo} index={idx} onClick={() => onClickPhoto(idx)} />
      ))}
    </div>
  );
}

function ThreePhotosLayout({ 
  photos, 
  categories,
  onClickPhoto 
}: { 
  photos: Photo[]; 
  categories: AspectRatioCategory[];
  onClickPhoto: (index: number) => void;
}) {
  // Layout: First photo full width on top, two side-by-side below
  return (
    <div className="space-y-3">
      <PhotoTile photo={photos[0]} index={0} onClick={() => onClickPhoto(0)} />
      <div className="grid grid-cols-2 gap-3">
        {photos.slice(1).map((photo, idx) => (
          <PhotoTile key={photo.id} photo={photo} index={idx + 1} onClick={() => onClickPhoto(idx + 1)} />
        ))}
      </div>
    </div>
  );
}

function FourPhotosLayout({ 
  photos,
  onClickPhoto 
}: { 
  photos: Photo[];
  onClickPhoto: (index: number) => void;
}) {
  // 2x2 grid, each photo at its own natural aspect ratio
  return (
    <div className="grid grid-cols-2 gap-3">
      {photos.map((photo, idx) => (
        <PhotoTile key={photo.id} photo={photo} index={idx} onClick={() => onClickPhoto(idx)} />
      ))}
    </div>
  );
}

function ManyPhotosLayout({ 
  photos,
  onClickPhoto 
}: { 
  photos: Photo[];
  onClickPhoto: (index: number) => void;
}) {
  // 3-column grid for 5-6 photos, each at natural aspect ratio
  return (
    <div className="grid grid-cols-3 gap-3">
      {photos.map((photo, idx) => (
        <PhotoTile key={photo.id} photo={photo} index={idx} onClick={() => onClickPhoto(idx)} />
      ))}
    </div>
  );
}
