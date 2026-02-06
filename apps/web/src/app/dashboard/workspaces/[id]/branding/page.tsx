"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { MediaLibrary } from "@/components/media/MediaLibrary";
import { ArrowLeft, Upload, X, Palette } from "lucide-react";
import Link from "next/link";

interface WorkspaceBranding {
  id: string;
  name: string;
  logo: string | null;
  themeColor: string | null;
}

export default function WorkspaceBrandingPage() {
  const params = useParams();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [logo, setLogo] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState<string>("#3B82F6");

  useEffect(() => {
    fetchBranding();
  }, [params.id]);

  const fetchBranding = async () => {
    try {
      const res = await fetch(`/api/workspaces/${params.id}/branding`);
      if (res.ok) {
        const data = await res.json();
        setWorkspace(data.workspace);
        setLogo(data.workspace.logo);
        setThemeColor(data.workspace.themeColor || "#3B82F6");
      } else if (res.status === 404) {
        router.push("/dashboard/workspaces");
      }
    } catch (error) {
      console.error("Failed to fetch branding:", error);
      setError("Failed to load workspace branding");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${params.id}/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo,
          themeColor,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        fetchBranding(); // Refresh data
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update branding");
      }
    } catch (error) {
      console.error("Failed to save branding:", error);
      setError("Failed to save branding");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoSelect = (asset: { url: string }) => {
    setLogo(asset.url);
    setShowMediaLibrary(false);
  };

  const handleRemoveLogo = () => {
    setLogo(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading workspace branding...</div>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/workspaces/${params.id}`}>
          <Button variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workspace
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workspace Branding</h1>
          <p className="text-slate-400 mt-1">{workspace.name}</p>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 font-medium">
            ✓ Branding updated successfully!
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-medium">✗ {error}</p>
        </div>
      )}

      <div className="grid gap-6">
        {/* Logo Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Workspace Logo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-4">
              Upload a logo that will appear on live session screens. Recommended size:
              200x200px or larger.
            </p>

            {logo ? (
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img
                    src={logo}
                    alt="Workspace logo"
                    className="w-32 h-32 object-contain border-2 border-slate-700 rounded-lg bg-white"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    title="Remove logo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1">
                  <Button
                    onClick={() => setShowMediaLibrary(true)}
                    variant="secondary"
                    size="sm"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Change Logo
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowMediaLibrary(true)} variant="secondary">
                <Upload className="h-4 w-4 mr-2" />
                Upload Logo
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Theme Color Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Theme Color
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-4">
              Choose a brand color that will be applied to live session screens and UI
              elements.
            </p>

            <div className="flex items-center gap-4">
              {/* Color Picker */}
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-16 h-16 rounded-lg border-2 border-slate-700 cursor-pointer"
                />
                <div>
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                        setThemeColor(value);
                      }
                    }}
                    className="font-mono text-sm px-3 py-2 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#3B82F6"
                    maxLength={7}
                  />
                  <p className="text-xs text-slate-400 mt-1">Hex color code</p>
                </div>
              </div>

              {/* Color Preview Swatches */}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => setThemeColor("#3B82F6")}
                  className="w-10 h-10 rounded-lg border-2 border-slate-700 hover:border-slate-500 transition-colors"
                  style={{ backgroundColor: "#3B82F6" }}
                  title="Blue"
                />
                <button
                  onClick={() => setThemeColor("#8B5CF6")}
                  className="w-10 h-10 rounded-lg border-2 border-slate-700 hover:border-slate-500 transition-colors"
                  style={{ backgroundColor: "#8B5CF6" }}
                  title="Purple"
                />
                <button
                  onClick={() => setThemeColor("#10B981")}
                  className="w-10 h-10 rounded-lg border-2 border-slate-700 hover:border-slate-500 transition-colors"
                  style={{ backgroundColor: "#10B981" }}
                  title="Green"
                />
                <button
                  onClick={() => setThemeColor("#F59E0B")}
                  className="w-10 h-10 rounded-lg border-2 border-slate-700 hover:border-slate-500 transition-colors"
                  style={{ backgroundColor: "#F59E0B" }}
                  title="Amber"
                />
                <button
                  onClick={() => setThemeColor("#EF4444")}
                  className="w-10 h-10 rounded-lg border-2 border-slate-700 hover:border-slate-500 transition-colors"
                  style={{ backgroundColor: "#EF4444" }}
                  title="Red"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-4">
              Preview how your branding will appear on live session screens.
            </p>

            {/* Mock Player Lobby */}
            <div
              className="relative rounded-xl overflow-hidden shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)`,
              }}
            >
              <div className="p-8 text-white">
                {/* Mock Logo */}
                {logo ? (
                  <div className="flex justify-center mb-6">
                    <img
                      src={logo}
                      alt="Logo preview"
                      className="h-20 object-contain bg-white/10 p-2 rounded-lg backdrop-blur-sm"
                    />
                  </div>
                ) : (
                  <div className="flex justify-center mb-6">
                    <div className="h-20 w-20 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                      <Upload className="h-10 w-10 text-white/60" />
                    </div>
                  </div>
                )}

                {/* Mock Session Info */}
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-2">Quiz Lobby</h2>
                  <p className="text-white/90 mb-6">
                    Session Code: <span className="font-mono font-bold">DEMO123</span>
                  </p>

                  {/* Mock Players */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <p className="text-sm font-medium mb-3">Players (3)</p>
                    <div className="space-y-2">
                      {["Alice", "Bob", "Charlie"].map((name) => (
                        <div
                          key={name}
                          className="flex items-center gap-2 bg-white/10 rounded-lg p-2"
                        >
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            {name[0]}
                          </div>
                          <span className="text-sm font-medium">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Link href={`/dashboard/workspaces/${params.id}`}>
            <Button variant="secondary" disabled={saving}>
              Cancel
            </Button>
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Branding"}
          </Button>
        </div>
      </div>

      {/* Media Library Modal */}
      {showMediaLibrary && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <MediaLibrary
                workspaceId={params.id as string}
                category="images"
                selectable={true}
                onSelect={handleLogoSelect}
                onClose={() => setShowMediaLibrary(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
