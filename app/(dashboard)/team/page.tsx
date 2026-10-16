'use client';

import React, { useEffect, useState } from 'react';
import { Upload, UserPlus, UserX } from 'lucide-react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { User, UserRole } from '@/types';
import { getTeammates } from '@/lib/services/team';
import { ConnectionStatusBadge } from '@/components/layout/ConnectionStatusBadge';
import { InviteModal } from '@/components/team/InviteModal';
import { DeactivateModal } from '@/components/team/DeactivateModal';
import { BulkInviteModal } from '@/components/team/BulkInviteModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'badge-violet',
  manager: 'badge-blue',
  rep: 'badge-neutral',
};

export default function TeamPage() {
  const containerRef = useGsapReveal<HTMLDivElement>();
  const { user, organization } = useAuthStore();

  const [teammates, setTeammates] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<User | null>(null);

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const fetchTeammates = async () => {
    if (!organization?.id) return;
    const data = await getTeammates(organization.id);
    setTeammates(data.length === 0 && user ? [user] : data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTeammates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, user?.id]);

  const sorted = [...teammates].sort((a, b) => {
    if (a.id === user?.id) return -1;
    if (b.id === user?.id) return 1;
    return (a.displayName || a.email).localeCompare(b.displayName || b.email);
  });

  return (
    <div ref={containerRef} className="space-y-6">
      <PageHeader
        title="Team"
        description="Everyone in the workspace sees the same contacts, companies and deals."
        actions={
          <>
            <button onClick={() => setIsBulkOpen(true)} className="btn btn-secondary">
              <Upload className="h-4 w-4" />
              Bulk invite
            </button>
            <button onClick={() => setIsInviteOpen(true)} className="btn btn-primary">
              <UserPlus className="h-4 w-4" />
              Invite teammate
            </button>
          </>
        }
      />

      <section className="card overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-16 text-center text-sm text-fg-muted">Loading team…</p>
        ) : (
          <>
          <ul className="divide-y divide-line md:hidden">
            {sorted.map((member) => {
              const isYou = member.id === user?.id;
              return (
                <li key={member.id} className="flex items-start gap-3 px-4 py-3">
                  <Avatar name={member.displayName} email={member.email} src={member.photoURL} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-fg">
                      <span className="truncate">{member.displayName || member.email}</span>
                      {isYou && <span className="badge badge-neutral">You</span>}
                      {member.status === 'invited' && <span className="badge badge-amber">Invited</span>}
                    </p>
                    <p className="truncate text-xs text-fg-subtle">{member.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`badge capitalize ${ROLE_BADGE[member.role] || 'badge-neutral'}`}>{member.role}</span>
                      {member.status !== 'invited' && <ConnectionStatusBadge status={member.inboxStatus} />}
                    </div>
                  </div>
                  {canManage && !isYou && (
                    <button
                      onClick={() => setDeactivating(member)}
                      className="btn btn-ghost btn-icon btn-sm shrink-0 hover:text-rose-300"
                      aria-label={`Deactivate ${member.displayName || member.email}`}
                    >
                      <UserX className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="table min-w-[680px]">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Gmail</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((member) => {
                  const isYou = member.id === user?.id;
                  return (
                    <tr key={member.id} className="hover:bg-surface-2">
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={member.displayName} email={member.email} src={member.photoURL} size="sm" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate font-medium text-fg">
                              {member.displayName || member.email}
                              {isYou && <span className="badge badge-neutral">You</span>}
                              {member.status === 'invited' && <span className="badge badge-amber">Invited</span>}
                            </p>
                            <p className="truncate text-xs text-fg-subtle">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge capitalize ${ROLE_BADGE[member.role] || 'badge-neutral'}`}>{member.role}</span>
                      </td>
                      <td>
                        {member.status === 'invited' ? (
                          <span className="text-sm text-fg-subtle">—</span>
                        ) : (
                          <ConnectionStatusBadge status={member.inboxStatus} />
                        )}
                      </td>
                      <td className="text-right">
                        {canManage && !isYou && (
                          <button
                            onClick={() => setDeactivating(member)}
                            className="btn btn-ghost btn-icon btn-sm hover:text-rose-300"
                            aria-label={`Deactivate ${member.displayName || member.email}`}
                            title="Deactivate"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onSuccess={(u) => setTeammates((prev) => [...prev, u])}
      />
      <BulkInviteModal isOpen={isBulkOpen} onClose={() => setIsBulkOpen(false)} onSuccess={fetchTeammates} />
      <DeactivateModal
        teammate={deactivating}
        allTeammates={teammates}
        isOpen={!!deactivating}
        onClose={() => setDeactivating(null)}
        onSuccess={(id) => setTeammates((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
