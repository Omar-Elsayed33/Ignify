"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { api } from "@/lib/api";
import { Search, Send, MessageSquare, Instagram, Facebook, Mail, Loader2 } from "lucide-react";
import * as Avatar from "@radix-ui/react-avatar";
import { clsx } from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────

interface SessionResponse {
  id: string;
  tenant_id: string;
  channel_id: string;
  external_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface MessageResponse {
  id: string;
  session_id: string;
  tenant_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Static maps ────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  whatsapp: MessageSquare,
  instagram: Instagram,
  messenger: Facebook,
  email: Mail,
};

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "bg-green-500",
  instagram: "bg-pink-500",
  messenger: "bg-blue-600",
  email: "bg-red-500",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const t = useTranslations("conversationsPage");

  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch sessions ────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const data = await api.get<SessionResponse[]>(
        "/api/v1/conversations/sessions"
      );
      setSessions(data);
    } catch (err) {
      setSessionsError(
        err instanceof Error ? err.message : "Failed to load sessions"
      );
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ── Fetch messages when session selected ─────────────────────────────────

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMessagesLoading(true);
    api
      .get<MessageResponse[]>(
        `/api/v1/conversations/sessions/${selectedId}/messages`
      )
      .then((data) => {
        if (!cancelled) setMessages(data);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message via inbound endpoint ─────────────────────────────────────

  const handleSend = async () => {
    const text = messageInput.trim();
    if (!text || !selectedId) return;

    const session = sessions.find((s) => s.id === selectedId);
    if (!session) return;

    setSending(true);
    setMessageInput("");

    // Optimistic user bubble
    const optimisticMsg: MessageResponse = {
      id: `optimistic-${Date.now()}`,
      session_id: selectedId,
      tenant_id: session.tenant_id,
      role: "user",
      content: text,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await api.post("/api/v1/conversations/inbound", {
        channel_id: session.channel_id,
        external_id: session.external_id ?? selectedId,
        customer_name: session.customer_name,
        customer_phone: session.customer_phone,
        content: text,
      });

      // Refresh messages to get real IDs + assistant reply
      const updated = await api.get<MessageResponse[]>(
        `/api/v1/conversations/sessions/${selectedId}/messages`
      );
      setMessages(updated);
    } catch {
      // On error keep optimistic message visible; user can retry
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      (s.customer_name ?? "").toLowerCase().includes(q) ||
      (s.customer_phone ?? "").toLowerCase().includes(q)
    );
  });

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="flex h-[calc(100vh-8rem)] border-t border-border">
        {/* ── Session list ── */}
        <div className="w-80 shrink-0 border-e border-border bg-surface">
          {/* Search */}
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchConversations")}
                className="w-full rounded-lg border border-border bg-background py-2 ps-9 pe-3 text-sm placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-y-auto h-[calc(100%-57px)]">
            {sessionsLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {!sessionsLoading && sessionsError && (
              <p className="p-4 text-center text-xs text-error">
                {sessionsError}
              </p>
            )}

            {!sessionsLoading && !sessionsError && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-8 w-8 text-text-muted/30" />
                <p className="mt-3 text-sm text-text-muted">
                  {t("noConversations")}
                </p>
              </div>
            )}

            {filtered.map((session) => {
              const displayName =
                session.customer_name ??
                session.customer_phone ??
                session.external_id ??
                t("unknownContact");
              const initials = getInitials(displayName);

              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedId(session.id)}
                  className={clsx(
                    "flex w-full items-center gap-3 border-b border-border-light px-4 py-3 text-start transition-colors",
                    selectedId === session.id
                      ? "bg-primary/5"
                      : "hover:bg-surface-hover"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar.Root className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                      <Avatar.Fallback className="text-sm font-semibold text-white">
                        {initials}
                      </Avatar.Fallback>
                    </Avatar.Root>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {displayName}
                      </p>
                      <span className="shrink-0 text-xs text-text-muted">
                        {formatTime(session.updated_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text-secondary">
                      {session.customer_phone ?? session.external_id ?? "—"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Message thread ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedSession ? (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 border-b border-border bg-surface px-6 py-3 shrink-0">
                <Avatar.Root className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                  <Avatar.Fallback className="text-sm font-semibold text-white">
                    {getInitials(
                      selectedSession.customer_name ??
                        selectedSession.customer_phone ??
                        null
                    )}
                  </Avatar.Fallback>
                </Avatar.Root>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {selectedSession.customer_name ??
                      selectedSession.customer_phone ??
                      selectedSession.external_id ??
                      t("unknownContact")}
                  </p>
                  {selectedSession.customer_phone && (
                    <p className="text-xs text-text-muted">
                      {selectedSession.customer_phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto bg-background p-6">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-8 w-8 text-text-muted/30" />
                    <p className="mt-3 text-sm text-text-muted">
                      {t("noMessages")}
                    </p>
                  </div>
                ) : (
                  <div className="mx-auto max-w-2xl space-y-4">
                    {messages
                      .filter((m) => m.role !== "system" && m.role !== "tool")
                      .map((msg) => {
                        const isUser = msg.role === "user";
                        return (
                          <div
                            key={msg.id}
                            className={clsx(
                              "flex",
                              isUser ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={clsx(
                                "max-w-[70%] rounded-2xl px-4 py-2.5",
                                isUser
                                  ? "rounded-ee-sm bg-primary text-white"
                                  : "rounded-es-sm bg-surface text-text-primary shadow-sm"
                              )}
                            >
                              <p className="text-sm">{msg.content}</p>
                              <p
                                className={clsx(
                                  "mt-1 text-xs",
                                  isUser
                                    ? "text-white/70"
                                    : "text-text-muted"
                                )}
                              >
                                {formatMessageTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-border bg-surface p-4">
                <div className="mx-auto flex max-w-2xl gap-3">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("typeMessage")}
                    disabled={sending}
                    className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm placeholder:text-text-muted focus:border-primary focus:outline-none disabled:opacity-60"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!messageInput.trim() || sending}
                    className="flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-white hover:bg-primary-dark disabled:opacity-40"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center bg-background">
              <MessageSquare className="h-12 w-12 text-text-muted/30" />
              <p className="mt-4 text-lg font-medium text-text-secondary">
                {t("noConversation")}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {t("noConversationDesc")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
