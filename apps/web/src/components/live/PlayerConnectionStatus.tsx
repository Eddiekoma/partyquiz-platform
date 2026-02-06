"use client";

import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { Card } from "@/components/ui/Card";

interface PlayerConnection {
  playerId: string;
  playerName: string;
  socketId: string;
  connectedAt: number;
  lastHeartbeat: number;
  isOnline: boolean;
}

interface ConnectionStatusUpdate {
  connections: PlayerConnection[];
}

interface PlayerConnectionStatusProps {
  socket: Socket | null;
  sessionCode: string;
}

export function PlayerConnectionStatus({ socket, sessionCode }: PlayerConnectionStatusProps) {
  const [connections, setConnections] = useState<PlayerConnection[]>([]);

  useEffect(() => {
    if (!socket) return;

    // Listen for connection status updates
    const handleConnectionUpdate = (data: ConnectionStatusUpdate) => {
      setConnections(data.connections);
    };

    socket.on("CONNECTION_STATUS_UPDATE", handleConnectionUpdate);

    return () => {
      socket.off("CONNECTION_STATUS_UPDATE", handleConnectionUpdate);
    };
  }, [socket]);

  const getConnectionQuality = (connection: PlayerConnection): "good" | "poor" | "offline" => {
    if (!connection.isOnline) return "offline";
    
    const timeSinceLastHeartbeat = Date.now() - connection.lastHeartbeat;
    if (timeSinceLastHeartbeat < 5000) return "good";
    if (timeSinceLastHeartbeat < 10000) return "poor";
    return "offline";
  };

  const getConnectionColor = (quality: "good" | "poor" | "offline") => {
    switch (quality) {
      case "good":
        return "text-green-500 bg-green-100";
      case "poor":
        return "text-yellow-600 bg-yellow-100";
      case "offline":
        return "text-red-500 bg-red-100";
    }
  };

  const getConnectionDuration = (connectedAt: number): string => {
    const duration = Math.floor((Date.now() - connectedAt) / 1000);
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m`;
    return `${Math.floor(duration / 3600)}h`;
  };

  const onlineCount = connections.filter((c) => c.isOnline).length;
  const totalCount = connections.length;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">
        Players ({onlineCount}/{totalCount})
      </h3>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {connections.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            No players connected yet
          </div>
        ) : (
          connections.map((connection) => {
            const quality = getConnectionQuality(connection);
            return (
              <div
                key={connection.playerId}
                className="flex items-center justify-between p-3 rounded-lg border bg-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getConnectionColor(quality)}`} />
                  <div>
                    <p className="font-medium">{connection.playerName}</p>
                    <p className="text-xs text-slate-400">
                      Connected {getConnectionDuration(connection.connectedAt)}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getConnectionColor(quality)}`}>
                  {quality === "good" && "Online"}
                  {quality === "poor" && "Poor"}
                  {quality === "offline" && "Offline"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
