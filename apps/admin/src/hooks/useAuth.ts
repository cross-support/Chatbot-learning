import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const { admin, token, isAuthenticated, logout } = useAuthStore();

  return {
    admin,
    token,
    isAuthenticated,
    logout,
  };
}
