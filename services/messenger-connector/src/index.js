const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const pino = require("pino");

const app = express();
const logger = pino({ level: "info" });

const PORT = process.env.PORT || 3003;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || "ignify_verify_token";

// Store page tokens per tenant
const pageTokens = new Map();

// Raw body for signature verification
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));

function verifySignature(req, appSecret) {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !appSecret) return true; // Skip in dev
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Webhook verification (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    logger.info("Webhook verified");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Webhook events (POST)
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object !== "page") {
    return res.sendStatus(404);
  }

  res.sendStatus(200); // Respond immediately

  for (const entry of body.entry) {
    const pageId = entry.id;

    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue;

      const senderId = event.sender.id;
      const text = event.message.text;
      if (!text) continue;

      try {
        // Find tenant by page ID
        const response = await axios.post(
          `${BACKEND_URL}/api/v1/conversations/inbound`,
          {
            channel_type: "messenger",
            external_id: senderId,
            platform_id: pageId,
            customer_name: senderId,
            message: text,
          }
        );

        const reply = response.data?.reply;
        if (reply) {
          await sendMessage(pageId, senderId, reply);
        }
      } catch (err) {
        logger.error({ err: err.message, senderId }, "Failed to process message");
      }
    }
  }
});

async function sendMessage(pageId, recipientId, text) {
  const tokenInfo = pageTokens.get(pageId);
  if (!tokenInfo) {
    logger.error({ pageId }, "No page token found");
    return;
  }

  await axios.post(
    `https://graph.facebook.com/v19.0/me/messages`,
    {
      recipient: { id: recipientId },
      message: { text },
    },
    {
      params: { access_token: tokenInfo.token },
    }
  );
}

// API to register page tokens
app.post("/register", (req, res) => {
  const { page_id, page_token, tenant_id, channel_id } = req.body;
  if (!page_id || !page_token) {
    return res.status(400).json({ error: "page_id and page_token required" });
  }
  pageTokens.set(page_id, { token: page_token, tenantId: tenant_id, channelId: channel_id });
  res.json({ status: "registered" });
});

app.post("/send/:tenantId", async (req, res) => {
  const { recipient_id, message, page_id } = req.body;
  try {
    await sendMessage(page_id, recipient_id, message);
    res.json({ status: "sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ignify-messenger-connector", pages: pageTokens.size });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Ignify Messenger Connector started");
});
