"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import InsightChip from "@/components/InsightChip";
import Badge from "@/components/Badge";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toaster";
import Modal from "@/components/Modal";
import {
  AlertCircle,
  Loader2,
  Send,
  Sparkles,
  MessageSquare,
  Instagram,
  Phone,
  Globe,
  Facebook,
  Wand2,
  RefreshCw,
} from "lucide-react";
import { clsx } from "clsx";

type ChannelType = "whatsapp" | "instagram" | "messenger" | "web";
type Language = "ar" | "en";
type Intent =
  | "greeting"
  | "question"
  | "complaint"
  | "purchase_intent"
  | "booking"
  | "feedback"
  | "spam"
  | "other";

interface Conversation {
  id: string;
  channel_id: string;
  channel_type: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  last_message: string | null;
  last_message_at: string | null;
  updated_at: string;
}

interface InboxMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  created_at: string;
}

interface DraftResponse {
  draft_reply: string;
  intent: Intent | null;
  confidence: number | null;
  needs_human: boolean;
  meta: Record<string, unknown>;
}

function channelIcon(type: string | null | undefined) {
  switch ((type || "").toLowerCase()) {
    case "whatsapp":
      return Phone;
    case "instagram":
      return Instagram;
    case "messenger":
      return Facebook;
    case "web":
      return Globe;
    default:
      return MessageSquare;
  }
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function InboxPage() {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const isAr = locale === "ar";
  const toast = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [draftText, setDraftText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastIntent, setLastIntent] = useState<Intent | null>(null);
  const [needsHuman, setNeedsHuman] = useState(false);

  // AI reply drawer state
  const [aiReplyOpen, setAiReplyOpen] = useState(false);
  const [aiReplyText, setAiReplyText] = useState("");
  const [aiReplyLoading, setAiReplyLoading] = useState(false);
  const [aiReplyConversationId, setAiReplyConversationId] = useState<string | null>(null);
  const [aiReplySending, setAiReplySending] = useState(false);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const loadConversations = useCallback(async () => {
    try {
      setLoadingList(true);
      const data = await api.get<Conversation[]>("/api/v1/inbox/conversations");
      setConversations(data);
      if (!activeId && data.length > 0) {
        setActiveId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failed"));
    } finally {
      setLoadingList(false);
    }
  }, [activeId, t]);

  const loadMessages = useCallback(async (id: string) => {
    try {
      setLoadingMessages(true);
      const data = await api.get<InboxMessage[]>(
        `/api/v1/inbox/conversations/${id}/messages`
      );
      setMessages(data);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeId) {
      setDraftText("");
      setLastIntent(null);
      setNeedsHuman(false);
      loadMessages(activeId);
    } else {
      setMessages([]);
    }
  }, [activeId, loadMessages]);

  async function handleGenerate() {
    if (!active) return;
    const lastCustomer = [...messages].reverse().find((m) => m.role === "user");
    const seed = lastCustomer?.content || active.last_message || "";
    if (!seed) {
      setError(t("errors.failed"));
      return;
    }
    const channelType = (active.channel_type || "whatsapp") as ChannelType;
    const language: Language = isRtl ? "ar" : "en";
    try {
      setGenerating(true);
      setError(null);
      const res = await api.post<DraftResponse>("/api/v1/inbox/draft", {
        conversation_id: active.id,
        customer_message: seed,
        language,
        channel_type: ["whatsapp", "instagram", "messenger", "web"].includes(channelType)
          ? channelType
          : "web",
      });
      setDraftText(res.draft_reply || "");
      setLastIntent(res.intent);
      setNeedsHuman(Boolean(res.needs_human));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failed"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!active || !draftText.trim()) return;
    try {
      setSending(true);
      setError(null);
      await api.post<InboxMessage>("/api/v1/inbox/send", {
        conversation_id: active.id,
        message: draftText.trim(),
      });
      setDraftText("");
      await loadMessages(active.id);
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.failed"));
    } finally {
      setSending(false);
    }
  }

  async function fetchAiReply(conversationId: string): Promise<string | null> {
    try {
      const res = await api.post<{ draft: string }>(
        `/api/v1/inbox/conversations/${conversationId}/ai-reply`,
        {}
      );
      return res?.draft || "";
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toast.info(isAr ? "قادم قريباً" : "Coming soon");
        return null;
      }
      toast.error(
        err instanceof Error ? err.message : isAr ? "فشل التوليد" : "Failed to generate"
      );
      return null;
    }
  }

  async function handleOpenAiReply(conversationId: string) {
    setAiReplyConversationId(conversationId);
    setAiReplyText("");
    setAiReplyOpen(true);
    setAiReplyLoading(true);
    const draft = await fetchAiReply(conversationId);
    setAiReplyLoading(false);
    if (draft === null) {
      setAiReplyOpen(false);
      setAiReplyConversationId(null);
      return;
    }
    setAiReplyText(draft);
  }

  async function handleRegenerateAiReply() {
    if (!aiReplyConversationId) return;
    setAiReplyLoading(true);
    const draft = await fetchAiReply(aiReplyConversationId);
    setAiReplyLoading(false);
    if (draft !== null) setAiReplyText(draft);
  }

  async function handleSendAiReply() {
    if (!aiReplyConversationId || !aiReplyText.trim()) return;
    setAiReplySending(true);
    try {
      try {
        await api.post(
          `/api/v1/inbox/conversations/${aiReplyConversationId}/messages`,
          { message: aiReplyText.trim() }
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // Fall back to existing send endpoint
          await api.post("/api/v1/inbox/send", {
            conversation_id: aiReplyConversationId,
            message: aiReplyText.trim(),
          });
        } else {
          throw err;
        }
      }
      toast.success(isAr ? "تم الإرسال" : "Sent");
      setAiReplyOpen(false);
      if (active && active.id === aiReplyConversationId) {
        await loadMessages(active.id);
      }
      await loadConversations();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : isAr ? "فشل الإرسال" : "Failed to send"
      );
    } finally {
      setAiReplySending(false);
    }
  }

  function intentLabel(intent: Intent | null) {
    if (!intent) return null;
    const map: Record<Intent, string> = {
      greeting: t("intents.greeting"),
      question: t("intents.question"),
      complaint: t("intents.complaint"),
      purchase_intent: t("intents.purchase"),
      booking: t("intents.booking"),
      feedback: t("intents.feedback"),
      spam: t("intents.spam"),
      other: t("intents.other"),
    };
    return map[intent] || intent;
  }

  return (
    <div>
      <DashboardHeader title={t("title")} />
      <div className="p-8">
        <div className="space-y-6">
          <PageHeader
            eyebrow="INBOX"
            title={t("title")}
            description={t("subtitle")}
          />

          {error && (
            <Card padding="sm" className="flex items-center gap-3 !bg-error-container">
              <AlertCircle className="h-4 w-4 shrink-0 text-on-error-container" />
              <span className="text-sm font-medium text-on-error-container">{error}</span>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-[340px_1fr]">
            {/* Left: conversations list */}
            <aside className="rounded-2xl bg-surface-container-low p-3">
              <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto">
                {loadingList ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-6 text-center text-sm text-on-surface-variant">
                    {t("listEmpty")}
                  </div>
                ) : (
                  conversations.map((c) => {
                    const Icon = channelIcon(c.channel_type);
                    const isActive = c.id === activeId;
                    return (
                      <div
                        key={c.id}
                        className={clsx(
                          "group relative flex w-full items-start gap-3 rounded-2xl p-3 text-start transition-all",
                          isActive
                            ? "bg-surface-container-lowest shadow-soft"
                            : "hover:bg-surface-container-lowest/70"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveId(c.id)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-start"
                        >
                          <div
                            className={clsx(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                              isActive
                                ? "brand-gradient-bg text-white shadow-soft"
                                : "bg-surface-container-low text-on-surface-variant"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-headline truncate text-sm font-bold text-on-surface">
                                {c.customer_name || c.customer_phone || (c.channel_type || "—")}
                              </p>
                              <span className="shrink-0 text-[10px] font-medium text-on-surface-variant">
                                {formatTime(c.last_message_at || c.updated_at)}
                              </span>
                            </div>
                            <p className="truncate text-xs text-on-surface-variant">
                              {c.last_message || ""}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAiReply(c.id);
                          }}
                          title={isAr ? "الرد بالذكاء الاصطناعي" : "Reply with AI"}
                          aria-label={isAr ? "الرد بالذكاء الاصطناعي" : "Reply with AI"}
                          className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity hover:bg-primary/20 group-hover:opacity-100 focus:opacity-100"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right: active conversation */}
            <section className="flex min-h-[calc(100vh-220px)] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-soft">
              {!active ? (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-on-surface-variant">
                  {t("selectConversation")}
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3 bg-surface-container-low px-5 py-4">
                    <div className="min-w-0 space-y-1">
                      <p className="font-headline truncate text-base font-bold tracking-tight text-on-surface">
                        {active.customer_name || active.customer_phone || (active.channel_type || "—")}
                      </p>
                      <p className="truncate text-xs font-medium text-on-surface-variant">
                        {active.channel_type}
                      </p>
                    </div>
                    {(needsHuman || lastIntent === "complaint") && (
                      <Badge tone="warning">
                        <AlertCircle className="h-3 w-3" />
                        {t("escalation.needsHuman")}
                      </Badge>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto bg-surface-container-lowest p-5">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : (
                      <ul className="space-y-4">
                        {messages.map((m) => {
                          const isMine = m.role === "assistant";
                          return (
                            <li
                              key={m.id}
                              className={clsx("flex", isMine ? "justify-end" : "justify-start")}
                            >
                              <div
                                className={clsx(
                                  "relative max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-soft",
                                  isMine
                                    ? "bg-surface-container-lowest ps-5 text-on-surface"
                                    : "bg-surface-container-low text-on-surface"
                                )}
                              >
                                {isMine && (
                                  <span className="brand-gradient-bg absolute inset-y-2 start-1.5 w-1 rounded-full" />
                                )}
                                <p className="font-headline mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                  {isMine ? t("messages.you") : t("messages.customer")}
                                </p>
                                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                <p className="mt-1.5 text-[10px] text-on-surface-variant/70">
                                  {formatTime(m.created_at)}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Composer */}
                  <div className="bg-surface-container-low p-4">
                    {lastIntent && (
                      <div className="mb-3 flex items-center gap-2">
                        <InsightChip>{intentLabel(lastIntent)}</InsightChip>
                      </div>
                    )}
                    <textarea
                      rows={3}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder={t("messages.typeMessage")}
                      className="w-full resize-y rounded-xl bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => active && handleOpenAiReply(active.id)}
                        disabled={generating || sending}
                        leadingIcon={<Wand2 className="h-4 w-4" />}
                      >
                        {isAr ? "الرد بالذكاء الاصطناعي" : "Reply with AI"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleGenerate}
                        disabled={generating || sending}
                        leadingIcon={
                          generating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )
                        }
                      >
                        {generating ? t("actions.generating") : t("actions.generateReply")}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSend}
                        disabled={sending || generating || !draftText.trim()}
                        leadingIcon={
                          sending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )
                        }
                      >
                        {sending ? t("actions.sending") : t("actions.send")}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      <Modal
        open={aiReplyOpen}
        onOpenChange={(o) => {
          setAiReplyOpen(o);
          if (!o) {
            setAiReplyConversationId(null);
            setAiReplyText("");
          }
        }}
        title={isAr ? "الرد بالذكاء الاصطناعي" : "Reply with AI"}
        description={
          isAr
            ? "مراجعة المسودة قبل الإرسال. يمكنك تعديلها أو طلب إعادة التوليد."
            : "Review the draft before sending. You can edit it or regenerate."
        }
      >
        <div className="space-y-3">
          {aiReplyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <textarea
              rows={6}
              value={aiReplyText}
              onChange={(e) => setAiReplyText(e.target.value)}
              placeholder={isAr ? "مسودة الرد..." : "Draft reply..."}
              className="w-full resize-y rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/30"
            />
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRegenerateAiReply}
              disabled={aiReplyLoading || aiReplySending}
              leadingIcon={
                aiReplyLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )
              }
            >
              {isAr ? "إعادة التوليد" : "Regenerate"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendAiReply}
              disabled={aiReplyLoading || aiReplySending || !aiReplyText.trim()}
              leadingIcon={
                aiReplySending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )
              }
            >
              {aiReplySending
                ? isAr ? "جاري الإرسال..." : "Sending..."
                : isAr ? "إرسال" : "Send"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
