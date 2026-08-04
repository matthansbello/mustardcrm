'use client';

import React from 'react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { ConnectionStatusBadge } from '@/components/layout/ConnectionStatusBadge';
import { Settings, Shield, Mail, Clock, Save } from 'lucide-react';

export default function SettingsPage() {
  const containerRef = useGsapReveal<HTMLDivElement>({
    stagger: 0.12,
    yOffset: 40,
    scaleFrom: 0.92,
    blurFrom: 10,
  });
  const { organization, inboxStatus } = useAuthStore();

  return (
    <div ref={containerRef} className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-display text-white">Settings</h1>
        <p className="text-xs text-dark-muted">Configure workspace defaults, outreach caps, and Google Workspace connection.</p>
      </div>

      {/* Organization Settings */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-300">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Organization Profile</h3>
            <p className="text-[11px] text-dark-muted">Primary workspace name and sending domain configuration.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Organization Name</label>
            <input
              type="text"
              defaultValue={organization?.name || 'Acme Corp'}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Primary Domain</label>
            <input
              type="text"
              defaultValue={organization?.domain || 'acme.com'}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Outreach Safety Caps */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Deliverability & Sending Caps</h3>
            <p className="text-[11px] text-dark-muted">Per-mailbox daily limits and allowed sending windows.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Daily Send Cap (Per Mailbox)</label>
            <input
              type="number"
              defaultValue={50}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400"
            />
            <p className="text-[10px] text-dark-muted">Recommended: 30-50 sends/day to preserve domain reputation.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Sending Window</label>
            <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400">
              <option value="9-17">9:00 AM – 5:00 PM (Recipient Time)</option>
              <option value="8-18">8:00 AM – 6:00 PM (Sender Time)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Connection Status Box */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 flex items-center justify-between">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-white">Google Workspace Connection Status</h4>
          <p className="text-[11px] text-dark-muted">Manage OAuth permissions and refresh tokens.</p>
        </div>
        <ConnectionStatusBadge status={inboxStatus} />
      </div>

      <div className="flex justify-end">
        <button className="btn-mustard px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  );
}
