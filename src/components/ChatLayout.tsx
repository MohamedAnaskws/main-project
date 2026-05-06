import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { connectWebSocket, addMessageHandler, disconnectWebSocket } from '@/services/api';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import MainLayout from './layout/MainLayout';

const ChatLayout: React.FC = () => {
  const { user, token } = useAuthStore();
  const {
    handleWebSocketMessage,
    loadConversations,
    setOnlineUser,
    currentConversation,
    selectConversation,
  } = useChatStore();
  
  const initialized = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [isChatReady, setIsChatReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Initializing chat...');

  const stableHandleMessage = useCallback(handleWebSocketMessage, [handleWebSocketMessage]);

  useEffect(() => {
    // Get auth from localStorage directly
    const authToken = localStorage.getItem('access_token');
    let authUser = null;
    
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        authUser = JSON.parse(userStr);
      }
    } catch (e) {
      console.error('Failed to parse user:', e);
    }
    
    if (!authToken || !authUser) {
      console.log('No auth data, redirecting to login');
      window.location.href = '/';
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    const initChat = async () => {
      try {
        setLoadingMessage('Loading conversations...');
        
        // Load cached conversations first
        const cachedConversations = localStorage.getItem('cached_conversations');
        if (cachedConversations) {
          try {
            const parsed = JSON.parse(cachedConversations);
            if (Array.isArray(parsed) && parsed.length > 0) {
              useChatStore.setState({ conversations: parsed });
            }
          } catch (e) {
            console.error('Failed to parse cached conversations:', e);
          }
        }

        setLoadingMessage('Connecting to server...');
        
        // Connect WebSocket
        const ws = connectWebSocket(authToken, stableHandleMessage, authUser.id);
        
        if (ws) {
          unsubscribeRef.current = addMessageHandler(stableHandleMessage);
          setOnlineUser(authUser.id, true);
        }

        setLoadingMessage('Loading fresh data...');
        
        // Load fresh conversations
        await loadConversations();
        
        // Update cache
        const { conversations } = useChatStore.getState();
        if (conversations.length > 0) {
          localStorage.setItem('cached_conversations', JSON.stringify(conversations));
        }

        setLoadingMessage('Restoring last conversation...');
        
        // Restore last conversation
        const lastConversationId = localStorage.getItem('last_conversation_id');
        if (lastConversationId && !currentConversation) {
          const conversations_state = useChatStore.getState().conversations;
          const lastConv = conversations_state.find(
            (c) => c.id === parseInt(lastConversationId)
          );
          if (lastConv) {
            await selectConversation(lastConv);
          }
        }
        
        setLoadingMessage('Ready');
        setIsChatReady(true);
        
      } catch (error) {
        console.error('ChatLayout init failed:', error);
        setLoadingMessage('Connection failed. Please refresh.');
        setIsChatReady(false);
      }
    };

    initChat();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      disconnectWebSocket();
      initialized.current = false;
    };
  }, []); // Empty dependency array - run once

  // Save last conversation ID
  useEffect(() => {
    if (currentConversation) {
      localStorage.setItem('last_conversation_id', currentConversation.id.toString());
    }
  }, [currentConversation]);

  if (!isChatReady) {
    return (
      <MainLayout>
        <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-purple-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">{loadingMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              Refresh Page
            </button>
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