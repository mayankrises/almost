"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getSocket } from "./socketSingleton";
import type { MetricsPacket } from "./useMetricsSender";

export interface ClientSession {
  id: string;
  stream: MediaStream | null;
  metrics: MetricsPacket | null;
  status: "connecting" | "connected" | "failed";
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export function useAdminWebRTC() {
  const [clients, setClients] = useState<Record<string, ClientSession>>({});
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const [socketStatus, setSocketStatus] = useState<"connected" | "disconnected">("disconnected");

  const updateClient = useCallback((id: string, updates: Partial<ClientSession>) => {
    setClients(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { id, stream: null, metrics: null, status: "connecting" }), ...updates }
    }));
  }, []);

  const cleanupClient = useCallback((id: string) => {
    console.log(`[Admin WebRTC] 🧼 Cleaning up client ${id}`);
    pcsRef.current.get(id)?.close();
    pcsRef.current.delete(id);
    iceQueuesRef.current.delete(id);
    setClients(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleOffer = useCallback(async (clientId: string, offer: RTCSessionDescriptionInit) => {
    console.log(`[Admin WebRTC] 📥 Received offer from client: ${clientId}`);
    
    if (pcsRef.current.has(clientId)) {
      pcsRef.current.get(clientId)?.close();
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcsRef.current.set(clientId, pc);
    iceQueuesRef.current.set(clientId, []);

    pc.ontrack = (e) => {
      console.log(`[Admin WebRTC] 🛤️ Stream attached for: ${clientId}`);
      updateClient(clientId, { stream: e.streams[0], status: "connected" });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit("signal", { to: clientId, type: "ice-candidate", payload: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[Admin WebRTC] 🚦 Connection State [${clientId}]: ${pc.connectionState}`);
      updateClient(clientId, { status: pc.connectionState as any });
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log(`[Admin WebRTC] ✅ Offer applied for ${clientId}`);

      const queue = iceQueuesRef.current.get(clientId) || [];
      while(queue.length) {
        await pc.addIceCandidate(new RTCIceCandidate(queue.shift()!));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log(`[Admin WebRTC] 📤 Sending ANSWER back to ${clientId}`);
      socketRef.current?.emit("signal", { to: clientId, type: "answer", payload: answer });
    } catch (err) {
      console.error(`[Admin WebRTC] ❌ Negotiation error for ${clientId}`, err);
    }
  }, [updateClient]);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("connected");
      console.log("[Admin WebRTC] 🆔 Identifying as admin...");
      socket.emit("identify", "admin");
    });

    socket.on("disconnect", () => setSocketStatus("disconnected"));

    socket.on("client-joined", ({ clientId }) => {
      console.log(`[Admin WebRTC] 📱 New client detected: ${clientId}`);
      // Fallback request in case server's auto-negotiate misses
      socket.emit("request-offer", { targetId: clientId });
    });

    socket.on("client-left", ({ clientId }) => cleanupClient(clientId));

    socket.on("signal", (msg: any) => {
      const from = msg.from;
      if (!from || from === "admin") return;

      if (msg.type === "offer") handleOffer(from, msg.payload);
      else if (msg.type === "ice-candidate") {
        const pc = pcsRef.current.get(from);
        if (pc?.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(msg.payload));
        } else {
          iceQueuesRef.current.get(from)?.push(msg.payload);
        }
      }
    });

    socket.on("metrics", (packet: MetricsPacket & { clientId: string }) => {
      if (packet.clientId) updateClient(packet.clientId, { metrics: packet });
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("client-joined");
      socket.off("client-left");
      socket.off("signal");
      socket.off("metrics");
    };
  }, [handleOffer, cleanupClient, updateClient]);

  return { clients, socketStatus };
}
