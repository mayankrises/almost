"use client";

import { useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getSocket } from "./socketSingleton";
import type { LivenessData } from "./useLivenessData";
import type { TypingMetrics } from "./useTypingMetrics";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface MetricsPacket {
  timestamp: number;
  face: LivenessData["face"];
  headPose: LivenessData["headPose"];
  gaze: LivenessData["gaze"];
  faceCenter: LivenessData["faceCenter"];
  blink: boolean;
  tabActive: boolean;
  typing: TypingMetrics;
  // Gaze Calibration Extras
  isLookingInside: boolean;
  totalFrames: number;
  lookingInsideFrames: number;
  lookingOutsideFrames: number;
}

const TARGET_FPS = 10;
const INTERVAL_MS = Math.round(1000 / TARGET_FPS);

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useMetricsSender(
  livenessData: LivenessData & { gazeRef?: React.RefObject<{ x: number; y: number } | null> },
  typingMetrics: TypingMetrics,
  calibrationBox: { left: number; right: number; top: number; bottom: number } | null,
  signalingUrl: string | undefined = undefined,
  roomId: string = "default",
  clientId?: string
) {
  const socketRef = useRef<Socket | null>(null);
  const tabActiveRef = useRef(true);
  
  // Gaze Frame Tracking
  const frameStats = useRef({
    total: 0,
    inside: 0
  });

  // Latest data refs
  const livenessRef = useRef(livenessData);
  livenessRef.current = livenessData;
  const typingRef = useRef(typingMetrics);
  typingRef.current = typingMetrics;
  const calibrationRef = useRef(calibrationBox);
  calibrationRef.current = calibrationBox;

  // ── Visibility Logic ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => { tabActiveRef.current = document.visibilityState === "visible"; };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // ── Socket connection + sending loop ───────────────────────────────────────
  useEffect(() => {
    const socket = getSocket(signalingUrl);
    socketRef.current = socket;

    // Use a Web Worker for reliable background timing
    const worker = new Worker("/workers/timerWorker.js");

    const startWorker = () => {
      socket.emit("identify", "client");
      worker.postMessage({ action: "start", interval: INTERVAL_MS });
    };

    if (socket.connected) startWorker();
    socket.on("connect", startWorker);

    worker.onmessage = () => {
      if (!socketRef.current?.connected) return;

      const gaze = livenessRef.current.gazeRef?.current || livenessRef.current.gaze;
      const box = calibrationRef.current;
      
      let isInside = true;
      if (box && gaze) {
        isInside = (
          gaze.x >= box.left && 
          gaze.x <= box.right && 
          gaze.y >= box.top && 
          gaze.y <= box.bottom
        );
        
        // Update counters
        frameStats.current.total++;
        if (isInside) frameStats.current.inside++;
      }

      const packet: MetricsPacket = {
        timestamp: Date.now(),
        face: livenessRef.current.face,
        headPose: livenessRef.current.headPose,
        gaze: gaze,
        faceCenter: livenessRef.current.faceCenter,
        blink: livenessRef.current.blink,
        tabActive: tabActiveRef.current,
        typing: typingRef.current,
        // Gaze stats
        isLookingInside: isInside,
        totalFrames: frameStats.current.total,
        lookingInsideFrames: frameStats.current.inside,
        lookingOutsideFrames: frameStats.current.total - frameStats.current.inside,
      };

      socketRef.current.emit("metrics", packet);
    };

    return () => {
      worker.postMessage({ action: "stop" });
      worker.terminate();
      socket.off("connect");
    };
  }, [signalingUrl]);
}

