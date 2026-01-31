"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { WSMessage } from "@partyquiz/shared";

interface UseWebSocketOptions {
  sessionCode?: string;
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: Error | null;
  send: (message: WSMessage) => void;
  disconnect: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { sessionCode, onMessage, onConnect, onDisconnect, onError } = options;
  
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Don't connect if no session code provided
    if (!sessionCode) {
      return;
    }

    // Create socket connection
    const socket = io(WS_URL, {
      path: "/ws",
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on("connect", () => {
      console.log("[WS] Connected to WebSocket server");
      setIsConnected(true);
      setError(null);
      onConnect?.();
    });

    socket.on("disconnect", (reason) => {
      console.log("[WS] Disconnected:", reason);
      setIsConnected(false);
      onDisconnect?.();
    });

    socket.on("connect_error", (err) => {
      console.error("[WS] Connection error:", err);
      const error = new Error(`WebSocket connection failed: ${err.message}`);
      setError(error);
      onError?.(error);
    });

    // Message handler
    socket.on("message", (message: WSMessage) => {
      console.log("[WS] Received message:", message.type);
      onMessage?.(message);
    });

    // Cleanup on unmount
    return () => {
      console.log("[WS] Cleaning up socket connection");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionCode, onMessage, onConnect, onDisconnect, onError]);

  // Send message function
  const send = useCallback((message: WSMessage) => {
    if (!socketRef.current?.connected) {
      console.warn("[WS] Cannot send message: not connected");
      return;
    }
    
    console.log("[WS] Sending message:", message.type);
    socketRef.current.emit("message", message);
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    send,
    disconnect,
  };
}
