"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";

interface FileUploaderProps {
  workspaceId: string;
  category?: "images" | "audio" | "video" | "other";
  accept?: string;
  maxSize?: number; // in MB
  onUploadComplete: (asset: {
    id: string;
    filename: string;
    storageKey: string;
    mime: string;
    size: number;
    type: string;
    url: string;
  }) => void;
  onError?: (error: string) => void;
}

export function FileUploader({
  workspaceId,
  category = "images",
  accept = "image/*",
  maxSize = 10,
  onUploadComplete,
  onError,
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(0);

    try {
      // Step 1: Request presigned URL
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          category,
        }),
      });

      if (!presignRes.ok) {
        const error = await presignRes.json();
        throw new Error(error.error || "Failed to get upload URL");
      }

      const { assetId, uploadUrl, storageKey } = await presignRes.json();

      // Step 2: Upload directly to S3
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file to storage");
      }

      setProgress(75);

      // Step 3: Confirm upload
      const confirmRes = await fetch(`/api/uploads/${assetId}/confirm`, {
        method: "POST",
      });

      if (!confirmRes.ok) {
        const error = await confirmRes.json();
        throw new Error(error.error || "Failed to confirm upload");
      }

      const { asset } = await confirmRes.json();
      setProgress(100);

      // Success!
      onUploadComplete({
        ...asset,
        url: uploadUrl.split("?")[0], // Remove query params for display
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      onError?.(error.message || "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndUpload(file);
    }
  };

  const validateAndUpload = (file: File) => {
    // Validate file size
    const maxBytes = maxSize * 1024 * 1024;
    if (file.size > maxBytes) {
      onError?.(`File too large. Maximum size: ${maxSize}MB`);
      return;
    }

    // Validate file type
    if (accept && !accept.includes("*")) {
      const acceptedTypes = accept.split(",").map((t) => t.trim());
      if (!acceptedTypes.some((t) => file.type.includes(t))) {
        onError?.(`Invalid file type. Accepted: ${accept}`);
        return;
      }
    }

    uploadFile(file);
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8
          transition-colors cursor-pointer
          ${dragActive ? "border-blue-500 bg-blue-50" : "border-slate-600 hover:border-slate-500"}
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          {uploading ? (
            <>
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
              <div className="w-full max-w-xs">
                <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-slate-400 mt-2">Uploading... {progress}%</p>
              </div>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-slate-500" />
              <div>
                <p className="text-lg font-medium text-slate-300">
                  Drop file here or click to browse
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {accept === "image/*" && "Images only"}
                  {accept === "audio/*" && "Audio files only"}
                  {accept === "video/*" && "Video files only"}
                  {" "}• Maximum {maxSize}MB
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
