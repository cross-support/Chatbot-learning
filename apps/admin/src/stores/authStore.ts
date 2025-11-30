import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

interface AuthState {
  admin: Admin | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (admin: Admin, token: string) => void;
  logout: () => void;
  updateStatus: (status: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      admin: null,
      token: null,
      isAuthenticated: false,
      login: (admin, token) =>
        set({
          admin,
          token,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          admin: null,
          token: null,
          isAuthenticated: false,
        }),
      updateStatus: (status) =>
        set((state) => ({
          admin: state.admin ? { ...state.admin, status } : null,
        })),
    }),
    {
      name: 'crossbot-auth',
    }
  )
);
