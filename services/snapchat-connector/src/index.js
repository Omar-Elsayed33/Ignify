const express = require("express");
const axios = require("axios");
const pino = require("pino");

const app = express();
const logger = pino({ level: "info" });

const PORT = process.env.PORT || 3007;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Snapchat Kit integration placeholder
// Snap Kit requires OAuth2 and specific business account setup
const snapAccounts = new Map();

app.use(express.json());

// OAuth callback from Snapchat
app.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  // state contains tenant_id:channel_id
  const [tenantId, channelId] = (state || "").split(":");

  if (!code || !tenantId) {
    return res.status(400).json({ error: "Missing code or state" });
  }

  try {
    // Exchange code for access token
    const tokenResp = await axios.post("https://accounts.snapchat.com/accounts/oauth2/token", {
      grant_type: "authorization_code",
      code,
      client_id: process.env.SNAPCHAT_APP_ID,
      client_secret: process.env.SNAPCHAT_APP_SECRET,
      redirect_uri: `${process.env.PUBLIC_URL || "http://localhost:3007"}/auth/callback`,
    });

    snapAccounts.set(tenantId, {
      accessToken: tokenResp.data.access_token,
      refreshToken: tokenResp.data.refresh_token,
      channelId,
    });

    res.json({ status: "connected" });
  } catch (err) {
    logger.error({ err: err.message }, "Snapchat OAuth failed");
    res.status(500).json({ error: "OAuth failed" });
  }
});

// Webhook for incoming messages (Snap Kit Bitmoji/Chat Kit)
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const { sender_id, message, account_id } = req.body;
  if (!message || !sender_id) return;

  // Find tenant by account
  let tenantId = null;
  let channelId = null;
  for (const [tid, acc] of snapAccounts) {
    if (acc.accountId === account_id) {
      tenantId = tid;
      channelId = acc.channelId;
      break;
    }
  }

  if (!tenantId) return;

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/v1/conversations/inbound`,
      {
        channel_type: "snapchat",
        channel_id: channelId,
        tenant_id: tenantId,
        external_id: sender_id,
        customer_name: sender_id,
        message,
      }
    );

    const reply = response.data?.reply;
    if (reply) {
      // Send reply via Snapchat API
      const acc = snapAccounts.get(tenantId);
      await axios.post(
        "https://kit.snapchat.com/v1/send",
        { recipient_id: sender_id, message: { text: reply } },
        { headers: { Authorization: `Bearer ${acc.accessToken}` } }
      );
    }
  } catch (err) {
    logger.error({ err: err.message }, "Failed to process Snapchat message");
  }
});

app.post("/register", (req, res) => {
  const { tenant_id, channel_id, account_id } = req.body;
  if (snapAccounts.has(tenant_id)) {
    snapAccounts.get(tenant_id).accountId = account_id;
  }
  res.json({ status: "registered" });
});

app.post("/send/:tenantId", async (req, res) => {
  const acc = snapAccounts.get(req.params.tenantId);
  if (!acc) return res.status(404).json({ error: "Not connected" });

  const { recipient_id, message } = req.body;
  try {
    await axios.post(
      "https://kit.snapchat.com/v1/send",
      { recipient_id, message: { text: message } },
      { headers: { Authorization: `Bearer ${acc.accessToken}` } }
    );
    res.json({ status: "sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ignify-snapchat-connector", accounts: snapAccounts.size });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Ignify Snapchat Connector started");
});
