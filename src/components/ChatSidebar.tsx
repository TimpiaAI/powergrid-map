"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquare,
  X,
  ArrowUp,
  Bot,
  User,
  Loader2,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

function generateSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function renderContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Bold: **text**
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const boldRegex = /\*\*(.+?)\*\*/g;
    let match: RegExpExecArray | null;

    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      parts.push(
        <strong key={`b-${i}-${match.index}`} style={{ fontWeight: 600 }}>
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    // Bullet list items
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.*)$/);
    if (bulletMatch) {
      elements.push(
        <div
          key={`line-${i}`}
          style={{ display: "flex", gap: 6, paddingLeft: 4, marginTop: 2 }}
        >
          <span style={{ color: "#71717a", flexShrink: 0 }}>&bull;</span>
          <span>{parts.length > 0 ? parts : line}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(
        <div key={`line-${i}`} style={{ height: 8 }} />
      );
    } else {
      elements.push(
        <span key={`line-${i}`}>
          {parts.length > 0 ? parts : line}
          {i < lines.length - 1 && <br />}
        </span>
      );
    }
  }

  return <>{elements}</>;
}

export default function ChatSidebar({ isOpen, onToggle }: ChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 4 * 20; // ~4 lines
      textareaRef.current.style.height =
        Math.min(scrollHeight, maxHeight) + "px";
    }
  }, [input]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, session_id: sessionId }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response || data.message || data.answer || "Raspuns primit.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "Nu am putut contacta serverul AI. Verifica daca backend-ul PowerGrid ruleaza pe portul 8000.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Collapsed state — floating toggle button
  if (!isOpen) {
    return (
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 20 }}>
        <button
          onClick={onToggle}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            background: "rgba(19, 19, 24, 0.95)",
            border: "1px solid #27272a",
            borderRadius: 10,
            cursor: "pointer",
            backdropFilter: "blur(16px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}
          title="Deschide chat AI"
        >
          <MessageSquare
            className="w-4 h-4"
            style={{ color: "#e4e4e7" }}
          />
        </button>
      </div>
    );
  }

  // Open state — full chat sidebar
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        bottom: 12,
        width: 360,
        zIndex: 20,
      }}
      className="animate-slide-in-right"
    >
      <div
        style={{
          height: "100%",
          background: "rgba(13, 13, 18, 0.96)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(39, 39, 42, 0.8)",
          borderRadius: 14,
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset",
          display: "flex",
          flexDirection: "column" as const,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid #1e1e24",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(139, 92, 246, 0.15)",
              }}
            >
              <Bot style={{ width: 17, height: 17, color: "#8b5cf6" }} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#e4e4e7",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                PowerGrid AI Agent
              </h1>
              <p
                style={{
                  fontSize: 10,
                  color: "#71717a",
                  fontWeight: 500,
                  marginTop: 1,
                }}
              >
                Intreaba despre reteaua electrica
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            style={{
              padding: 6,
              borderRadius: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            title="Inchide chat"
          >
            <X style={{ width: 16, height: 16, color: "#71717a" }} />
          </button>
        </div>

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto" as const,
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column" as const,
            gap: 12,
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: "40px 20px",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "rgba(139, 92, 246, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Bot style={{ width: 24, height: 24, color: "#8b5cf6" }} />
              </div>
              <div style={{ textAlign: "center" as const }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#a1a1aa",
                    marginBottom: 4,
                  }}
                >
                  Bine ai venit!
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "#52525b",
                    lineHeight: 1.5,
                    maxWidth: 240,
                  }}
                >
                  Pune intrebari despre statii, linii, proiecte ATR, sau orice
                  date din reteaua electrica.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                flexDirection: "column" as const,
                alignItems:
                  msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  maxWidth: "90%",
                  flexDirection:
                    msg.role === "user"
                      ? ("row-reverse" as const)
                      : ("row" as const),
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 2,
                    background:
                      msg.role === "user"
                        ? "rgba(59, 130, 246, 0.15)"
                        : "rgba(139, 92, 246, 0.15)",
                  }}
                >
                  {msg.role === "user" ? (
                    <User
                      style={{
                        width: 13,
                        height: 13,
                        color: "#3b82f6",
                      }}
                    />
                  ) : (
                    <Bot
                      style={{
                        width: 13,
                        height: 13,
                        color: "#8b5cf6",
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: "#e4e4e7",
                    background:
                      msg.role === "user"
                        ? "rgba(59, 130, 246, 0.15)"
                        : "rgba(10, 10, 15, 0.6)",
                    border:
                      msg.role === "user"
                        ? "1px solid rgba(59, 130, 246, 0.25)"
                        : "1px solid rgba(39, 39, 42, 0.4)",
                  }}
                >
                  {renderContent(msg.content)}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                  background: "rgba(139, 92, 246, 0.15)",
                }}
              >
                <Bot
                  style={{
                    width: 13,
                    height: 13,
                    color: "#8b5cf6",
                  }}
                />
              </div>
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "rgba(10, 10, 15, 0.6)",
                  border: "1px solid rgba(39, 39, 42, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Loader2
                  style={{
                    width: 14,
                    height: 14,
                    color: "#8b5cf6",
                    animation: "spin 1s linear infinite",
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: "#71717a",
                  }}
                >
                  Se proceseaza...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #1e1e24",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              background: "rgba(10, 10, 15, 0.6)",
              border: "1px solid rgba(39, 39, 42, 0.4)",
              borderRadius: 10,
              padding: "8px 12px",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Intreaba despre reteaua electrica..."
              disabled={isLoading}
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#e4e4e7",
                fontSize: 12,
                lineHeight: "20px",
                resize: "none" as const,
                fontFamily: "inherit",
                padding: 0,
                maxHeight: 80,
                overflowY: "auto" as const,
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                border: "none",
                cursor:
                  !input.trim() || isLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background:
                  !input.trim() || isLoading
                    ? "rgba(39, 39, 42, 0.4)"
                    : "#8b5cf6",
                transition: "background 0.15s",
              }}
              title="Trimite mesaj"
            >
              <ArrowUp
                style={{
                  width: 14,
                  height: 14,
                  color:
                    !input.trim() || isLoading
                      ? "#52525b"
                      : "#ffffff",
                }}
              />
            </button>
          </div>
          <p
            style={{
              fontSize: 9,
              color: "#3f3f46",
              textAlign: "center" as const,
              marginTop: 8,
            }}
          >
            Shift+Enter pentru linie noua
          </p>
        </div>
      </div>

      {/* Keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
