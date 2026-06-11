"use client";

import { useEffect, useRef, useState, use } from "react";
import { io, Socket } from "socket.io-client";
import type { MetricsPacket } from "@/hooks/useMetricsSender";
import styles from "../../admin/admin.module.css";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
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

interface ClientSession {
  connected: boolean;
  stream: MediaStream | null;
  metrics: MetricsPacket | null;
}

export default function RoomAdminPage({ params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId;

  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const iceQueuesRef = useRef<Record<string, any[]>>({});
  const socketRef = useRef<Socket | null>(null);

  const [clients, setClients] = useState<Record<string, ClientSession>>({});
  const [globalConnected, setGlobalConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    console.log(`[Admin] Initializing unified WebSocket connection for room: ${roomId}...`);
    const localSocket = io(undefined, {
      transports: ["websocket"],
      reconnectionAttempts: 10,
    });
    socketRef.current = localSocket;

    const getOrCreatePC = (senderId: string) => {
      let pc = pcsRef.current[senderId];
      if (!pc || (pc.signalingState as string) === "closed") {
        console.log(`[Admin] Structuring new RTCPeerConnection for client ${senderId}`);
        pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcsRef.current[senderId] = pc;

        // Initialize state
        setClients(prev => ({
          ...prev,
          [senderId]: prev[senderId] || { connected: false, stream: null, metrics: null }
        }));

        pc.ontrack = (event) => {
          if (cancelled) return;
          console.log(`[Admin] 🎥 Remote ${event.track.kind} track received from ${senderId}`);
          
          setClients(prev => {
            const currentClient = prev[senderId] || { connected: false, stream: null, metrics: null };
            let mediaStream = currentClient.stream;
            
            if (!mediaStream) {
               mediaStream = new MediaStream();
            }
            
            // Add track manually in case the streaming client (e.g. iOS Safari) didn't bundle it into event.streams[0]
            mediaStream.addTrack(event.track);
            console.log(`[Admin] Bound track to local MediaStream proxy for ${senderId}. Total tracks: ${mediaStream.getTracks().length}`);
            
            return {
              ...prev,
              [senderId]: { ...currentClient, stream: mediaStream, connected: true }
            };
          });
        };

        pc.oniceconnectionstatechange = () => {
          if (cancelled) return;
          console.log(`[Admin] 🌐 ICE Connection State for ${senderId}: ${pc.iceConnectionState}`);
        };

        pc.onicecandidate = (e) => {
          if (e.candidate && localSocket && !cancelled) {
            localSocket.emit("signal", {
              type: "ice-candidate",
              payload: e.candidate.toJSON(),
              target: senderId,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (cancelled) return;
          console.log(`[Admin] Connection state for ${senderId}: ${pc.connectionState}`);
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            setClients(prev => {
              const copy = { ...prev };
              delete copy[senderId];
              return copy;
            });
            delete pcsRef.current[senderId];
          }
        };
      }
      return pc;
    };

    // Handle signaling
    localSocket.on("signal", async (msg: { type: string; payload: any; senderId: string }) => {
      if (cancelled || !msg.senderId) return;
      const targetPc = getOrCreatePC(msg.senderId);

      if (msg.type === "offer") {
        console.log(`[Admin] 📥 Received offer from client ${msg.senderId}`);
        try {
          await targetPc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          if (cancelled || (targetPc.signalingState as string) === "closed") return;
          
          // Drain any queued ICE candidates that arrived early
          const queue = iceQueuesRef.current[msg.senderId] || [];
          for (const cand of queue) {
             console.log(`[Admin] 🧊 Draining queued ICE Candidate for ${msg.senderId}...`);
             await targetPc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.error(e));
          }
          iceQueuesRef.current[msg.senderId] = [];

          const answer = await targetPc.createAnswer();
          if (cancelled || (targetPc.signalingState as string) === "closed") return;
          
          await targetPc.setLocalDescription(answer);
          if (cancelled || (targetPc.signalingState as string) === "closed") return;
          
          console.log(`[Admin] 📤 Sending answer back to client ${msg.senderId}`);
          localSocket.emit("signal", {
            type: "answer",
            payload: answer,
            target: msg.senderId
          });
        } catch (err) {
          if (!cancelled) console.error(`[Admin] Offer processing failed for ${msg.senderId}:`, err);
        }
      } else if (msg.type === "ice-candidate") {
        try {
          if (targetPc.remoteDescription) {
             await targetPc.addIceCandidate(new RTCIceCandidate(msg.payload));
             console.log(`[Admin] 🧊 Added ICE Candidate for ${msg.senderId}`);
          } else {
             if (!iceQueuesRef.current[msg.senderId]) iceQueuesRef.current[msg.senderId] = [];
             iceQueuesRef.current[msg.senderId].push(msg.payload);
             console.log(`[Admin] 🧊 Queued ICE Candidate for ${msg.senderId} (pending offer resolution)`);
          }
        } catch (err) {
          console.error(`[Admin] Failed handling ICE for ${msg.senderId}:`, err);
        }
      }
    });

    // Receive metrics
    localSocket.on("metrics", (packet: MetricsPacket & { clientId: string }) => {
      if (cancelled || !packet.clientId) return;
      setClients(prev => ({
        ...prev,
        [packet.clientId]: {
          ...(prev[packet.clientId] || { connected: false, stream: null }),
          metrics: packet
        }
      }));
    });

    localSocket.on("client-disconnected", (clientId: string) => {
      if (cancelled) return;
      console.log(`[Admin] 🔴 Client disconnected: ${clientId}`);
      setClients(prev => {
        const copy = { ...prev };
        delete copy[clientId];
        return copy;
      });
      if (pcsRef.current[clientId]) {
        pcsRef.current[clientId].close();
        delete pcsRef.current[clientId];
      }
    });

    localSocket.on("connect", () => {
      if (cancelled) return;
      console.log(`[Admin] 🟢 Connected to signaling, joining room: ${roomId}`);
      localSocket.emit("join-room", { role: "admin", roomId });
      setGlobalConnected(true);
    });

    localSocket.on("disconnect", () => {
      setGlobalConnected(false);
    });

    // POLLING: Periodically request offer for empty channels
    const pollInterval = setInterval(() => {
      if (cancelled) return;
      localSocket.emit("request-offer");
    }, 5000);

    return () => {
      console.log("[Admin] 🧹 Cleaning up connection singleton...");
      cancelled = true;
      clearInterval(pollInterval);
      Object.values(pcsRef.current).forEach(pc => pc.close());
      pcsRef.current = {};
      if (localSocket) localSocket.disconnect();
    };
  }, [roomId]);

  const activeClients = Object.entries(clients);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="url(#ag)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="ag" x1="2" y1="2" x2="22" y2="22">
                <stop stopColor="#6366f1" /><stop offset="1" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          <span className={styles.logoText}>VeriStream BaseControl</span>
          <span className={styles.badge}>ROOM: {roomId}</span>
        </div>
        <div className={`${styles.pill} ${globalConnected ? styles.pillLive : styles.pillOff}`}>
          <span className={styles.pillDot} />
          {globalConnected ? `LIVE (${activeClients.length} PEERS)` : "CONNECTING"}
        </div>
      </header>

      <main className={styles.main} style={{ flexDirection: 'column', gap: '2rem' }}>
        {activeClients.length === 0 && (
          <div className={styles.waiting} style={{ marginTop: '4rem', width: '100%' }}>
            <div className={styles.spinner} />
            <p>Waiting for clients to join room {roomId}…</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', width: '100%' }}>
          {activeClients.map(([clientId, session]) => (
            <ClientStreamCard key={clientId} clientId={clientId} session={session} />
          ))}
        </div>
      </main>
    </div>
  );
}

function ClientStreamCard({ clientId, session }: { clientId: string; session: ClientSession }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (session.stream && videoRef.current) {
      videoRef.current.srcObject = session.stream;
      videoRef.current.play().catch(e => console.error("Video play blocked:", e));
    }
  }, [session.stream]);

  const metrics = session.metrics;
  const faceDetected = metrics?.face?.detected ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#1e1e24', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
      <div style={{ position: 'relative', background: '#000', aspectRatio: '4/3' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#fff' }}>
          ID: {clientId.slice(0, 6)}
        </div>
        {metrics && (
          <div style={{ position: 'absolute', bottom: 12, left: 12 }} className={`${styles.faceChip} ${faceDetected ? styles.chipGreen : styles.chipRed}`}>
            <span className={styles.chipDot} />
            {faceDetected ? `Confidence: ${(metrics.face.confidence * 100).toFixed(0)}%` : "No Face"}
          </div>
        )}
        {!session.stream && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', fontSize: '14px' }}>
               Awaiting video stream...
            </div>
        )}
      </div>

      <div style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {metrics ? (
          <>
            <div className={styles.chipRow}>
              <span className={`${styles.tag} ${metrics.blink ? styles.tagRed : styles.tagGreen}`}>
                {metrics.blink ? "Blinking" : "Eyes Open"}
              </span>
              <span className={`${styles.tag} ${metrics.tabActive ? styles.tagGreen : styles.tagRed}`}>
                {metrics.tabActive ? "Tab Active" : "Tab Hidden"}
              </span>
              <span className={styles.tag}>
                Speed: {metrics.typing.currentSpeed}k/s
              </span>
            </div>
            {metrics.typing.intervalVariance < 50 && metrics.typing.keystrokes > 20 && (
              <div className={styles.botWarning} style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}>⚠️ Low variance typing (possible bot)</div>
            )}
          </>
        ) : (
          <div style={{ color: '#888', fontSize: '14px' }}>Awaiting telemetry...</div>
        )}
      </div>
    </div>
  );
}
