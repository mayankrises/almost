"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./landing.module.css";

export default function LandingPage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  
  // Simulated metrics for the tech preview
  const [simulatedMetrics, setSimulatedMetrics] = useState({
    yaw: "0.2°",
    pitch: "-1.1°",
    roll: "0.4°",
    gazeX: "0.52",
    gazeY: "0.48",
    status: "SYNCED",
    tabState: "Active",
    keystrokes: "142",
    wpm: "64",
    blinkRate: "12 / min",
    attentionScore: "96%",
  });

  // Generate random room ID helper
  const generateRandomRoomId = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  useEffect(() => {
    // Generate a default room ID on mount
    setRoomId(generateRandomRoomId());

    // Simulated telemetry changes to look "alive"
    const interval = setInterval(() => {
      const yawNum = Math.random() * 4 - 2;
      const pitchNum = Math.random() * 3 - 1.5;
      const rollNum = Math.random() * 2 - 1;
      const yawVal = yawNum.toFixed(1);
      const pitchVal = pitchNum.toFixed(1);
      const rollVal = rollNum.toFixed(1);
      const gazeXVal = (0.48 + Math.random() * 0.08).toFixed(2);
      const gazeYVal = (0.46 + Math.random() * 0.08).toFixed(2);
      const keystrokesVal = Math.floor(140 + Math.random() * 20).toString();
      const wpmVal = Math.floor(58 + Math.random() * 12).toString();
      const attentionVal = Math.floor(92 + Math.random() * 7).toString() + "%";

      setSimulatedMetrics((prev) => ({
        ...prev,
        yaw: `${yawNum > 0 ? "+" : ""}${yawVal}°`,
        pitch: `${pitchNum > 0 ? "+" : ""}${pitchVal}°`,
        roll: `${rollNum > 0 ? "+" : ""}${rollVal}°`,
        gazeX: gazeXVal,
        gazeY: gazeYVal,
        keystrokes: keystrokesVal,
        wpm: wpmVal,
        attentionScore: attentionVal,
        status: Math.random() > 0.05 ? "SYNCED" : "RE-BUFFERING",
      }));
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      router.push(`/room/${roomId.trim()}`);
    }
  };

  const handleGoToAdmin = () => {
    router.push("/admin");
  };

  return (
    <div className={styles.container}>
      {/* ── Header ── */}
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
          <span className={styles.logoText}>VeriStream</span>
        </div>
        <nav className={styles.navLinks}>
          <button onClick={handleGoToAdmin} className={styles.navButton}>
            Admin Dashboard
          </button>
        </nav>
      </header>

      {/* ── Main Content ── */}
      <main className={styles.main}>
        {/* Left Column: Copy & Actions */}
        <section className={styles.hero}>
          <div className={styles.badge}>Next-Gen Integrity Engine</div>
          <h1 className={styles.title}>
            Continuous Behavioral <br />
            Verification.
          </h1>
          <p className={styles.subtitle}>
            VeriStream provides zero-trust behavioral integrity testing. Track gaze vector dynamics, head posture deviations, blink cycles, and keystroke metrics in real time.
          </p>

          <div className={styles.actions}>
            <form onSubmit={handleJoinRoom} className={styles.roomForm}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#a5b4fc" }}>
                SESSION LAUNCH CONSOLE
              </div>
              <div className={styles.inputGroup}>
                <input
                  type="text"
                  placeholder="Enter Room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className={styles.input}
                  required
                />
                <button
                  type="button"
                  title="Generate Random ID"
                  onClick={() => setRoomId(generateRandomRoomId())}
                  className={styles.randomBtn}
                >
                  ⚡
                </button>
              </div>
              <button type="submit" className={styles.submitBtn}>
                Launch Candidate Room 🚀
              </button>
            </form>

            <button onClick={handleGoToAdmin} className={styles.adminBtn}>
              Enter Admin Control Node 🛡️
            </button>
          </div>
        </section>

        {/* Right Column: Cybernetic Live Telemetry Preview */}
        <section className={styles.showcase}>
          <div className={styles.telemetryWindow}>
            <div className={styles.windowHeader}>
              <div className={styles.windowTitle}>
                <span className={styles.pulseDot} />
                Live Bio-Scanner Preview
              </div>
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  color: simulatedMetrics.status === "SYNCED" ? "#34d399" : "#fbbf24",
                  background: simulatedMetrics.status === "SYNCED" ? "rgba(52, 211, 153, 0.1)" : "rgba(251, 191, 36, 0.1)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: simulatedMetrics.status === "SYNCED" ? "1px solid rgba(52, 211, 153, 0.2)" : "1px solid rgba(251, 191, 36, 0.2)",
                }}
              >
                {simulatedMetrics.status}
              </div>
            </div>

            {/* Mock Video camera box */}
            <div className={styles.mockCamera}>
              <div className={styles.scanLine} />
              
              {/* Animated Face Outline */}
              <div className={styles.mockFaceGrid}>
                <div className={styles.faceMeshMock}>
                  <div className={styles.faceMeshEyeL} />
                  <div className={styles.faceMeshEyeR} />
                  <div className={styles.faceMeshNose} />
                  <div className={styles.faceMeshMouth} />
                </div>
              </div>

              {/* Animated Gaze Tracker */}
              <div className={styles.gazePoint} />
              <div className={styles.gazeTracer} />

              <div
                style={{
                  position: "absolute",
                  bottom: "8px",
                  left: "8px",
                  fontSize: "9px",
                  color: "#a855f7",
                  fontWeight: 700,
                  background: "rgba(0,0,0,0.6)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid rgba(168,85,247,0.3)"
                }}
              >
                IDENTITY: LOCAL_PREVIEW
              </div>
            </div>

            {/* Live Changing Stats list */}
            <div className={styles.metricRows}>
              <div className={styles.metricRow}>
                <div className={styles.metricLabel}>
                  <span>🧭</span> Head Yaw / Pitch / Roll
                </div>
                <div className={styles.metricVal}>
                  {simulatedMetrics.yaw} | {simulatedMetrics.pitch} | {simulatedMetrics.roll}
                </div>
              </div>

              <div className={styles.metricRow}>
                <div className={styles.metricLabel}>
                  <span>👁️</span> Gaze Direction Vector (X, Y)
                </div>
                <div className={styles.metricVal}>
                  ({simulatedMetrics.gazeX}, {simulatedMetrics.gazeY})
                </div>
              </div>

              <div className={styles.metricRow}>
                <div className={styles.metricLabel}>
                  <span>⌨️</span> Keystrokes / WPM Rate
                </div>
                <div className={styles.metricVal}>
                  {simulatedMetrics.keystrokes} Keys | {simulatedMetrics.wpm} WPM
                </div>
              </div>

              <div className={styles.metricRow}>
                <div className={styles.metricLabel}>
                  <span>🎯</span> Compliance Score
                </div>
                <div className={`${styles.metricVal} ${styles.metricValAlert}`}>
                  {simulatedMetrics.attentionScore}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Feature Section ── */}
      <section className={styles.featuresSection}>
        <div className={styles.featuresHeader}>
          <h2 className={styles.featuresTitle}>Multi-Dimensional Verification</h2>
          <p className={styles.featuresSub}>
            Zero external hardware. VeriStream analyzes behavioral attributes right from client browsers with state-of-the-art vision models.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>👁️</div>
            <h3 className={styles.featureCardName}>Calibration Gaze System</h3>
            <p className={styles.featureCardDesc}>
              A 5-point calibration grid builds an adaptive model mapped to candidate screen boundaries, detecting rapid ocular focus shifts instantly.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🧭</div>
            <h3 className={styles.featureCardName}>Posture Pose Vector</h3>
            <p className={styles.featureCardDesc}>
              Continuous computation of yaw, pitch, and roll angles flags abnormal deviations when looking away from workspace layouts.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>⌨️</div>
            <h3 className={styles.featureCardName}>Keyboard Cadence</h3>
            <p className={styles.featureCardDesc}>
              Measures keystroke interval time dynamics and speed variances, identifying unique interactive patterns and anomaly events.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>⚡</div>
            <h3 className={styles.featureCardName}>Ultra-Low Latency</h3>
            <p className={styles.featureCardDesc}>
              WebRTC peer streaming combined with light WebSockets ensures latency-free transmission of video frames and telemetry packets.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.copyright}>
            &copy; {new Date().getFullYear()} VeriStream Suite. All rights reserved.
          </div>
          <div className={styles.systemStatus}>
            <span className={styles.statusIndicator} />
            All nodes operating normally
          </div>
        </div>
      </footer>
    </div>
  );
}
