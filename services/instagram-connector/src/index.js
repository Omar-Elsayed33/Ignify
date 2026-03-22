const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const pino = require("pino");

const app = express();
const logger = pino({ level: "info" });

const PORT = process.env.PORT || 3006;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN || "ignify_ig_verify";
const APP_SECRET = process.env.META_APP_SECRET || "";

// Store Instagram account tokens per tenant
const accountTokens = new Map();

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));

// Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    logger.info("Instagram webhook verified");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Webhook events (Instagram messaging)
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object !== "instagram") {
    return res.sendStatus(404);
  }

  res.sendStatus(200);

  for (const entry of body.entry) {
    const igAccountId = entry.id;

    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue;

      const senderId = event.sender.id;
      const text = event.message.text;
      if (!text) continue;

      try {
        const response = await axios.post(
          `${BACKEND_URL}/api/v1/conversations/inbound`,
          {
            channel_type: "instagram",
            external_id: senderId,
            platform_id: igAccountId,
            customer_name: senderId,
            message: text,
          }
        );

        const reply = response.data?.reply;
        if (reply) {
          await sendMessage(igAccountId, senderId, reply);
        }
      } catch (err) {
        logger.error({ err: err.message, senderId }, "Failed to process Instagram DM");
      }
    }
  }
});

async function sendMessage(igAccountId, recipientId, text) {
  const tokenInfo = accountTokens.get(igAccountId);
  if (!tokenInfo) {
    logger.error({ igAccountId }, "No token found for Instagram account");
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

// Register Instagram account
app.post("/register", (req, res) => {
  const { ig_account_id, access_token, tenant_id, channel_id } = req.body;
  if (!ig_account_id || !access_token) {
    return res.status(400).json({ error: "ig_account_id and access_token required" });
  }
  accountTokens.set(ig_account_id, { token: access_token, tenantId: tenant_id, channelId: channel_id });
  res.json({ status: "registered" });
});

app.post("/send/:tenantId", async (req, res) => {
  const { recipient_id, message, ig_account_id } = req.body;
  try {
    await sendMessage(ig_account_id, recipient_id, message);
    res.json({ status: "sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ignify-instagram-connector", accounts: accountTokens.size });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Ignify Instagram Connector started");
});
