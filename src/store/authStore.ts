import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { login as loginApi, getCurrentUser, disconnectWebSocket } from '../services/api';
import type { User } from '../types';
import { setAuth, logout as sharedLogout, getToken, getUser } from '../utils/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loadUser: () => Promise<void>;
  isAdmin: () => boolean;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: getUser(), // Get from cache immediately
      token: getToken() || null,
      loading: false, // CRITICAL: Set to false, not true
      initialized: !!getUser(), // True if we have cached user

      login: async (username, password) => {
        try {
          set({ loading: true });
          const response = await loginApi(username, password);
          const { access_token, user } = response.data;
          setAuth({ access_token, user });
          set({ user, token: access_token, loading: false, initialized: true });
          return true;
        } catch (error) {
          console.error('Login failed:', error);
          set({ loading: false, initialized: true });
          return false;
        }
      },

      logout: () => {
        try { disconnectWebSocket(); } catch (_) {}
        sharedLogout();
        set({ user: null, token: null, loading: false, initialized: true });
      },

      loadUser: async () => {
        const { user, token } = get();
        
        // Skip if we already have user
        if (user && token) {
          console.log('✅ Auth: Using cached user, skipping API call');
          set({ initialized: true, loading: false });
          return;
        }
        
        const currentToken = token || getToken();
        if (!currentToken) {
          set({ loading: false, initialized: true, user: null, token: null });
          return;
        }
        
        // Check localStorage for cached user
        const cachedUser = localStorage.getItem('user');
        if (cachedUser && currentToken) {
          try {
            const userData = JSON.parse(cachedUser);
            console.log('✅ Auth: Using localStorage user, skipping API');
            set({ user: userData, token: currentToken, loading: false, initialized: true });
            return;
          } catch (e) {
            console.error('Failed to parse cached user:', e);
          }
        }
        
        // Only make API call if absolutely necessary
        set({ loading: true });
        try {
          console.log('🌐 Auth: No cached user, calling /api/auth/me');
          const response = await getCurrentUser();
          const userData = response.data;
          set({ user: userData, token: currentToken, loading: false, initialized: true });
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (error: any) {
          console.error('Failed to load user:', error);
          if (error.response?.status === 401) {
            sharedLogout();
          }
          set({ user: null, token: null, loading: false, initialized: true });
        }
      },

      isAdmin: () => {
        const { user } = get();
        return user?.roleid === 1;
      },

      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token,
        initialized: state.initialized 
      }),
    }
  )
);