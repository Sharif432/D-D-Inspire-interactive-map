import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { createCampaignApp, readCampaignState } from "./api/_app.js";
import type { CampaignState } from "./src/types.js";

function getPort(): number {
  const portIndex = process.argv.indexOf("--port");
  if (portIndex !== -1 && process.argv[portIndex + 1]) {
    const p = parseInt(process.argv[portIndex + 1], 10);
    if (!isNaN(p)) return p;
  }
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p)) return p;
  }
  if (process.env.DEFAULT_APP_PORT) {
    const p = parseInt(process.env.DEFAULT_APP_PORT, 10);
    if (!isNaN(p)) return p;
  }
  return 3000;
}

function getHost(): string {
  const hostIndex = process.argv.indexOf("--host");
  if (hostIndex !== -1 && process.argv[hostIndex + 1]) {
    return process.argv[hostIndex + 1];
  }
  return "0.0.0.0";
}

const PORT = getPort();
const HOST = getHost();

let campaignWss: WebSocketServer | null = null;

function broadcastCampaignState(
  state: CampaignState,
  eventType: "campaign:init" | "campaign:updated" = "campaign:updated"
) {
  if (!campaignWss) return;
  const payload = JSON.stringify({
    type: eventType,
    version: state.stateVersion || 1,
    campaign: state
  });
  campaignWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.warn("WebSocket broadcast send error:", err);
      }
    }
  });
}

const app = createCampaignApp({
  websocketEnabled: true,
  onBroadcast: broadcastCampaignState
});

// Hot Module Replacement (HMR) and dev/prod server setup
async function startServer() {
  let viteServer: Awaited<ReturnType<typeof createViteServer>> | null = null;
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    viteServer = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : { server },
        watch:
          process.env.DISABLE_HMR === "true"
            ? null
            : {
                ignored: [
                  "**/campaign-data.json",
                  "**/campaign-data.json.*",
                  "**/*.json.tmp"
                ]
              }
      },
      appType: "spa"
    });
    app.use(viteServer.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const wss = new WebSocketServer({ noServer: true });
  campaignWss = wss;

  wss.on("connection", async (ws) => {
    try {
      const current = await readCampaignState();
      ws.send(
        JSON.stringify({
          type: "campaign:init",
          version: current.stateVersion || 1,
          campaign: current
        })
      );
    } catch (err) {
      console.warn("WebSocket init send error:", err);
    }

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === "request:sync") {
          const current = await readCampaignState();
          ws.send(
            JSON.stringify({
              type: "campaign:init",
              version: current.stateVersion || 1,
              campaign: current
            })
          );
        }
      } catch {
        // Ignore malformed client frames
      }
    });
  });

  server.on("upgrade", (req, socket, head) => {
    const pathname = (req.url || "").split("?")[0];
    if (pathname === "/ws/campaign") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`\n  VITE v6.2.3  ready in 180 ms\n`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://${HOST}:${PORT}/\n`);
    console.log(`D&D Companion Server + Live WebSocket running at http://${HOST}:${PORT}`);
  });

  const cleanup = async () => {
    const forceTimer = setTimeout(() => process.exit(0), 1500);
    forceTimer.unref();
    wss.clients.forEach((client) => {
      try {
        client.close();
      } catch {
        // Ignore
      }
    });
    if (viteServer) {
      try {
        await viteServer.close();
      } catch {
        // Ignore
      }
    }
    if (typeof (server as any).closeAllConnections === "function") {
      (server as any).closeAllConnections();
    }
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
