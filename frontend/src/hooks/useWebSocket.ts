"use client";

import { useEffect, useRef, useState } from "react";

/**
 * WebSocket connection lifecycle states.
 *
 * The header only surfaces `disconnected` and `error` to the user; a healthy
 * (`connected`) connection is intentionally kept silent to reduce noise.
 */
export type WebSocketStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface UseWebSocketResult {
  /** Current lifecycle state of the WebSocket connection. */
  connectionStatus: WebSocketStatus;
  /** Convenience flag: true only while the socket is open and healthy. */
  isConnected: boolean;
}

export interface UseWebSocketOptions {
  /** JWT appended as `?token=` to authenticate the API Gateway $connect route. */
  token?: string | null;
  /** Called with the parsed JSON payload of every inbound socket message. */
  onMessage?: (data: unknown) => void;
}

/** URL of the backend WebSocket server (fallback to the default local dev). */
const WEBSOCKET_URL =
  process.env.NEXT_PUBLIC_WEBSOCKET_URL ?? "ws://localhost:3002";

/** Delay (ms) before reconnecting after an unexpected close or error. */
const RECONNECT_DELAY_MS = 3000;

/**
 * Reusable WebSocket connection hook.
 *
 * Establishes a single connection, tracks its lifecycle, transparently
 * reconnects on unexpected close/error, and invokes `onMessage` for every
 * inbound JSON message. Cleans up on unmount. Because no WebSocket server
 * exists yet, the connection will naturally settle into the `disconnected`
 * state, which the UI surfaces as a warning.
 */
export function useWebSocket({
  token,
  onMessage,
}: UseWebSocketOptions = {}): UseWebSocketResult {
  const [connectionStatus, setConnectionStatus] =
    useState<WebSocketStatus>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;

    const connect = () => {
      if (disposedRef.current) return;

      setConnectionStatus("connecting");

      const url = new URL(WEBSOCKET_URL);
      if (token) url.searchParams.set("token", token);

      let socket: WebSocket;
      try {
        socket = new WebSocket(url.toString());
      } catch {
        // Invalid URL or environment prevents construction.
        setConnectionStatus("error");
        scheduleReconnect();
        return;
      }
      socketRef.current = socket;

      socket.onmessage = (event) => {
        if (disposedRef.current || typeof event.data !== "string") return;
        try {
          onMessage?.(JSON.parse(event.data));
        } catch {
          // Ignore non-JSON/ping frames.
        }
      };

      socket.onopen = () => {
        if (disposedRef.current) return;
        setConnectionStatus("connected");
      };

      socket.onclose = () => {
        if (disposedRef.current) return;
        setConnectionStatus("disconnected");
        scheduleReconnect();
      };

      socket.onerror = () => {
        if (disposedRef.current) return;
        setConnectionStatus("error");
        // `onclose` will fire after `onerror`; avoid double reconnect there.
        socket.close();
      };
    };

    const scheduleReconnect = () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(() => {
        if (!disposedRef.current) connect();
      }, RECONNECT_DELAY_MS);
    };

    connect();

    return () => {
      disposedRef.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      const socket = socketRef.current;
      if (socket) {
        socket.onmessage = null;
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
        socketRef.current = null;
      }
    };
  }, [token, onMessage]);

  return {
    connectionStatus,
    isConnected: connectionStatus === "connected",
  };
}
