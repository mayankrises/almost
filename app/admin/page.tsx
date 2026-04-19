"use client";

import React, { useEffect, useRef, useMemo, memo } from "react";
import { useAdminWebRTC, ClientSession } from "../../hooks/useAdminWebRTC";
import styles from "./admin.module.css";

// ── Optimized Admin Dashboard ──────────────────────────────────────────────────
export default function AdminPage() {
  const { clients, socketStatus } = useAdminWebRTC();
  
  // Extract stable list of IDs to prevent unnecessary list re-renders
  const clientIds = useMemo(() => Object.keys(clients).sort(), [clients]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="url(#ag)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="ag" x1="2" y1="2" x2="22" y2="22">
                <stop stopColor="#6366f1" /><stop offset="1" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          <span className={styles.logoText}>VeriStream Node</span>
          <span className={styles.badge}>{clientIds.length} ACTIVE</span>
        </div>
        
        <div className={`${styles.pill} ${socketStatus === 'connected' ? styles.pillLive : styles.pillOff}`}>
          <span className={styles.pillDot} />
          {socketStatus === 'connected' ? 'CLUSTER ONLINE' : 'SIGNALING OFFLINE'}
        </div>
      </header>

      <main className={styles.main}>
        {clientIds.length === 0 ? (
          <div className={styles.waiting}>
            <div className={styles.spinner} />
            <p>Scanning for behavioral pulses...</p>
          </div>
        ) : (
          <div className={styles.userGrid}>
            {clientIds.map((id) => (
              <ClientFeed key={id} data={clients[id]} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Optimized Client Card (Memoized with stable references) ──────────────────
const ClientFeed = memo(({ data }: { data: ClientSession }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { id, stream, metrics, status } = data;

  // Stable stream assignment via ref to prevent flickering
  useEffect(() => {
    if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
      console.log(`[Admin UI] 🎥 Attaching stream for: ${id}`);
      videoRef.current.srcObject = stream;
    }
  }, [stream, id]);

  const isFocusLost = metrics ? !metrics.tabActive : false;
  const isFaceMissing = metrics ? !metrics.face.detected : false;

  return (
    <div className={`${styles.userCard} ${isFocusLost ? styles.cardWarning : ''}`}>
      <div className={styles.userHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: status === 'connected' ? '#4ade80' : '#fbbf24' }} />
          <span className={styles.userId}>U: {id.slice(0, 8)}</span>
        </div>
        <div className={`${styles.pill} ${status === 'connected' ? styles.pillLive : styles.pillOff}`} style={{ padding: '2px 8px', fontSize: '9px' }}>
            {status.toUpperCase()}
        </div>
      </div>

      <div className={styles.userBody}>
        <div className={styles.videoSection}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={styles.video}
          />
          
          {metrics && (
            <div className={`${styles.faceChip} ${!isFaceMissing ? styles.chipGreen : styles.chipRed}`}>
              <span className={styles.chipDot} />
              {!isFaceMissing ? "Identity Verified" : "Subject Missing"}
            </div>
          )}

          {isFocusLost && (
            <div className={styles.overlay}>
              <div className={styles.overlayInner}>
                 <span>TAB BLUR</span>
                 <small>Non-compliant state</small>
              </div>
            </div>
          )}
        </div>

        {/* Telemetry Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {metrics ? (
            <>
              {/* Attention Metrics */}
              <div className={styles.card} style={{ gridColumn: 'span 2', padding: '12px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#818cf8' }}>ATTENTION SCORE</span>
                  <span style={{ fontSize: '12px', fontWeight: 900, color: '#f1f5f9' }}>
                    {metrics.totalFrames > 0 ? ((metrics.lookingInsideFrames / metrics.totalFrames) * 100).toFixed(0) : "0"}%
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    background: '#818cf8', 
                    width: `${metrics.totalFrames > 0 ? (metrics.lookingInsideFrames / metrics.totalFrames) * 100 : 0}%`,
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                   <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '8px', color: '#94a3b8' }}>SUSPICION</div>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: '#f87171' }}>
                        {metrics.totalFrames > 0 ? ((metrics.lookingOutsideFrames / metrics.totalFrames) * 100).toFixed(0) : "0"}%
                      </div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '8px', color: '#94a3b8' }}>VERDICT</div>
                      <div style={{ 
                        fontSize: '12px', 
                        fontWeight: 900, 
                        color: (metrics.lookingInsideFrames / (metrics.totalFrames || 1)) > 0.8 ? '#4ade80' : '#f87171' 
                      }}>
                        {(metrics.lookingInsideFrames / (metrics.totalFrames || 1)) > 0.8 ? 'TRUSTED' : 'SUSPECT'}
                      </div>
                   </div>
                </div>
              </div>

              <StatBlock 
                  label="Attention" 
                  value={`${metrics.totalFrames > 0 ? ((metrics.lookingInsideFrames / metrics.totalFrames) * 100).toFixed(0) : "0"}%`} 
                  alert={(metrics.lookingInsideFrames / (metrics.totalFrames || 1)) < 0.8}
              />
              <StatBlock 
                  label="Suspicion" 
                  value={`${metrics.totalFrames > 0 ? ((metrics.lookingOutsideFrames / metrics.totalFrames) * 100).toFixed(0) : "0"}%`} 
                  alert={(metrics.lookingOutsideFrames / (metrics.totalFrames || 1)) > 0.2}
              />
              
              <div className={styles.card} style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', padding: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                   <Indicator label={metrics.isLookingInside ? "LOOKING INSIDE" : "LOOKING OUT"} active={true} color={metrics.isLookingInside ? "#4ade80" : "#f87171"} />
                </div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#475569' }}>
                    SAMPLES: {metrics.lookingInsideFrames} / {metrics.totalFrames}
                </div>
              </div>
            </>
          ) : (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '20px', fontSize: '11px', color: '#64748b' }}>
                Awaiting Data Sync...
            </div>
          )}
        </div>

      </div>
    </div>
  );
}, (prev, next) => {
  // Deep comparison to ensure only this specific client component re-renders when its metrics or status change
  return prev.data.id === next.data.id && 
         prev.data.status === next.data.status && 
         prev.data.stream === next.data.stream && 
         prev.data.metrics?.timestamp === next.data.metrics?.timestamp;
});

ClientFeed.displayName = "ClientFeed";

// ── Atom Components ─────────────────────────────────────────────────────────

function StatBlock({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={styles.card} style={{ 
        padding: '8px 10px', 
        borderLeft: alert ? '3px solid #f87171' : '3px solid #6366f1',
        background: alert ? 'rgba(248, 113, 113, 0.03)' : undefined
    }}>
      <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 800, color: alert ? '#f87171' : '#f1f5f9' }}>{value}</div>
    </div>
  );
}

function Indicator({ label, active, color }: { label: string; active: boolean; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: active ? 1 : 0.3 }}>
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: active ? color : '#94a3b8' }} />
      <span style={{ fontSize: '9px', fontWeight: 800, color: active ? '#f1f5f9' : '#94a3b8' }}>{label}</span>
    </div>
  );
}
