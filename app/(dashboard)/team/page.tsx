'use client';

import React, { useState, useEffect } from 'react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { User } from '@/types';
import { getTeammates } from '@/lib/services/team';
import { ConnectionStatusBadge } from '@/components/layout/ConnectionStatusBadge';
import { InviteModal } from '@/components/team/InviteModal';
import { DeactivateModal } from '@/components/team/DeactivateModal';
import { BulkInviteModal } from '@/components/team/BulkInviteModal';
import { UserCheck, UserPlus, Upload, UserX } from 'lucide-react';

export default function TeamPage() {
  const containerRef = useGsapReveal<HTMLDivElement>({
    stagger: 0.1,
    yOffset: 44,
    scaleFrom: 0.9,
    blurFrom: 10,
  });
  const { user, organization } = useAuthStore();

  const [teammates, setTeammates] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [deactivatingTeammate, setDeactivatingTeammate] = useState<User | null>(null);

  const fetchTeammates = async () => {
    if (!organization?.id) return;
    setIsLoading(true);
    const data = await getTeammates(organization.id);
    if (data.length === 0 && user) {
      setTeammates([user]);
    } else {
      setTeammates(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTeammates();
  }, [organization?.id, user]);

  const handleTeammateInvited = (newUser: User) => {
    setTeammates((prev) => [...prev, newUser]);
  };

  const handleTeammateDeactivated = (deactivatedId: string) => {
    setTeammates((prev) =>
      prev.map((t) => (t.id === deactivatedId ? { ...t, inboxStatus: 'disconnected' as const } : t))
    );
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Team Management</h1>
          <p className="text-xs text-dark-muted">Monitor teammate Google Workspace inbox connection health and assign roles.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="glass-button px-3.5 py-2 rounded-xl text-xs font-medium text-white flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk Invite via CSV</span>
          </button>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="btn-mustard px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Invite Teammate</span>
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-dark-muted">Loading team members...</div>
        ) : teammates.length === 0 ? (
          <div className="p-12 text-center text-xs text-dark-muted">
            No team members added yet. Click "Invite Teammate" to add your sales team.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-dark-muted font-medium uppercase tracking-wider">
              <tr>
                <th className="p-4">Teammate</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Inbox Health</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {teammates.map((member) => (
                <tr key={member.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-semibold text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-400/20 flex items-center justify-center font-bold text-xs text-blue-200">
                      {member.displayName ? member.displayName.slice(0, 2).toUpperCase() : member.email.slice(0, 2).toUpperCase()}
                    </div>
                    <span>{member.displayName || member.email}</span>
                  </td>
                  <td className="p-4 text-gray-400 font-mono">{member.email}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-gray-200 border border-white/10 uppercase">
                      {member.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <ConnectionStatusBadge status={member.inboxStatus} />
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setDeactivatingTeammate(member)}
                      title="Deactivate rep & reassign leads"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={handleTeammateInvited}
      />

      <BulkInviteModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={fetchTeammates}
      />

      {/* Deactivate & Reassign Modal */}
      <DeactivateModal
        teammate={deactivatingTeammate}
        allTeammates={teammates}
        isOpen={!!deactivatingTeammate}
        onClose={() => setDeactivatingTeammate(null)}
        onSuccess={handleTeammateDeactivated}
      />
    </div>
  );
}
