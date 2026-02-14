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
  
  // Use STATE for socket so changes trigger re-renders
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Ref to store socket instance (prevents re-connection on re-render)
  const socketRef = useRef<Socket | null>(null);

  // Connect to WebSocket on mount - EMPTY dependency array = runs once
  useEffect(() => {
    // Already connected
    if (socketRef.current) {
      console.log("[WS] Already have socket, skipping connection");
      return;
    }
    
    console.log("[WS] Creating new socket connection to:", WS_URL);
    
    // Create socket connection
    const newSocket = io(WS_URL, {
      path: "/ws",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Store in ref immediately (prevents double connection)
    socketRef.current = newSocket;
    
    // Set socket in state so components re-render
    setSocket(newSocket);

    // Connection handlers
    newSocket.on("connect", () => {
      console.log("[WS] Connected to WebSocket server, socket id:", newSocket.id);
      setIsConnected(true);
      setError(null);
      onConnectRef.current?.();
    });

    newSocket.on("disconnect", (reason) => {
      console.log("[WS] Disconnected:", reason);
      setIsConnected(false);
      onDisconnectRef.current?.();
    });

    newSocket.on("connect_error", (err) => {
      console.warn("[WS] Connection issue (will retry):", err.message);
      const wsError = new Error("WebSocket connection failed: " + err.message);
      setError(wsError);
      onErrorRef.current?.(wsError);
    });

    // Message handler (for generic "message" events)
    newSocket.on("message", (message: WSMessage) => {
      console.log("[WS] Received message:", message.type);
      onMessageRef.current?.(message);
    });

    // Heartbeat mechanism - send heartbeat every 10 seconds
    const heartbeatInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit("HEARTBEAT");
      }
    }, 10000);

    // Cleanup on unmount
    return () => {
      console.log("[WS] Cleaning up socket connection");
      clearInterval(heartbeatInterval);
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, []);

  // Send message function
  const send = useCallback((message: WSMessage) => {
    const currentSocket = socketRef.current;
    if (!currentSocket?.connected) {
      console.warn("[WS] Cannot send message: not connected");
      return;
    }
    
    console.log("[WS] Sending message:", message.type, message.payload);
    currentSocket.emit(message.type, message.payload || {});
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    const currentSocket = socketRef.current;
    if (currentSocket) {
      currentSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
  }, []);

  return {
    socket,
    isConnected,
    error,
    send,
    disconnect,
  };
}
