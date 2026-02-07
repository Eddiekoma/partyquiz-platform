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

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8080";

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { sessionCode } = options;
  
  // Store callbacks in refs to avoid re-creating socket on callback changes
  const onMessageRef = useRef(options.onMessage);
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);
  const onErrorRef = useRef(options.onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = options.onMessage;
    onConnectRef.current = options.onConnect;
    onDisconnectRef.current = options.onDisconnect;
    onErrorRef.current = options.onError;
  }, [options.onMessage, options.onConnect, options.onDisconnect, options.onError]);
  
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Prevent multiple connections
    if (socketRef.current) {
      return;
    }
    
    console.log("[WS] Connecting to:", WS_URL);
    
    // Create socket connection
    const socket = io(WS_URL, {
      path: "/ws",
      transports: ["websocket", "polling"], // Allow fallback to polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on("connect", () => {
      console.log("[WS] Connected to WebSocket server, socket id:", socket.id);
      setIsConnected(true);
      setError(null);
      onConnectRef.current?.();
    });

    socket.on("disconnect", (reason) => {
      console.log("[WS] Disconnected:", reason);
      setIsConnected(false);
      onDisconnectRef.current?.();
    });

    socket.on("connect_error", (err) => {
      console.error("[WS] Connection error:", err.message);
      const error = new Error(`WebSocket connection failed: ${err.message}`);
      setError(error);
      onErrorRef.current?.(error);
    });

    // Message handler
    socket.on("message", (message: WSMessage) => {
      console.log("[WS] Received message:", message.type);
      onMessageRef.current?.(message);
    });

    // Heartbeat mechanism - send heartbeat every 10 seconds
    // Server thresholds: poor > 20s, offline > 35s
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("HEARTBEAT");
      }
    }, 10000);

    // Cleanup on unmount
    return () => {
      console.log("[WS] Cleaning up socket connection");
      clearInterval(heartbeatInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionCode]); // Only reconnect when sessionCode changes

  // Send message function - emits the message type directly as the event name
  const send = useCallback((message: WSMessage) => {
    if (!socketRef.current?.connected) {
      console.warn("[WS] Cannot send message: not connected");
      return;
    }
    
    console.log("[WS] Sending message:", message.type, message.payload);
    // Emit the message type as the event name, with payload as data
    socketRef.current.emit(message.type, message.payload || {});
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
