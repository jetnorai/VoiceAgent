import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email?: string;
  displayName?: string;
  walletAddress?: string;
  tier: string;
  reputationScore: number;
}

interface AuthStore {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

interface SearchStore {
  search: {
    destination: string;
    checkin: string;
    checkout: string;
    adults: number;
    query: string;
  };
  setSearch: (s: Partial<SearchStore['search']>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        set({ token, user });
        if (typeof window !== 'undefined') localStorage.setItem('adelbo_token', token);
      },
      clearAuth: () => {
        set({ token: null, user: null });
        if (typeof window !== 'undefined') localStorage.removeItem('adelbo_token');
      },
    }),
    { name: 'adelbo_auth', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
);

export const useSearchStore = create<SearchStore>((set) => ({
  search: { destination: '', checkin: '', checkout: '', adults: 2, query: '' },
  setSearch: (s) => set((state) => ({ search: { ...state.search, ...s } })),
}));
