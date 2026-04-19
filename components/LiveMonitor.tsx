"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useLivenessData } from "@/hooks/useLivenessData";
import { useTypingMetrics } from "@/hooks/useTypingMetrics";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useMetricsSender } from "@/hooks/useMetricsSender";
import { useGazeCalibration } from "@/hooks/useGazeCalibration";
import type { MetricsPacket } from "@/hooks/useMetricsSender";
import styles from "./LiveMonitor.module.css";

export default function LiveMonitor({ roomId = "default" }: { roomId?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => { setMounted(true); }, []);
  
  // Generate a strict session identity to bind video and metrics sockets together
  const clientId = useMemo(() => typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).substring(7), []);

  // ── Hooks ────────────────────────────────────────────────────────────────────
  const livenessData = useLivenessData(videoRef);
  const typingMetrics = useTypingMetrics();
  const webrtcState = useWebRTC(undefined, roomId, clientId);

  // Gaze Calibration Logic
  const {
    step,
    stepIndex,
    totalSteps,
    isCalibrating,
    isCalibrated,
    calibrationBox,
    startCalibration
  } = useGazeCalibration(livenessData.gazeRef);

  // Metrics sender
  useMetricsSender(livenessData, typingMetrics, calibrationBox, undefined, roomId, clientId);

  // ── Attach local stream to video element ─────────────────────────────────────
  useEffect(() => {
    if (webrtcState.localStream && videoRef.current) {
      videoRef.current.srcObject = webrtcState.localStream;
      setCameraReady(true);
    }
    if (webrtcState.error) {
      setPermissionError(webrtcState.error);
    }
  }, [webrtcState.localStream, webrtcState.error]);

  // ── Derived state ────────────────────────────────────────────────────────────
  const faceDetected = livenessData.face.detected;
  const confidence = livenessData.face.confidence;

  const currentPacket = {
    timestamp: Date.now(),
    face: livenessData.face,
    headPose: livenessData.headPose,
    gaze: livenessData.gaze,
    blink: livenessData.blink,
    tabActive: mounted ? (typeof document !== "undefined" ? document.visibilityState === "visible" : true) : true,
    isCalibrated,
  };


  return (
    <div className={styles.container}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="url(#grad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="grad" x1="2" y1="2" x2="22" y2="22">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className={styles.logoText}>VeriStream Focus</span>
        </div>
        <div className={styles.headerRight}>
           {!isCalibrated && !isCalibrating && (
             <button onClick={startCalibration} className={styles.calibrateBtn}>
               Start Gaze Calibration
             </button>
           )}
          <div
            className={`${styles.statusPill} ${
              webrtcState.status === "connected"
                ? styles.statusLive
                : webrtcState.status === "connecting"
                ? styles.statusConnecting
                : styles.statusOffline
            }`}
          >
            <span className={styles.statusDot} />
            {webrtcState.status === "connected" ? "SYNCED" : "OFFLINE"}
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className={styles.main}>
        {/* ── Video panel ─────────────────────────────────────────── */}
        <div className={styles.videoPanel}>
          <div className={styles.videoContainer}>
            {permissionError && (
              <div className={styles.errorOverlay}>
                <div className={styles.errorIcon}>⚠️</div>
                <p className={styles.errorText}>Camera Access Required</p>
                <p className={styles.errorSub}>{permissionError}</p>
              </div>
            )}
            
            {/* Calibration UI */}
            {isCalibrating && (
              <div className={styles.calibrationOverlay}>
                <div className={styles.calibrationLabel}>
                  LOOK AT THE DOT TO CALIBRATE ({stepIndex + 1}/{totalSteps})
                  <div className={styles.calibrationStep}>{step}</div>
                </div>
                <CalibrationTarget step={step} />
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={styles.video}
            />

            {/* Gaze Bounding Box Visualizer */}
            {calibrationBox && (
              <div
                className={styles.calibrationBox}
                style={{
                  left: `${(calibrationBox.left) * 100}%`,
                  top: `${(calibrationBox.top) * 100}%`,
                  width: `${(calibrationBox.right - calibrationBox.left) * 100}%`,
                  height: `${(calibrationBox.bottom - calibrationBox.top) * 100}%`,
                }}
              />
            )}

            {/* Live Gaze Dot */}
            <GazePointer gazeRef={livenessData.gazeRef} />

            <div className={`${styles.faceIndicator} ${faceDetected ? styles.faceDetected : styles.faceNotDetected}`}>
              <span className={styles.faceDot} />
              {faceDetected ? "Identity Fixed" : "Searching Identity"}
            </div>

            {/* Corner scan lines */}
            <div className={`${styles.corner} ${styles.cornerTL}`} />
            <div className={`${styles.corner} ${styles.cornerTR}`} />
            <div className={`${styles.corner} ${styles.cornerBL}`} />
            <div className={`${styles.corner} ${styles.cornerBR}`} />
          </div>
        </div>


        {/* ── Metrics panel ───────────────────────────────────────── */}
        <div className={styles.metricsPanel}>
          <h2 className={styles.metricsTitle}>Live Telemetry</h2>

          {/* Head Pose */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricIcon}>🧭</span>
              <span>Head Pose</span>
            </div>
            <div className={styles.metricGrid}>
              <MetricValue label="Yaw" value={livenessData.headPose.yaw} unit="°" />
              <MetricValue label="Pitch" value={livenessData.headPose.pitch} unit="°" />
              <MetricValue label="Roll" value={livenessData.headPose.roll} unit="°" />
            </div>
          </div>

          {/* Gaze */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricIcon}>👁️</span>
              <span>Gaze Direction</span>
            </div>
            <div className={styles.metricGrid}>
              <MetricValue label="X" value={livenessData.gaze.x} />
              <MetricValue label="Y" value={livenessData.gaze.y} />
            </div>
          </div>


          {/* Blink & Tab */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricIcon}>👁️</span>
              <span>Blink & Focus</span>
            </div>
            <div className={styles.metricRow}>
              <div className={styles.boolChip}>
                <span
                  className={`${styles.boolDot} ${
                    livenessData.blink ? styles.dotRed : styles.dotGreen
                  }`}
                />
                {livenessData.blink ? "Blinking" : "Eyes Open"}
              </div>
              <div className={styles.boolChip}>
                <span
                  className={`${styles.boolDot} ${
                    currentPacket.tabActive ? styles.dotGreen : styles.dotRed
                  }`}
                />
                {currentPacket.tabActive ? "Tab Active" : "Tab Hidden"}
              </div>
            </div>
          </div>

          {/* Typing */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricIcon}>⌨️</span>
              <span>Typing Dynamics</span>
            </div>
            <div className={styles.metricGrid}>
              <MetricValue
                label="Keystrokes"
                value={typingMetrics.keystrokes}
              />
              <MetricValue
                label="Speed"
                value={typingMetrics.currentSpeed}
                unit=" k/s"
              />
              <MetricValue
                label="Interval"
                value={typingMetrics.lastKeyInterval}
                unit="ms"
              />
              <MetricValue
                label="Variance"
                value={Math.round(typingMetrics.intervalVariance)}
                unit=""
              />
            </div>
          </div>

          {/* JSON preview */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricIcon}>📦</span>
              <span>Outgoing Packet</span>
            </div>
            <pre className={styles.jsonPreview}>
              {mounted ? JSON.stringify(currentPacket, null, 2) : "{ \"status\": \"initializing...\" }"}
            </pre>
          </div>
        </div>
      </main>

      {/* ── Typing test area ────────────────────────────────────────── */}
      <div className={styles.typingArea}>
        <input
          type="text"
          placeholder="Type here to generate typing metrics…"
          className={styles.typingInput}
        />
      </div>
    </div>
  );
}

// ── Sub-components & Helpers ──────────────────────────────────────────────────
function CalibrationTarget({ step }: { step: string }) {
  const position = useMemo(() => {
    switch (step) {
      case "CENTER": return { left: "50%", top: "50%" };
      case "LEFT":   return { left: "10%", top: "50%" };
      case "RIGHT":  return { left: "90%", top: "50%" };
      case "TOP":    return { left: "50%", top: "10%" };
      case "BOTTOM": return { left: "50%", top: "90%" };
      default:       return { left: "50%", top: "50%" };
    }
  }, [step]);

  return (
    <div className={styles.targetWrapper} style={position}>
      <div className={styles.targetOuter}>
        <div className={styles.targetInner} />
      </div>
    </div>
  );
}

function GazePointer({ gazeRef }: { gazeRef: React.RefObject<{ x: number; y: number } | null> }) {
  const pointerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let anim: number;
    const loop = () => {
      if (pointerRef.current && gazeRef.current) {
        const { x, y } = gazeRef.current;
        pointerRef.current.style.left = `${x * 100}%`;
        pointerRef.current.style.top = `${y * 100}%`;
        pointerRef.current.style.opacity = "1";
      }
      anim = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(anim);
  }, [gazeRef]);

  return <div ref={pointerRef} className={styles.gazePointer} />;
}

function MetricValue({ label, value, unit = "" }: { label: string; value: number; unit?: string }) {
  return (
    <div className={styles.metricValue}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricNum}>
        {value}
        <span className={styles.metricUnit}>{unit}</span>
      </span>
    </div>
  );
}

