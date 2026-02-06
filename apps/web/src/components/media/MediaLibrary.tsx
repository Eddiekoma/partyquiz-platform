"use client";

import { useState } from "react";
import { FileUploader } from "./FileUploader";
import { MediaBrowser } from "./MediaBrowser";
import { X } from "lucide-react";

interface MediaLibraryProps {
  workspaceId: string;
  category?: "images" | "audio" | "video" | "other";
  selectable?: boolean;
  onSelect?: (asset: {
    id: string;
    filename: string;
    storageKey: string;
    url: string;
    type: string;
  }) => void;
  onClose?: () => void;
}

export function MediaLibrary({
  workspaceId,
  category = "images",
  selectable = false,
  onSelect,
  onClose,
}: MediaLibraryProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryMap: Record<string, "IMAGE" | "AUDIO" | "VIDEO" | "OTHER"> = {
    images: "IMAGE",
    audio: "AUDIO",
    video: "VIDEO",
    other: "OTHER",
  };

  const acceptMap: Record<string, string> = {
    images: "image/*",
    audio: "audio/*",
    video: "video/*",
    other: "*",
  };

  const maxSizeMap: Record<string, number> = {
    images: 10,
    audio: 10,
    video: 50,
    other: 10,
  };

  const handleUploadComplete = (asset: any) => {
    setUploadSuccess(true);
    setError(null);
    // Refresh the media browser
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setTimeout(() => setError(null), 5000);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h2 className="text-2xl font-bold text-white">Media Library</h2>
          <p className="text-sm text-slate-400 mt-1">
            Upload and manage your {category === "images" ? "images" : category}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-slate-400" />
          </button>
        )}
      </div>

      {/* Alerts */}
      {uploadSuccess && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 font-medium">
            ✓ File uploaded successfully!
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-medium">
            ✗ {error}
          </p>
        </div>
      )}

      {/* Upload Section */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-white mb-3">Upload New File</h3>
        <FileUploader
          workspaceId={workspaceId}
          category={category}
          accept={acceptMap[category]}
          maxSize={maxSizeMap[category]}
          onUploadComplete={handleUploadComplete}
          onError={handleError}
        />
      </div>

      {/* Browser Section */}
      <div className="mt-8 flex-1 overflow-auto">
        <h3 className="text-lg font-semibold text-white mb-3">Your Files</h3>
        <MediaBrowser
          key={refreshKey}
          workspaceId={workspaceId}
          filterType={categoryMap[category]}
          onSelect={onSelect}
          selectable={selectable}
        />
      </div>
    </div>
  );
}
