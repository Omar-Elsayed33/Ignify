"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { clsx } from "clsx";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function AssistantPage() {
  const t = useTranslations("assistantPage");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: t("welcome") },
  ]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "I'm analyzing your request. This is a demo response - in production, this would connect to the AI backend to provide intelligent marketing assistance based on your query.",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
  };

  const handlePrompt = (prompt: string) => {
    setInput(prompt);
  };

  const suggestedPrompts = [
    t("prompt1"),
    t("prompt2"),
    t("prompt3"),
    t("prompt4"),
  ];

  return (
    <div>
      <DashboardHeader title={t("title")} />

      <div className="flex h-[calc(100vh-8rem)] flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto bg-background p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={clsx("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={clsx(
                    "max-w-[75%] rounded-2xl px-4 py-3",
                    msg.role === "user"
                      ? "rounded-ee-sm bg-primary text-white"
                      : "rounded-es-sm bg-surface text-text-primary shadow-sm"
                  )}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Suggested prompts */}
        {messages.length <= 1 && (
          <div className="border-t border-border bg-surface px-6 py-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-text-secondary">
              <Sparkles className="h-4 w-4 text-accent" />
              {t("suggestedPrompts")}
            </p>
            <div className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-2">
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePrompt(prompt)}
                  className="rounded-lg border border-border bg-background px-4 py-2.5 text-start text-sm text-text-secondary transition-colors hover:border-primary hover:text-primary"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border bg-surface p-4">
          <div className="mx-auto flex max-w-3xl gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={t("placeholder")}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="rounded-xl bg-primary px-5 py-3 text-white transition-colors hover:bg-primary-dark disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
