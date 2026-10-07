import { useState, useRef, useEffect, useCallback } from "react";

// Types
interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

interface ChatConfig {
  apiUrl: string;
  modelName: string;
  systemPrompt: string;
}

// Default config
const DEFAULT_CONFIG: ChatConfig = {
  apiUrl: "http://localhost:11434/api/chat", // Ollama default
  modelName: "llama3.2",
  systemPrompt: "You are IkarOS, a helpful AI assistant. Respond concisely and clearly.",
};

// Utility: generate unique ID
const genId = () => Math.random().toString(36).substring(2, 12);

// Utility: format time
const formatTime = (date: Date) => {
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
};

// Main App Component
export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [config, setConfig] = useState<ChatConfig>(() => {
    const saved = localStorage.getItem("ikaros-config");
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [input]);

  // Save config to localStorage
  useEffect(() => {
    localStorage.setItem("ikaros-config", JSON.stringify(config));
  }, [config]);

  // Test connection
  const testConnection = useCallback(async () => {
    try {
      setIsConnected(null);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      // Try Ollama-style endpoint
      const res = await fetch(config.apiUrl.replace("/api/chat", "/api/tags"), {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsConnected(res.ok);
    } catch {
      setIsConnected(false);
    }
  }, [config.apiUrl]);

  // Send message to AI backend
  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: genId(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      // Build conversation history for context
      const conversationHistory = [...messages, userMessage].map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }));

      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.modelName,
          messages: [
            { role: "system", content: config.systemPrompt },
            ...conversationHistory,
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle Ollama response format
      const aiContent = data.message?.content || data.response || data.content || "No response received.";

      const aiMessage: Message = {
        id: genId(),
        role: "ai",
        content: aiContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsConnected(true);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      
      // Show error as AI message with helpful info
      const errorMessage: Message = {
        id: genId(),
        role: "ai",
        content: `⚠ Connection Error\n\nCould not reach the AI backend at:\n\`${config.apiUrl}\`\n\nError: ${errorMsg}\n\nMake sure your local AI server (Ollama, LM Studio, etc.) is running.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsConnected(false);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Clear chat
  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="chat-container scanlines">
      {/* Top Bar */}
      <header className="chat-topbar">
        <div className="flex items-center gap-3">
          <div className="welcome-logo text-lg" style={{ textShadow: "0 0 15px rgba(var(--noct-primary-rgb), 0.5)" }}>
            IKAROS
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`status-dot ${
                isConnected === null
                  ? ""
                  : isConnected
                  ? "status-dot--online"
                  : "status-dot--offline"
              }`}
            />
            <span
              style={{
                fontFamily: "var(--noct-font-mono)",
                fontSize: "var(--noct-text-xs)",
                color: "var(--noct-text-dim)",
                letterSpacing: "var(--noct-tracking-wider)",
                textTransform: "uppercase",
              }}
            >
              {isConnected === null
                ? "STANDBY"
                : isConnected
                ? "ONLINE"
                : "OFFLINE"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={testConnection}
            className="send-btn"
            style={{ height: "32px", fontSize: "10px" }}
            title="Test connection"
          >
            PING
          </button>
          <button
            onClick={clearChat}
            className="send-btn"
            style={{ height: "32px", fontSize: "10px" }}
            title="Clear chat"
          >
            CLR
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="send-btn"
            style={{ height: "32px", fontSize: "10px" }}
            title="Settings"
          >
            CFG
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      <div className={`settings-panel ${showSettings ? "settings-panel--open" : ""}`}>
        <h3
          style={{
            fontFamily: "var(--noct-font-mono)",
            fontSize: "var(--noct-text-xs)",
            fontWeight: "var(--noct-weight-bold)",
            textTransform: "uppercase",
            letterSpacing: "var(--noct-tracking-widest)",
            color: "var(--noct-cyan)",
            marginBottom: "var(--noct-space-5)",
          }}
        >
          ▸ System Configuration
        </h3>

        <div style={{ marginBottom: "var(--noct-space-4)" }}>
          <label
            style={{
              fontFamily: "var(--noct-font-mono)",
              fontSize: "11px",
              color: "var(--noct-text-dim)",
              textTransform: "uppercase",
              letterSpacing: "var(--noct-tracking-widest)",
              display: "block",
              marginBottom: "var(--noct-space-1)",
            }}
          >
            API Endpoint
          </label>
          <input
            className="config-input"
            value={config.apiUrl}
            onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
            placeholder="http://localhost:11434/api/chat"
          />
          <p style={{ fontFamily: "var(--noct-font-mono)", fontSize: "10px", color: "var(--noct-text-dim)", marginTop: "4px" }}>
            Ollama: http://localhost:11434/api/chat
          </p>
        </div>

        <div style={{ marginBottom: "var(--noct-space-4)" }}>
          <label
            style={{
              fontFamily: "var(--noct-font-mono)",
              fontSize: "11px",
              color: "var(--noct-text-dim)",
              textTransform: "uppercase",
              letterSpacing: "var(--noct-tracking-widest)",
              display: "block",
              marginBottom: "var(--noct-space-1)",
            }}
          >
            Model
          </label>
          <input
            className="config-input"
            value={config.modelName}
            onChange={(e) => setConfig({ ...config, modelName: e.target.value })}
            placeholder="llama3.2"
          />
        </div>

        <div style={{ marginBottom: "var(--noct-space-4)" }}>
          <label
            style={{
              fontFamily: "var(--noct-font-mono)",
              fontSize: "11px",
              color: "var(--noct-text-dim)",
              textTransform: "uppercase",
              letterSpacing: "var(--noct-tracking-widest)",
              display: "block",
              marginBottom: "var(--noct-space-1)",
            }}
          >
            System Prompt
          </label>
          <textarea
            className="config-input"
            style={{ minHeight: "80px", resize: "vertical" }}
            value={config.systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            placeholder="You are a helpful assistant..."
          />
        </div>

        <div style={{ marginTop: "var(--noct-space-6)", padding: "var(--noct-space-3)", background: "var(--noct-ink-850)", border: "1px solid var(--noct-border)" }}>
          <p style={{ fontFamily: "var(--noct-font-mono)", fontSize: "10px", color: "var(--noct-text-dim)", lineHeight: "1.6" }}>
            <span style={{ color: "var(--noct-cyan)" }}>▸</span> Compatible with Ollama, LM Studio, text-generation-webui, and any OpenAI-compatible API.
            <br /><br />
            <span style={{ color: "var(--noct-cyan)" }}>▸</span> Messages are sent as conversation history for context.
            <br /><br />
            <span style={{ color: "var(--noct-cyan)" }}>▸</span> Config is saved in localStorage.
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <main className="chat-messages">
        {messages.length === 0 && !isTyping && (
          <div className="welcome-screen">
            <div className="welcome-logo">IKAROS</div>
            <div className="welcome-subtitle">Neural Interface v0.1</div>
            <div
              style={{
                fontFamily: "var(--noct-font-mono)",
                fontSize: "var(--noct-text-xs)",
                color: "var(--noct-text-dim)",
                maxWidth: "400px",
                lineHeight: "1.8",
                textAlign: "center",
              }}
            >
              <p style={{ color: "var(--noct-cyan)", marginBottom: "8px" }}>▸ SYSTEM READY</p>
              <p>Configure your AI backend in settings (CFG) or start typing below.</p>
              <p style={{ marginTop: "8px" }}>Default: Ollama @ localhost:11434</p>
            </div>
            <div
              style={{
                display: "flex",
                gap: "var(--noct-space-3)",
                marginTop: "var(--noct-space-4)",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {["¿Qué puedes hacer?", "Explícame un concepto", "Escribe código"].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    textareaRef.current?.focus();
                  }}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    border: "1px solid var(--noct-border)",
                    color: "var(--noct-text-muted)",
                    fontFamily: "var(--noct-font-mono)",
                    fontSize: "11px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--noct-cyan)";
                    e.currentTarget.style.color = "var(--noct-cyan)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--noct-border)";
                    e.currentTarget.style.color = "var(--noct-text-muted)";
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message message--${msg.role}`}>
            <div className="message-avatar">
              {msg.role === "user" ? "USR" : "AI"}
            </div>
            <div>
              <div className="message-bubble">
                <MessageContent content={msg.content} />
              </div>
              <div className="message-time">{formatTime(msg.timestamp)}</div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="message message--ai">
            <div className="message-avatar">AI</div>
            <div>
              <div className="message-bubble">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter message... (Shift+Enter for newline)"
            rows={1}
            disabled={isTyping}
          />
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || isTyping}
          >
            <span>SEND</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <div
          style={{
            fontFamily: "var(--noct-font-mono)",
            fontSize: "10px",
            color: "var(--noct-text-dim)",
            textAlign: "center",
            marginTop: "var(--noct-space-2)",
            letterSpacing: "var(--noct-tracking-wide)",
          }}
        >
          MODEL: {config.modelName} // {messages.length} messages
        </div>
      </footer>
    </div>
  );
}

// Message content renderer (handles basic markdown-like formatting)
function MessageContent({ content }: { content: string }) {
  // Simple code block and inline code handling
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return (
    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const code = part.slice(3, -3).replace(/^\w+\n/, "");
          return (
            <pre key={i} style={{ margin: "8px 0" }}>
              <code>{code}</code>
            </pre>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}
