"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      // Update session
      await update({ name });
      setMessage({ type: "success", text: "Profiel succesvol bijgewerkt!" });
    } catch (error) {
      setMessage({ type: "error", text: "Er ging iets mis bij het opslaan." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Instellingen</h1>

      <div className="space-y-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Profiel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <Input
                type="email"
                value={session?.user?.email || ""}
                disabled
                className="bg-slate-800/50"
              />
              <p className="text-xs text-slate-500 mt-1">Email kan niet worden gewijzigd</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Naam
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Je naam"
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg ${
                message.type === "success" 
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}>
                {message.text}
              </div>
            )}

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-400">
              <p>Ingelogd als: <span className="text-white">{session?.user?.email}</span></p>
              <p className="text-sm mt-2">
                Meer account instellingen komen binnenkort beschikbaar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
