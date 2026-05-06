import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageOutlined } from "@ant-design/icons";
import { Badge } from "antd";
import { useChatStore } from "../../store/chatStore";

function ChatFloatingButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pulse, setPulse] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  // Get unread count from chat store
  const conversations = useChatStore((s) => s.conversations);
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  // Effect for pulse animation when new messages arrive
  useEffect(() => {
    if (totalUnread > 0) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 2000);
      return () => clearTimeout(t);
    }
  }, [totalUnread]);

  // Also listen for real-time unread count changes
  useEffect(() => {
    const unsubscribe = useChatStore.subscribe(
      (state) => state.conversations,
      (conversations) => {
        const newTotal = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
        if (newTotal > totalUnread) {
          // New message received, trigger pulse
          setPulse(true);
          setTimeout(() => setPulse(false), 2000);
        }
      }
    );
    return () => unsubscribe();
  }, [totalUnread]);

  // Don't show on chat page or login page
  if (location.pathname === "/chat" || location.pathname === "/" || location.pathname === "/login") {
    return null;
  }

  const handleOpenChat = () => {
    setIsReloading(true);
    console.log('🔄 Force reloading page...');
    window.location.replace('/chat');
  };

  // Get notification title based on unread count
  const getNotificationTitle = () => {
    if (totalUnread === 0) return "No new messages";
    if (totalUnread === 1) return "1 new message";
    return `${totalUnread} new messages`;
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "28px",
        right: "28px",
        zIndex: 9999,
      }}
    >
      {/* Loading Overlay */}
      {isReloading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              border: "4px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p style={{ color: "#fff", marginTop: 16, fontSize: 14 }}>
            Loading chat...
          </p>
          <p style={{ color: "#fff", marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Please wait
          </p>
        </div>
      )}

      {/* Pulse ring animation when new messages arrive */}
      {totalUnread > 0 && !isReloading && (
        <>
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "rgba(99, 102, 241, 0.35)",
              animation: pulse ? "chatPulse 1.5s ease-out" : "none",
            }}
          />
          {/* Second pulse ring for double effect */}
          <span
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.2)",
              animation: pulse ? "chatPulseDelay 1.5s ease-out 0.3s" : "none",
            }}
          />
        </>
      )}

      <Badge
        count={totalUnread}
        overflowCount={99}
        offset={[-4, 4]}
        title={getNotificationTitle()}
        style={{
          backgroundColor: "#ef4444",
          boxShadow: "0 0 0 2px #fff",
        }}
      >
        <button
          onClick={handleOpenChat}
          disabled={isReloading}
          title={getNotificationTitle()}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            border: "none",
            cursor: isReloading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: totalUnread > 0 
              ? "0 4px 20px rgba(239, 68, 68, 0.5)" 
              : "0 4px 20px rgba(102, 126, 234, 0.5)",
            transition: "transform 0.2s, box-shadow 0.2s",
            position: "relative",
            opacity: isReloading ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isReloading) {
              e.currentTarget.style.transform = "scale(1.12)";
              e.currentTarget.style.boxShadow = totalUnread > 0 
                ? "0 6px 28px rgba(239, 68, 68, 0.7)" 
                : "0 6px 28px rgba(102, 126, 234, 0.7)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = totalUnread > 0 
              ? "0 4px 20px rgba(239, 68, 68, 0.5)" 
              : "0 4px 20px rgba(102, 126, 234, 0.5)";
          }}
        >
          <MessageOutlined style={{ fontSize: 24, color: "#fff" }} />
          
          {/* Small inner notification dot for very high unread count */}
          {totalUnread > 99 && (
            <span
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#ef4444",
                border: "2px solid #fff",
              }}
            />
          )}
        </button>
      </Badge>

      {/* Tooltip label with message count */}
      {!isReloading && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            right: 0,
            marginBottom: 8,
            background: totalUnread > 0 
              ? "rgba(239, 68, 68, 0.95)" 
              : "rgba(15, 23, 42, 0.85)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            padding: "4px 10px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            opacity: 0,
            transition: "opacity 0.2s",
          }}
          className="chat-fab-tooltip"
        >
          {totalUnread > 0 ? `${totalUnread} unread message${totalUnread > 1 ? 's' : ''}` : 'Open Chat'}
        </div>
      )}

      <style>{`
        @keyframes chatPulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          50%  { transform: scale(1.8); opacity: 0.3; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes chatPulseDelay {
          0%   { transform: scale(1);   opacity: 0.5; }
          50%  { transform: scale(1.5); opacity: 0.2; }
          100% { transform: scale(2);   opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        button:hover + .chat-fab-tooltip,
        button:focus + .chat-fab-tooltip {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

export default ChatFloatingButton;