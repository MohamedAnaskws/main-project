// src/components/ChatLayout.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { connectWebSocket, addMessageHandler, disconnectWebSocket, isWebSocketConnected } from '@/services/api';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import MainLayout from './layout/MainLayout';

const ChatLayout: React.FC = () => {
  const { user, token } = useAuthStore();
  const {
    handleWebSocketMessage,
    loadConversations,
    setOnlineUser,
    conversations,
    currentConversation,
    selectConversation
  } = useChatStore();
  const initialized = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [isChatReady, setIsChatReady] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      setIsChatReady(false);
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    const initChat = async () => {
      try {
        await loadConversations();

        const ws = connectWebSocket(token, handleWebSocketMessage, user.id);

        if (!ws) {
          setIsChatReady(true);
          return;
        }

        unsubscribeRef.current = addMessageHandler(handleWebSocketMessage);
        setOnlineUser(user.id, true);

        const lastConversationId = localStorage.getItem('last_conversation_id');
        if (lastConversationId) {
          const lastConv = useChatStore.getState().conversations.find(
            (c) => c.id === parseInt(lastConversationId)
          );
          if (lastConv) await selectConversation(lastConv);
        }

        setIsChatReady(true);
      } catch (error) {
        console.error('ChatLayout init failed:', error);
        setIsChatReady(true);
        setTimeout(() => {
          if (initialized.current && token) {
            connectWebSocket(token, handleWebSocketMessage, user.id);
          }
        }, 5000);
      }
    };

    const timer = setTimeout(initChat, 300);

    return () => {
      clearTimeout(timer);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      disconnectWebSocket();
      initialized.current = false;
      setIsChatReady(false);
    };
  }, [token, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentConversation) {
      localStorage.setItem('last_conversation_id', currentConversation.id.toString());
    }
  }, [currentConversation]);

  useEffect(() => {
    if (!isChatReady || !token) return;
    const check = setInterval(() => {
      if (!isWebSocketConnected() && token && user) {
        connectWebSocket(token, handleWebSocketMessage, user.id);
      }
    }, 10000);
    return () => clearInterval(check);
  }, [isChatReady, token, user, handleWebSocketMessage]);

  if (!isChatReady) {
    return (
      <MainLayout>
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-purple-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Connecting to chat...</p>
          <p className="text-sm text-gray-400 mt-1">Please wait</p>
        </div>
      </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
    <div className="h-full flex overflow-hidden">
      <div className="w-84 border-r bg-gray-50 flex flex-col flex-shrink-0">
        <div className="flex-1 overflow-hidden">
          <ChatList />
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatWindow />
      </div>
    </div>
    </MainLayout>
  );
};

export default ChatLayout;
