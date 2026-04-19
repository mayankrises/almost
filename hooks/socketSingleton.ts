import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(url?: string): Socket {
  if (!socket) {
    console.log("[Socket] 🏗️ Creating global singleton socket...");
    socket = io(url || undefined, {
      transports: ["websocket"],
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
    });
    
    socket.on("connect", () => {
      console.log(`[Socket] 🟢 Connected: ${socket?.id}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] 🔴 Disconnected: ${reason}`);
    });
  }
  return socket;
}
