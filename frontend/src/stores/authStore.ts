import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AuthUser, AuthState, getCurrentUser, logout as authLogout } from '../lib/auth';

interface AuthStore extends AuthState {
  // Actions
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (user: AuthUser) => void;
  logout: () => void;
  initializeAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,

      // Actions
      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
          error: null,
        });
      },

      setLoading: (loading) => {
        set({ loading });
      },

      setError: (error) => {
        set({ error, loading: false });
      },

      login: (user) => {
        set({
          user,
          isAuthenticated: true,
          loading: false,
          error: null,
        });
      },

      logout: () => {
        // Clear auth token and redirect
        authLogout();
        
        // Reset store state
        set({
          user: null,
          isAuthenticated: false,
          loading: false,
          error: null,
        });
      },

      initializeAuth: async () => {
        const { setUser, setLoading, setError } = get();
        
        setLoading(true);
        setError(null);

        try {
          const user = await getCurrentUser();
          setUser(user);
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          setError('Failed to verify authentication');
          setUser(null);
        } finally {
          setLoading(false);
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-store', // Key for localStorage
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist user data, not loading/error states
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
); 