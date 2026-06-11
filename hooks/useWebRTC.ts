"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { getSocket } from "./socketSingleton";

export interface WebRTCState {
  status: "idle" | "connecting" | "connected" | "failed";
  localStream: MediaStream | null;
  error: string | null;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
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

export function useWebRTC(signalingUrl?: string, roomId: string = "default", clientId: string | null = null) {
  const [state, setState] = useState<WebRTCState>({ status: "idle", localStream: null, error: null });
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const iceQueue = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    let cancelled = false;
    const socket = getSocket(signalingUrl);
    socketRef.current = socket;

    async function start() {
      try {
        console.log("[Client WebRTC] 🎬 Initializing...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) return;

        streamRef.current = stream;
        setState(s => ({ ...s, localStream: stream }));
        console.log("[Client WebRTC] 📸 Camera started.");

        const identify = () => {
          console.log(`[Client WebRTC] 🆔 Identifying as client: ${clientId || socket.id}`);
          socket.emit("identify", "client");
        };

        if (socket.connected) identify();
        socket.on("connect", identify);

        socket.on("request-offer", async (data: { adminId: string }) => {
          console.log(`[Client WebRTC] ⚡ Admin (${data.adminId}) requested offer.`);
          await initiateNegotiation(data.adminId || "admin");
        });

        socket.on("signal", async (msg: any) => {
          if (msg.type === "answer") {
            if (pcRef.current) {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.payload));
              console.log("[Client WebRTC] ✅ Remote description (ANSWER) applied.");
              while(iceQueue.current.length) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(iceQueue.current.shift()!));
              }
            }
          } else if (msg.type === "ice-candidate") {
            if (pcRef.current?.remoteDescription) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload));
            } else {
              iceQueue.current.push(msg.payload);
            }
          }
        });

      } catch (err: any) {
        console.error("[Client WebRTC] ❌ Initialization failed:", err);
        setState(s => ({ ...s, status: "failed", error: err.message }));
      }
    }

    async function initiateNegotiation(targetId: string) {
      if (pcRef.current) pcRef.current.close();
      
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      iceQueue.current = [];

      streamRef.current?.getTracks().forEach(t => pc.addTrack(t, streamRef.current!));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current?.emit("signal", { 
            to: targetId, 
            from: socketRef.current?.id || clientId, 
            type: "ice-candidate", 
            payload: e.candidate.toJSON() 
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[Client WebRTC] 🌐 ICE connection state: ${pc.iceConnectionState}`);
      };

      pc.onconnectionstatechange = () => {
        console.log(`[Client WebRTC] 🚦 Connection state: ${pc.connectionState}`);
        setState(s => ({ ...s, status: pc.connectionState as any }));
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log(`[Client WebRTC] 📤 Offer sent to admin (${targetId})`);
      socketRef.current?.emit("signal", { 
        to: targetId, 
        from: socketRef.current?.id || clientId, 
        type: "offer", 
        payload: offer 
      });
    }

    start();

    return () => {
      cancelled = true;
      socket.off("connect");
      socket.off("request-offer");
      socket.off("signal");
      if (pcRef.current) pcRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [signalingUrl, clientId]);

  return state;
}

