"use client";

import { useState } from "react";
import { getMaxPhotos, type QuestionType } from "@partyquiz/shared";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface QuestionMedia {
  id: string;
  url: string;
  type: string;
  width?: number | null;
  height?: number | null;
  displayOrder: number;
}

interface MultiPhotoUploaderProps {
  questionType: QuestionType;
  media: QuestionMedia[];
  onMediaChange: (media: QuestionMedia[]) => void;
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (mediaId: string) => Promise<void>;
  uploading?: boolean;
}

export function MultiPhotoUploader({
  questionType,
  media,
  onMediaChange,
  onUpload,
  onDelete,
  uploading = false,
}: MultiPhotoUploaderProps) {
  const maxPhotos = getMaxPhotos(questionType as QuestionType);
  const photoMedia = media.filter((m) => m.type === "IMAGE");
  const canAddMore = photoMedia.length < maxPhotos;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = photoMedia.findIndex((m) => m.id === active.id);
      const newIndex = photoMedia.findIndex((m) => m.id === over.id);

      const reordered = arrayMove(photoMedia, oldIndex, newIndex);
      
      // Update displayOrder
      const updatedMedia = reordered.map((m, idx) => ({
        ...m,
        displayOrder: idx,
      }));

      // Merge with non-image media
      const otherMedia = media.filter((m) => m.type !== "IMAGE");
      onMediaChange([...updatedMedia, ...otherMedia]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check if adding these files would exceed limit
    if (photoMedia.length + files.length > maxPhotos) {
      alert(`You can only add up to ${maxPhotos} photos for this question type.`);
      return;
    }

    await onUpload(files);
    
    // Reset input
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {photoMedia.length} / {maxPhotos} photos
        </p>
        {canAddMore && (
          <label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={(e) => {
                e.preventDefault();
                (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
              }}
            >
              {uploading ? "Uploading..." : "Add Photos"}
            </Button>
          </label>
        )}
      </div>

      {/* Photo Grid */}
      {photoMedia.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={photoMedia.map((m) => m.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photoMedia.map((m) => (
                <SortablePhotoItem key={m.id} media={m} onDelete={onDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center">
          <p className="text-slate-400 mb-4">No photos added yet</p>
          <label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploading}
              onClick={(e) => {
                e.preventDefault();
                (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
              }}
            >
              {uploading ? "Uploading..." : "Upload Photos"}
            </Button>
          </label>
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-slate-500 space-y-1">
        <p>• Drag and drop photos to reorder them</p>
        <p>• Supported formats: JPG, PNG, WebP, AVIF, GIF, SVG, BMP, TIFF</p>
        <p>• Max size: 15MB per photo</p>
        <p>• Min dimensions: 400x200px</p>
      </div>
    </div>
  );
}

function SortablePhotoItem({
  media,
  onDelete,
}: {
  media: QuestionMedia;
  onDelete: (mediaId: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: media.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this photo?")) return;
    
    setDeleting(true);
    try {
      await onDelete(media.id);
    } catch (error) {
      console.error("Failed to delete photo:", error);
      alert("Failed to delete photo");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-video bg-slate-800 rounded-lg overflow-hidden cursor-move"
      {...attributes}
      {...listeners}
    >
      <Image
        src={media.url}
        alt={`Photo ${media.displayOrder + 1}`}
        fill
        className="object-cover"
      />

      {/* Order Badge */}
      <div className="absolute top-2 left-2 w-8 h-8 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white font-bold text-sm">
        {media.displayOrder + 1}
      </div>

      {/* Delete Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
        }}
        disabled={deleting}
        className="absolute top-2 right-2 w-8 h-8 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {deleting ? "..." : "×"}
      </button>

      {/* Drag Handle Indicator */}
      <div className="absolute bottom-2 right-2 text-white/60 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8h16M4 16h16"
          />
        </svg>
      </div>
    </div>
  );
}
