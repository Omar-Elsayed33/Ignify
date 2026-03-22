const { App } = require("@slack/bolt");
const express = require("express");
const axios = require("axios");
const pino = require("pino");

const logger = pino({ level: "info" });
const PORT = process.env.PORT || 3005;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Store Slack app instances per tenant
const slackApps = new Map();

// Express app for management API
const api = express();
api.use(express.json());

async function createSlackApp(tenantId, channelId, botToken, appToken, signingSecret) {
  const slackApp = new App({
    token: botToken,
    appToken: appToken,
    signingSecret: signingSecret,
    socketMode: true,
  });

  // Handle direct messages
  slackApp.message(async ({ message, say }) => {
    if (message.subtype) return;
    if (message.bot_id) return;

    const text = message.text;
    const userId = message.user;

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/conversations/inbound`,
        {
          channel_type: "slack",
          channel_id: channelId,
          tenant_id: tenantId,
          external_id: userId,
          customer_name: userId,
          message: text,
        }
      );

      const reply = response.data?.reply;
      if (reply) {
        await say(reply);
      }
    } catch (err) {
      logger.error({ err: err.message, userId }, "Failed to process Slack message");
      await say("Sorry, I encountered an error processing your message.");
    }
  });

  // Handle app mentions
  slackApp.event("app_mention", async ({ event, say }) => {
    const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
    const userId = event.user;

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/conversations/inbound`,
        {
          channel_type: "slack",
          channel_id: channelId,
          tenant_id: tenantId,
          external_id: userId,
          customer_name: userId,
          message: text,
        }
      );

      const reply = response.data?.reply;
      if (reply) {
        await say({ text: reply, thread_ts: event.ts });
      }
    } catch (err) {
      logger.error({ err: err.message }, "Failed to process mention");
    }
  });

  await slackApp.start();
  slackApps.set(tenantId, { app: slackApp, channelId });
  logger.info({ tenantId }, "Slack app started");
}

api.post("/register", async (req, res) => {
  const { tenant_id, channel_id, bot_token, app_token, signing_secret } = req.body;
  if (!tenant_id || !bot_token || !app_token) {
    return res.status(400).json({ error: "tenant_id, bot_token, and app_token required" });
  }

  try {
    await createSlackApp(tenant_id, channel_id, bot_token, app_token, signing_secret);
    res.json({ status: "connected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

api.post("/send/:tenantId", async (req, res) => {
  const { tenantId } = req.params;
  const { channel: slackChannel, message } = req.body;

  const conn = slackApps.get(tenantId);
  if (!conn) {
    return res.status(404).json({ error: "No Slack app for tenant" });
  }

  try {
    await conn.app.client.chat.postMessage({
      channel: slackChannel,
      text: message,
    });
    res.json({ status: "sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

api.delete("/disconnect/:tenantId", async (req, res) => {
  const conn = slackApps.get(req.params.tenantId);
  if (conn) {
    await conn.app.stop();
    slackApps.delete(req.params.tenantId);
  }
  res.json({ status: "disconnected" });
});

api.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ignify-slack-connector", apps: slackApps.size });
});

api.listen(PORT, () => {
  logger.info({ port: PORT }, "Ignify Slack Connector started");
});
