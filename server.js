const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

// ── Multi-user signaling state ─────────────────────────────────────────────
let adminSocket = null;
const clients = new Map(); // socketId -> socket instance

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  console.log(`\n📡 Signaling Server initializing...`);

  io.on("connection", (socket) => {
    console.log(`[server] 🟢 New connection: ${socket.id}`);

    // Role Identification
    socket.on("identify", (role) => {
      console.log(`[server] 👤 ${socket.id} identified as: ${role}`);
      
      if (role === "client") {
        clients.set(socket.id, socket);
        console.log(`[server] 📱 Client registered. Total clients: ${clients.size}`);

        // If admin is already here, notify them and invite the client to negotiating
        if (adminSocket) {
          console.log(`[server] 📢 Admin found. Asking client ${socket.id} to send offer...`);
          adminSocket.emit("client-joined", { clientId: socket.id });
          socket.emit("request-offer", { adminId: adminSocket.id });
        } else {
          console.log(`[server] ⏳ No admin online for client ${socket.id} yet.`);
        }
      }

      if (role === "admin") {
        adminSocket = socket;
        console.log(`[server] 💻 Admin registered: ${socket.id}`);
        
        // Notify all waiting clients to start negotiation
        if (clients.size > 0) {
          console.log(`[server] ⚡ Signaling ALL clients (${clients.size}) to send offers to new admin`);
          for (const [clientId, clientSocket] of clients) {
            clientSocket.emit("request-offer", { adminId: socket.id });
          }
        }
      }
    });

    // Universal Signal Relay
    socket.on("signal", (msg) => {
      // msg: { to, from, type, payload }
      const targetId = msg.to;
      const senderId = msg.from || socket.id;

      if (!targetId) return;

      console.log(`[server] 🛰️ Routing signal from ${senderId} to ${targetId} (${msg.type.toUpperCase()})`);

      const relayPacket = { ...msg, from: senderId };

      // Check if target is specifically "admin" or the admin's actual socket ID
      const isTargetAdmin = targetId === "admin" || (adminSocket && targetId === adminSocket.id);

      if (isTargetAdmin) {
        if (adminSocket) {
          adminSocket.emit("signal", relayPacket);
        } else {
          console.warn(`[server] ❌ Admin is offline, signal dropped.`);
        }
      } else {
        const targetSocket = clients.get(targetId);
        if (targetSocket) {
          targetSocket.emit("signal", relayPacket);
        } else {
          console.warn(`[server] ❌ Target ${targetId} not found in clients or admin, signal dropped.`);
        }
      }
    });


    // Request Offer Relay (Manual fallback)
    socket.on("request-offer", (msg) => {
      const targetId = msg.targetId;
      if (targetId && clients.has(targetId)) {
        console.log(`[server] ⚡ Relaying request-offer from Admin to ${targetId}`);
        clients.get(targetId).emit("request-offer", { adminId: socket.id });
      }
    });

    // Metrics Relay
    socket.on("metrics", (packet) => {
      if (adminSocket) {
        adminSocket.emit("metrics", { ...packet, clientId: socket.id });
      }
    });

    // Disconnection Handling
    socket.on("disconnect", (reason) => {
      console.log(`[server] 🔴 Disconnected: ${socket.id} (${reason})`);
      
      if (socket === adminSocket) {
        console.log(`[server] 💻 Admin has left.`);
        adminSocket = null;
      } else if (clients.has(socket.id)) {
        console.log(`[server] 📱 Client ${socket.id} has left.`);
        clients.delete(socket.id);
        if (adminSocket) {
          adminSocket.emit("client-left", { clientId: socket.id });
        }
      }
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`\n🚀 VeriStream PRODUCTION Signaling Server`);
    console.log(`   Running on http://${hostname}:${port}\n`);
  });
});
