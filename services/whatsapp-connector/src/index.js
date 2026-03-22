const express = require("express");
const axios = require("axios");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const QRCode = require("qrcode");
const pino = require("pino");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const SESSIONS_DIR = process.env.SESSIONS_DIR || "./sessions";

const logger = pino({ level: "info" });

// Store active connections per tenant
const connections = new Map();
const qrCodes = new Map();

async function createConnection(tenantId, channelId) {
  const sessionDir = path.join(SESSIONS_DIR, tenantId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr);
      qrCodes.set(tenantId, qrDataUrl);
      logger.info({ tenantId }, "QR code generated");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        logger.info({ tenantId }, "Reconnecting...");
        setTimeout(() => createConnection(tenantId, channelId), 3000);
      } else {
        logger.info({ tenantId }, "Logged out, removing session");
        connections.delete(tenantId);
        qrCodes.delete(tenantId);
      }
    }

    if (connection === "open") {
      logger.info({ tenantId }, "WhatsApp connected");
      qrCodes.delete(tenantId);
      connections.set(tenantId, { sock, channelId });

      // Notify backend
      try {
        await axios.patch(
          `${BACKEND_URL}/api/v1/channels/${channelId}/status`,
          { status: "active" },
          { headers: { "X-Internal-Key": process.env.INTERNAL_KEY || "internal" } }
        );
      } catch (err) {
        logger.error({ err: err.message }, "Failed to update channel status");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
    if (type !== "notify") return;

    for (const msg of msgs) {
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        "";

      if (!text) continue;

      const sender = msg.key.remoteJid.replace("@s.whatsapp.net", "");
      const senderName = msg.pushName || sender;

      try {
        const response = await axios.post(
          `${BACKEND_URL}/api/v1/conversations/inbound`,
          {
            channel_type: "whatsapp",
            channel_id: channelId,
            tenant_id: tenantId,
            external_id: sender,
            customer_name: senderName,
            customer_phone: sender,
            message: text,
          }
        );

        const reply = response.data?.reply;
        if (reply) {
          await sock.sendMessage(msg.key.remoteJid, { text: reply });
        }
      } catch (err) {
        logger.error({ err: err.message, sender }, "Failed to process inbound message");
      }
    }
  });

  return sock;
}

// ─── API Endpoints ───

app.post("/connect", async (req, res) => {
  const { tenant_id, channel_id } = req.body;
  if (!tenant_id || !channel_id) {
    return res.status(400).json({ error: "tenant_id and channel_id required" });
  }

  try {
    await createConnection(tenant_id, channel_id);
    res.json({ status: "connecting", message: "Check /qr/:tenantId for QR code" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/qr/:tenantId", (req, res) => {
  const qr = qrCodes.get(req.params.tenantId);
  if (qr) {
    res.json({ qr });
  } else {
    const conn = connections.get(req.params.tenantId);
    if (conn) {
      res.json({ status: "connected" });
    } else {
      res.json({ status: "not_connected" });
    }
  }
});

app.post("/send/:tenantId", async (req, res) => {
  const { tenantId } = req.params;
  const { phone, message } = req.body;

  const conn = connections.get(tenantId);
  if (!conn) {
    return res.status(404).json({ error: "No active connection for tenant" });
  }

  try {
    const jid = `${phone}@s.whatsapp.net`;
    await conn.sock.sendMessage(jid, { text: message });
    res.json({ status: "sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/disconnect/:tenantId", async (req, res) => {
  const conn = connections.get(req.params.tenantId);
  if (conn) {
    await conn.sock.logout();
    connections.delete(req.params.tenantId);
    qrCodes.delete(req.params.tenantId);
  }
  res.json({ status: "disconnected" });
});

app.get("/status/:tenantId", (req, res) => {
  const conn = connections.get(req.params.tenantId);
  res.json({
    connected: !!conn,
    has_qr: qrCodes.has(req.params.tenantId),
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "ignify-whatsapp-connector", connections: connections.size });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Ignify WhatsApp Connector started");
});
