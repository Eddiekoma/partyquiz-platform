"use client";

import { useState } from "react";
import { getAspectRatioCategory, type AspectRatioCategory } from "@partyquiz/shared";
import Image from "next/image";

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
            <Image
              src={sortedPhotos[lightboxIndex].url}
              alt={`Photo ${lightboxIndex + 1}`}
              width={sortedPhotos[lightboxIndex].width || 1200}
              height={sortedPhotos[lightboxIndex].height || 800}
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

function SinglePhotoLayout({ photo, onClick }: { photo: Photo; onClick: () => void }) {
  return (
    <div className="cursor-pointer group" onClick={onClick}>
      <div className="relative w-full aspect-video overflow-hidden rounded-2xl">
        <Image
          src={photo.url}
          alt="Photo"
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
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
  // If both are portrait/tall, stack vertically. Otherwise side by side.
  const bothPortrait = categories.every(cat => cat === "PORTRAIT" || cat === "TALL");

  if (bothPortrait) {
    return (
      <div className="space-y-4">
        {photos.map((photo, idx) => (
          <div key={photo.id} className="cursor-pointer group" onClick={() => onClickPhoto(idx)}>
            <div className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl">
              <Image
                src={photo.url}
                alt={`Photo ${idx + 1}`}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {photos.map((photo, idx) => (
        <div key={photo.id} className="cursor-pointer group" onClick={() => onClickPhoto(idx)}>
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl">
            <Image
              src={photo.url}
              alt={`Photo ${idx + 1}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>
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
  // Layout: One large photo on left, two stacked on right
  return (
    <div className="grid grid-cols-2 gap-4 h-[600px]">
      {/* Large photo */}
      <div className="cursor-pointer group row-span-2" onClick={() => onClickPhoto(0)}>
        <div className="relative w-full h-full overflow-hidden rounded-2xl">
          <Image
            src={photos[0].url}
            alt="Photo 1"
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      </div>

      {/* Two smaller photos */}
      <div className="space-y-4">
        {photos.slice(1).map((photo, idx) => (
          <div key={photo.id} className="cursor-pointer group" onClick={() => onClickPhoto(idx + 1)}>
            <div className="relative w-full h-[288px] overflow-hidden rounded-2xl">
              <Image
                src={photo.url}
                alt={`Photo ${idx + 2}`}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>
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
  return (
    <div className="grid grid-cols-2 gap-4">
      {photos.map((photo, idx) => (
        <div key={photo.id} className="cursor-pointer group" onClick={() => onClickPhoto(idx)}>
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl">
            <Image
              src={photo.url}
              alt={`Photo ${idx + 1}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>
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
  return (
    <div className="grid grid-cols-3 gap-4">
      {photos.map((photo, idx) => (
        <div key={photo.id} className="cursor-pointer group" onClick={() => onClickPhoto(idx)}>
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl">
            <Image
              src={photo.url}
              alt={`Photo ${idx + 1}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
