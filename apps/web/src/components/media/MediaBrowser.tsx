"use client";

import { useState, useEffect } from "react";
import { Search, Grid, List, Trash2, Loader2, Image as ImageIcon } from "lucide-react";

interface Asset {
  id: string;
  filename: string;
  storageKey: string;
  mime: string;
  size: number;
  type: string;
  url: string;
  createdAt: string;
  creator: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface MediaBrowserProps {
  workspaceId: string;
  filterType?: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
  onSelect?: (asset: Asset) => void;
  selectable?: boolean;
}

export function MediaBrowser({
  workspaceId,
  filterType,
  onSelect,
  selectable = false,
}: MediaBrowserProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets();
  }, [workspaceId, filterType]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append("type", filterType);

      const res = await fetch(`/api/workspaces/${workspaceId}/assets?${params}`);
      if (!res.ok) throw new Error("Failed to fetch assets");

      const data = await res.json();
      setAssets(data.assets);
    } catch (error) {
      console.error("Error fetching assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter((asset) =>
    asset.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAssetClick = (asset: Asset) => {
    if (selectable) {
      setSelectedAsset(asset.id);
      onSelect?.(asset);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 border border-slate-600 rounded-lg p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded ${
              viewMode === "grid" ? "bg-blue-100 text-blue-600" : "text-slate-400 hover:bg-slate-700"
            }`}
          >
            <Grid className="h-5 w-5" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded ${
              viewMode === "list" ? "bg-blue-100 text-blue-600" : "text-slate-400 hover:bg-slate-700"
            }`}
          >
            <List className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredAssets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <ImageIcon className="h-16 w-16 mb-4 text-gray-300" />
          <p className="text-lg font-medium">No assets found</p>
          <p className="text-sm">Upload files to get started</p>
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && filteredAssets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => handleAssetClick(asset)}
              className={`
                group relative aspect-square rounded-lg overflow-hidden
                border-2 transition-all cursor-pointer
                ${
                  selectedAsset === asset.id
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-slate-700 hover:border-blue-300"
                }
              `}
            >
              {/* Preview */}
              {asset.type === "IMAGE" ? (
                <img
                  src={asset.url}
                  alt={asset.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                  <div className="text-center p-4">
                    <div className="text-3xl mb-2">
                      {asset.type === "AUDIO" ? "🎵" : asset.type === "VIDEO" ? "🎬" : "📄"}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{asset.filename}</p>
                  </div>
                </div>
              )}

              {/* Overlay with info */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all">
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-sm font-medium truncate">{asset.filename}</p>
                  <p className="text-xs text-gray-300">{formatFileSize(asset.size)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && filteredAssets.length > 0 && (
        <div className="border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Preview</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Size</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Uploaded</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAssets.map((asset) => (
                <tr
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className={`
                    hover:bg-slate-800/50 cursor-pointer
                    ${selectedAsset === asset.id ? "bg-blue-50" : ""}
                  `}
                >
                  <td className="px-4 py-3">
                    <div className="w-12 h-12 rounded overflow-hidden bg-slate-700">
                      {asset.type === "IMAGE" ? (
                        <img src={asset.url} alt={asset.filename} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          {asset.type === "AUDIO" ? "🎵" : asset.type === "VIDEO" ? "🎬" : "📄"}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{asset.filename}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{asset.mime}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{formatFileSize(asset.size)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{formatDate(asset.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {asset.creator.name || asset.creator.email}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
