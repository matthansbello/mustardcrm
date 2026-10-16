'use client';

import { create } from 'zustand';
import { User, Organization, InboxConnectionStatus } from '@/types';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { syncUserProfile, flushPendingMailboxTokens, signOutUser } from '@/lib/firebase/auth';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  inboxStatus: InboxConnectionStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Set when Firebase sign-in succeeded but the workspace profile couldn't load. */
  authError: string | null;
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
  authError: null,
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
        set({ isLoading: true, authError: null });
        try {
          const { user, organization } = await syncUserProfile(fbUser);
          let inboxStatus = user.inboxStatus || 'disconnected';

          document.cookie = `__mustard_auth=1; path=/; max-age=${60 * 60 * 24 * 5}; SameSite=Lax`;

          try {
            const idToken = await fbUser.getIdToken();
            const connected = await flushPendingMailboxTokens(idToken, organization.id);
            if (connected) {
              inboxStatus = 'connected';
              user.inboxStatus = 'connected';
            }
            await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            });
          } catch {
            // Session cookie / mailbox token persist is best-effort
          }

          set({
            user,
            organization,
            inboxStatus,
            isLoading: false,
            isAuthenticated: true,
            authError: null,
          });
        } catch (error) {
          console.error('Error syncing user profile:', error);
          set({
            user: null,
            organization: null,
            isLoading: false,
            isAuthenticated: false,
            authError: error instanceof Error ? error.message : 'Could not load your workspace.',
          });
          // Don't leave a half-signed-in Firebase session behind.
          signOutUser().catch(() => undefined);
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
