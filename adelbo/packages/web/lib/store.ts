import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email?: string;
  displayName?: string;
  walletAddress?: string;
  tier: string;
  reputationScore: number;
  referralCode?: string;
}

interface SearchState {
  destination: string;
  checkin: string;
  checkout: string;
  adults: number;
  query: string;
}

interface AuthStore {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
}

interface SearchStore {
  search: SearchState;
  setSearch: (search: Partial<SearchState>) => void;
  resetSearch: () => void;
}

interface BookingStore {
  pendingBookingId: string | null;
  setPendingBooking: (id: string | null) => void;
}

const defaultSearch: SearchState = {
  destination: '',
  checkin: '',
  checkout: '',
  adults: 2,
  query: '',
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
      updateUser: (update) =>
        set((state) => ({ user: state.user ? { ...state.user, ...update } : null })),
    }),
    {
      name: 'adelbo_auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

export const useSearchStore = create<SearchStore>((set) => ({
  search: defaultSearch,
  setSearch: (search) =>
    set((state) => ({ search: { ...state.search, ...search } })),
  resetSearch: () => set({ search: defaultSearch }),
}));

export const useBookingStore = create<BookingStore>((set) => ({
  pendingBookingId: null,
  setPendingBooking: (id) => set({ pendingBookingId: id }),
}));
