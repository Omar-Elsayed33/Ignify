import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: "owner" | "admin" | "editor" | "viewer";
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "pro" | "enterprise";
  logoUrl?: string;
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: User, tenant: Tenant, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setTenant: (tenant: Tenant) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (user, tenant, accessToken, refreshToken) =>
        set({
          user,
          tenant,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          tenant: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setUser: (user) => set({ user }),

      setTenant: (tenant) => set({ tenant }),
    }),
    {
      name: "ignify_auth",
    }
  )
);
