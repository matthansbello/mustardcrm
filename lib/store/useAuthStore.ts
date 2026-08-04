'use client';

import { create } from 'zustand';
import { User, Organization, InboxConnectionStatus } from '@/types';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { syncUserProfile } from '@/lib/firebase/auth';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  inboxStatus: InboxConnectionStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setOrganization: (org: Organization | null) => void;
  setInboxStatus: (status: InboxConnectionStatus) => void;
  setIsLoading: (isLoading: boolean) => void;
  initAuthListener: () => () => void;
}

let listenerStarted = false;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  inboxStatus: 'disconnected',
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) =>
    set({
      user,
      inboxStatus: user?.inboxStatus || 'disconnected',
      isAuthenticated: !!user,
    }),
  setOrganization: (organization) => set({ organization }),
  setInboxStatus: (inboxStatus) => set({ inboxStatus }),
  setIsLoading: (isLoading) => set({ isLoading }),
  initAuthListener: () => {
    if (listenerStarted) {
      return () => undefined;
    }
    listenerStarted = true;
    set({ isLoading: true });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const { user, organization } = await syncUserProfile(fbUser);
          set({
            user,
            organization,
            inboxStatus: user.inboxStatus || 'disconnected',
            isLoading: false,
            isAuthenticated: true,
          });

          // Client hint cookie so middleware can pass before Admin session cookie is ready
          document.cookie = `__mustard_auth=1; path=/; max-age=${60 * 60 * 24 * 5}; SameSite=Lax`;

          // Persist session cookie for middleware
          try {
            const idToken = await fbUser.getIdToken();
            await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            });
          } catch {
            // Session cookie is best-effort when Admin SDK isn't fully configured
          }
        } catch (error) {
          console.error('Error syncing user profile:', error);
          set({
            user: null,
            organization: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } else {
        set({
          user: null,
          organization: null,
          inboxStatus: 'disconnected',
          isLoading: false,
          isAuthenticated: false,
        });
        document.cookie = '__mustard_auth=; path=/; max-age=0; SameSite=Lax';
        fetch('/api/auth/session', { method: 'DELETE' }).catch(() => undefined);
      }
    });

    return () => {
      listenerStarted = false;
      unsubscribe();
    };
  },
}));
