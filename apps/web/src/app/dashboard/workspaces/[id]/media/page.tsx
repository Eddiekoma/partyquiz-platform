"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { UploadZone } from "@/components/ui/Upload";
import { Card } from "@/components/ui/Card";

type AssetType = "IMAGE" | "AUDIO" | "VIDEO";

interface Asset {
  id: string;
  filename: string;
  type: AssetType;
  mime: string;
  size: number;
  publicUrl: string;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: string;
  creator: {
    id: string;
    name: string | null;
    email: string;
  };
}

type ViewMode = "grid" | "list";
type FilterType = "all" | "IMAGE" | "AUDIO" | "VIDEO";

export default function MediaPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    loadAssets();
  }, [workspaceId]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/assets`);
      if (!response.ok) throw new Error("Failed to load assets");
      const data = await response.json();
      setAssets(data.assets || []);
    } catch (error) {
      console.error("Failed to load assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = () => {
    setUploadSuccess(true);
    setUploadError(null);
    loadAssets();
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  const handleUploadError = (error: string) => {
    setUploadError(error);
    setUploadSuccess(false);
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/assets/${assetId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete asset");
      loadAssets();
    } catch (error) {
      console.error("Failed to delete asset:", error);
      alert("Failed to delete asset");
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesType = filterType === "all" || asset.type === filterType;
    const matchesSearch = asset.filename.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Media Library</h1>
        <p className="text-slate-400">Upload and manage images, audio, and video files</p>
      </div>

      {/* Upload Section */}
      <Card className="mb-8 p-6">
        <UploadZone
          workspaceId={workspaceId}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
          label="Upload Media"
          description="Drag and drop files here or click to browse (Images up to 10MB, Audio up to 50MB, Video up to 200MB)"
        />
        {uploadError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {uploadError}
          </div>
        )}
        {uploadSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            Upload successful!
          </div>
        )}
      </Card>

      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Filters and View Mode */}
        <div className="flex gap-3">
          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="IMAGE">Images</option>
            <option value="AUDIO">Audio</option>
            <option value="VIDEO">Video</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex border border-slate-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-4 py-2 ${
                viewMode === "grid" ? "bg-primary-600 text-white" : "bg-white text-slate-300"
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 ${
                viewMode === "list" ? "bg-primary-600 text-white" : "bg-white text-slate-300"
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Assets Display */}
      {loading ? (
        <div className="text-center py-12">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-slate-400">Loading media...</p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-xl font-semibold mb-2">No media files found</h3>
          <p className="text-slate-400">
            {searchQuery || filterType !== "all"
              ? "Try adjusting your filters"
              : "Upload your first file to get started"}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Preview */}
              <div className="aspect-video bg-slate-700 flex items-center justify-center relative">
                {asset.type === "IMAGE" ? (
                  <img
                    src={asset.publicUrl}
                    alt={asset.filename}
                    className="w-full h-full object-cover"
                  />
                ) : asset.type === "AUDIO" ? (
                  <div className="text-6xl">🎵</div>
                ) : (
                  <div className="text-6xl">🎬</div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-sm mb-2 truncate" title={asset.filename}>
                  {asset.filename}
                </h3>
                <div className="text-xs text-slate-400 space-y-1 mb-3">
                  <div>{formatFileSize(asset.size)}</div>
                  {asset.width && asset.height && (
                    <div>{asset.width} × {asset.height}</div>
                  )}
                  {asset.duration && <div>{formatDuration(asset.duration)}</div>}
                  <div className="text-slate-400">
                    by {asset.creator.name || asset.creator.email}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <a
                    href={asset.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded text-center transition-colors"
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-sm rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className="text-3xl flex-shrink-0">
                  {asset.type === "IMAGE" ? "🖼️" : asset.type === "AUDIO" ? "🎵" : "🎬"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{asset.filename}</h3>
                  <div className="text-sm text-slate-400 flex gap-4">
                    <span>{formatFileSize(asset.size)}</span>
                    {asset.width && asset.height && (
                      <span>{asset.width} × {asset.height}</span>
                    )}
                    {asset.duration && <span>{formatDuration(asset.duration)}</span>}
                    <span>by {asset.creator.name || asset.creator.email}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <a
                    href={asset.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors"
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
