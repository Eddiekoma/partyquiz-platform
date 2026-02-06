"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { Button } from "./Button";

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadResult {
  assetId: string;
  publicUrl: string;
  storageKey: string;
}

interface UploadButtonProps {
  workspaceId: string;
  accept?: string;
  maxSize?: number;
  onUploadStart?: () => void;
  onUploadProgress?: (progress: UploadProgress) => void;
  onUploadComplete?: (result: UploadResult) => void;
  onUploadError?: (error: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function UploadButton({
  workspaceId,
  accept = "image/*,audio/*,video/*",
  maxSize = 200 * 1024 * 1024, // 200MB default
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  className,
  children = "Upload File",
}: UploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadFile(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File) => {
    if (file.size > maxSize) {
      onUploadError?.(`File too large. Maximum size: ${Math.round(maxSize / (1024 * 1024))}MB`);
      return;
    }

    setUploading(true);
    onUploadStart?.();

    try {
      // Step 1: Get presigned URL from API
      const uploadResponse = await fetch("/api/media/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || "Failed to get upload URL");
      }

      const { uploadUrl, assetId, publicUrl, storageKey } = await uploadResponse.json();

      // Step 2: Upload file to S3 using presigned URL
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress: UploadProgress = {
            loaded: e.loaded,
            total: e.total,
            percentage: Math.round((e.loaded / e.total) * 100),
          };
          onUploadProgress?.(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          onUploadComplete?.({ assetId, publicUrl, storageKey });
        } else {
          onUploadError?.("Upload failed");
        }
        setUploading(false);
      });

      xhr.addEventListener("error", () => {
        onUploadError?.("Upload failed");
        setUploading(false);
      });

      xhr.addEventListener("abort", () => {
        onUploadError?.("Upload cancelled");
        setUploading(false);
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    } catch (error) {
      console.error("Upload error:", error);
      onUploadError?.(error instanceof Error ? error.message : "Upload failed");
      setUploading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={uploading}
        loading={uploading}
        className={className}
      >
        {children}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}

interface UploadZoneProps extends Omit<UploadButtonProps, "children"> {
  label?: string;
  description?: string;
}

export function UploadZone({
  workspaceId,
  accept = "image/*,audio/*,video/*",
  maxSize = 200 * 1024 * 1024,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  label = "Upload File",
  description = "Drag and drop or click to browse",
  className = "",
}: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    if (file.size > maxSize) {
      onUploadError?.(`File too large. Maximum size: ${Math.round(maxSize / (1024 * 1024))}MB`);
      return;
    }

    setUploading(true);
    setProgress(null);
    onUploadStart?.();

    try {
      const uploadResponse = await fetch("/api/media/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || "Failed to get upload URL");
      }

      const { uploadUrl, assetId, publicUrl, storageKey } = await uploadResponse.json();

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const prog: UploadProgress = {
            loaded: e.loaded,
            total: e.total,
            percentage: Math.round((e.loaded / e.total) * 100),
          };
          setProgress(prog);
          onUploadProgress?.(prog);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          onUploadComplete?.({ assetId, publicUrl, storageKey });
          setProgress(null);
        } else {
          onUploadError?.("Upload failed");
        }
        setUploading(false);
      });

      xhr.addEventListener("error", () => {
        onUploadError?.("Upload failed");
        setUploading(false);
        setProgress(null);
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    } catch (error) {
      console.error("Upload error:", error);
      onUploadError?.(error instanceof Error ? error.message : "Upload failed");
      setUploading(false);
      setProgress(null);
    }
  };

  return (
    <div className={className}>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging
            ? "border-primary-500 bg-primary-50"
            : "border-slate-600 hover:border-slate-500 bg-slate-800/50"
          }
          ${uploading ? "opacity-60 pointer-events-none" : ""}
        `}
      >
        {uploading && progress ? (
          <div className="space-y-3">
            <div className="text-lg font-semibold text-white">
              Uploading... {progress.percentage}%
            </div>
            <div className="w-full bg-slate-600 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <div className="text-sm text-slate-400">
              {Math.round(progress.loaded / (1024 * 1024))}MB / {Math.round(progress.total / (1024 * 1024))}MB
            </div>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-3">📁</div>
            <div className="text-lg font-semibold text-white mb-1">{label}</div>
            <div className="text-sm text-slate-400">{description}</div>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
