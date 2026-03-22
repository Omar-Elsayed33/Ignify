"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { Search, Send, MessageSquare, Instagram, Facebook, Mail } from "lucide-react";
import * as Avatar from "@radix-ui/react-avatar";
import { clsx } from "clsx";

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  channel: string;
  unread: number;
  avatar: string;
}

interface Message {
  id: string;
  sender: "user" | "contact";
  text: string;
  time: string;
}

const channelIcons: Record<string, React.ElementType> = {
  whatsapp: MessageSquare,
  instagram: Instagram,
  messenger: Facebook,
  email: Mail,
};

const channelColors: Record<string, string> = {
  whatsapp: "bg-green-500",
  instagram: "bg-pink-500",
  messenger: "bg-blue-600",
  email: "bg-red-500",
};

const mockConversations: Conversation[] = [
  { id: "1", name: "Sarah Johnson", lastMessage: "I'd like to know more about your pricing plans", time: "2m ago", channel: "whatsapp", unread: 2, avatar: "S" },
  { id: "2", name: "Ahmed Al-Rashid", lastMessage: "The campaign results look great!", time: "15m ago", channel: "email", unread: 0, avatar: "A" },
  { id: "3", name: "Maria Garcia", lastMessage: "Can we schedule a demo?", time: "1h ago", channel: "instagram", unread: 1, avatar: "M" },
  { id: "4", name: "James Chen", lastMessage: "Thanks for the quick response", time: "3h ago", channel: "messenger", unread: 0, avatar: "J" },
  { id: "5", name: "Fatima Hassan", lastMessage: "When will the new features be available?", time: "5h ago", channel: "whatsapp", unread: 0, avatar: "F" },
];

const mockMessages: Record<string, Message[]> = {
  "1": [
    { id: "m1", sender: "contact", text: "Hi! I saw your platform on social media.", time: "10:30 AM" },
    { id: "m2", sender: "user", text: "Hello Sarah! Welcome to Ignify. How can I help you today?", time: "10:32 AM" },
    { id: "m3", sender: "contact", text: "I'd like to know more about your pricing plans", time: "10:35 AM" },
    { id: "m4", sender: "contact", text: "Specifically the Pro plan features", time: "10:35 AM" },
  ],
};

export default function ConversationsPage() {
  const t = useTranslations("conversationsPage");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const selected = mockConversations.find((c) => c.id === selectedId);
  const messages = selectedId ? mockMessages[selectedId] || [] : [];

  const filteredConversations = mockConversations.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="flex h-[calc(100vh-8rem)] border-t border-border">
        {/* Conversation list */}
        <div className="w-80 shrink-0 border-e border-border bg-surface">
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

          <div className="overflow-y-auto">
            {filteredConversations.map((conv) => {
              const ChannelIcon = channelIcons[conv.channel] || MessageSquare;
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={clsx(
                    "flex w-full items-center gap-3 border-b border-border-light px-4 py-3 text-start transition-colors",
                    selectedId === conv.id ? "bg-primary/5" : "hover:bg-surface-hover"
                  )}
                >
                  <div className="relative">
                    <Avatar.Root className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                      <Avatar.Fallback className="text-sm font-semibold text-white">
                        {conv.avatar}
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <span className={clsx("absolute -bottom-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full", channelColors[conv.channel])}>
                      <ChannelIcon className="h-2.5 w-2.5 text-white" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-text-primary">{conv.name}</p>
                      <span className="text-xs text-text-muted">{conv.time}</span>
                    </div>
                    <p className="truncate text-xs text-text-secondary">{conv.lastMessage}</p>
                  </div>
                  {conv.unread > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                      {conv.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex flex-1 flex-col">
          {selected ? (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 border-b border-border bg-surface px-6 py-3">
                <Avatar.Root className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                  <Avatar.Fallback className="text-sm font-semibold text-white">
                    {selected.avatar}
                  </Avatar.Fallback>
                </Avatar.Root>
                <div>
                  <p className="text-sm font-medium text-text-primary">{selected.name}</p>
                  <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium capitalize", channelColors[selected.channel].replace("bg-", "bg-").replace("500", "500/10"), "text-text-secondary")}>
                    {selected.channel}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto bg-background p-6">
                <div className="mx-auto max-w-2xl space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={clsx(
                        "flex",
                        msg.sender === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={clsx(
                          "max-w-[70%] rounded-2xl px-4 py-2.5",
                          msg.sender === "user"
                            ? "rounded-ee-sm bg-primary text-white"
                            : "rounded-es-sm bg-surface text-text-primary shadow-sm"
                        )}
                      >
                        <p className="text-sm">{msg.text}</p>
                        <p className={clsx(
                          "mt-1 text-xs",
                          msg.sender === "user" ? "text-white/70" : "text-text-muted"
                        )}>
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="border-t border-border bg-surface p-4">
                <div className="mx-auto flex max-w-2xl gap-3">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={t("typeMessage")}
                    className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm placeholder:text-text-muted focus:border-primary focus:outline-none"
                  />
                  <button className="rounded-lg bg-primary px-4 py-2.5 text-white hover:bg-primary-dark">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center bg-background">
              <MessageSquare className="h-12 w-12 text-text-muted/30" />
              <p className="mt-4 text-lg font-medium text-text-secondary">{t("noConversation")}</p>
              <p className="mt-1 text-sm text-text-muted">{t("noConversationDesc")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
