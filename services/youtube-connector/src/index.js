const express = require("express");
const { google } = require("googleapis");
const axios = require("axios");
const pino = require("pino");

const app = express();
const logger = pino({ level: "info" });

const PORT = process.env.PORT || 3008;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Store YouTube OAuth tokens per tenant
const ytAccounts = new Map();
const pollingIntervals = new Map();

app.use(express.json());

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.PUBLIC_URL || "http://localhost:3008"}/auth/callback`
  );
}

// OAuth2 flow
app.get("/auth/start", (req, res) => {
  const { tenant_id, channel_id } = req.query;
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ],
    state: `${tenant_id}:${channel_id}`,
  });
  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  const [tenantId, channelId] = (state || "").split(":");

  if (!code || !tenantId) {
    return res.status(400).json({ error: "Missing code or state" });
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get channel info
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const channelResp = await youtube.channels.list({ part: "snippet", mine: true });
    const ytChannel = channelResp.data.items?.[0];

    ytAccounts.set(tenantId, {
      tokens,
      channelId,
      ytChannelId: ytChannel?.id,
      ytChannelName: ytChannel?.snippet?.title,
      lastChecked: new Date().toISOString(),
    });

    // Start polling for new comments
    startPolling(tenantId);

    res.json({ status: "connected", channel: ytChannel?.snippet?.title });
  } catch (err) {
    logger.error({ err: err.message }, "YouTube OAuth failed");
    res.status(500).json({ error: "OAuth failed" });
  }
});

async function pollComments(tenantId) {
  const account = ytAccounts.get(tenantId);
  if (!account) return;

  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(account.tokens);
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // Get recent comments on channel videos
    const commentResp = await youtube.commentThreads.list({
      part: "snippet",
      allThreadsRelatedToChannelId: account.ytChannelId,
      maxResults: 20,
      order: "time",
    });

    for (const thread of commentResp.data.items || []) {
      const comment = thread.snippet.topLevelComment.snippet;
      const publishedAt = new Date(comment.publishedAt);
      const lastChecked = new Date(account.lastChecked);

      if (publishedAt <= lastChecked) continue;

      const authorId = comment.authorChannelId?.value || comment.authorDisplayName;

      try {
        const response = await axios.post(
          `${BACKEND_URL}/api/v1/conversations/inbound`,
          {
            channel_type: "youtube",
            channel_id: account.channelId,
            tenant_id: tenantId,
            external_id: authorId,
            customer_name: comment.authorDisplayName,
            message: comment.textDisplay,
            metadata: {
              video_id: comment.videoId,
              comment_id: thread.id,
            },
          }
        );

        const reply = response.data?.reply;
        if (reply) {
          await youtube.comments.insert({
            part: "snippet",
            requestBody: {
              snippet: {
                parentId: thread.id,
                textOriginal: reply,
              },
            },
          });
        }
      } catch (err) {
        logger.error({ err: err.message }, "Failed to process YouTube comment");
      }
    }

    account.lastChecked = new Date().toISOString();
  } catch (err) {
    logger.error({ err: err.message, tenantId }, "YouTube polling error");
  }
}

function startPolling(tenantId) {
  if (pollingIntervals.has(tenantId)) {
    clearInterval(pollingIntervals.get(tenantId));
  }
  const interval = setInterval(() => pollComments(tenantId), 60000); // Every 60s
  pollingIntervals.set(tenantId, interval);
  logger.info({ tenantId }, "YouTube polling started");
}

app.post("/send/:tenantId", async (req, res) => {
  const account = ytAccounts.get(req.params.tenantId);
  if (!account) return res.status(404).json({ error: "Not connected" });

  const { comment_thread_id, message } = req.body;

  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(account.tokens);
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    await youtube.comments.insert({
      part: "snippet",
      requestBody: {
        snippet: {
          parentId: comment_thread_id,
          textOriginal: message,
        },
      },
    });
    res.json({ status: "sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/disconnect/:tenantId", (req, res) => {
  const tenantId = req.params.tenantId;
  if (pollingIntervals.has(tenantId)) {
    clearInterval(pollingIntervals.get(tenantId));
    pollingIntervals.delete(tenantId);
  }
  ytAccounts.delete(tenantId);
  res.json({ status: "disconnected" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ignify-youtube-connector", accounts: ytAccounts.size });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Ignify YouTube Connector started");
});
