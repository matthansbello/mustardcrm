'use client';

import React, { useState, useEffect } from 'react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Sequence } from '@/types';
import { getSequences } from '@/lib/services/sequences';
import { SequenceBuilder } from '@/components/sequences/SequenceBuilder';
import { Send, Plus, Play, Pause, Users, Clock, ArrowLeft } from 'lucide-react';

export default function SequencesPage() {
  const containerRef = useGsapReveal<HTMLDivElement>({
    stagger: 0.1,
    yOffset: 48,
    scaleFrom: 0.9,
    blurFrom: 12,
  });
  const { organization } = useAuthStore();

  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);

  const fetchSequences = async () => {
    if (!organization?.id) return;
    setIsLoading(true);
    const data = await getSequences(organization.id);
    setSequences(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSequences();
  }, [organization?.id]);

  if (isBuilding) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setIsBuilding(false);
            fetchSequences();
          }}
          className="glass-button px-3.5 py-1.5 rounded-xl text-xs font-medium text-gray-300 hover:text-white flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Sequences</span>
        </button>

        <SequenceBuilder
          onLaunch={() => {
            setIsBuilding(false);
            fetchSequences();
          }}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Cold Email Sequences</h1>
          <p className="text-xs text-dark-muted">Automated multi-step email campaigns sent natively via Gmail API.</p>
        </div>

        <button
          onClick={() => setIsBuilding(true)}
          className="btn-mustard px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>New Sequence</span>
        </button>
      </div>

      {isLoading ? (
        <div className="glass-panel p-12 rounded-2xl border border-white/10 text-center text-xs text-dark-muted">
          Loading email sequences...
        </div>
      ) : sequences.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl border border-white/10 text-center space-y-3">
          <Send className="w-10 h-10 text-gray-600 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-white">No cold email sequences created yet</h3>
            <p className="text-xs text-dark-muted mt-1 max-w-sm mx-auto">
              Build your first multi-step automated sequence with reply detection and Gmail delivery.
            </p>
          </div>
          <button
            onClick={() => setIsBuilding(true)}
            className="btn-mustard px-4 py-2 rounded-xl text-xs font-semibold"
          >
            Build First Sequence
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sequences.map((seq) => {
            const stats = seq.stats || { enrolled: 0, sent: 0, opened: 0, replied: 0 };
            const openRate = stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) + '%' : '0.0%';
            const replyRate = stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(1) + '%' : '0.0%';

            return (
              <div
                key={seq.id}
                onClick={() => setIsBuilding(true)}
                className="glass-panel glass-panel-hover p-6 rounded-3xl border border-white/10 space-y-4 relative cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold mb-2 ${
                        seq.status === 'active'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'
                          : 'bg-sky-950/60 text-sky-300 border border-sky-500/20'
                      }`}
                    >
                      {seq.status === 'active' ? <Play className="w-3 h-3 fill-emerald-400" /> : <Pause className="w-3 h-3 fill-sky-400" />}
                      <span className="capitalize">{seq.status}</span>
                    </span>
                    <h3 className="text-lg font-bold text-white font-display leading-tight group-hover:text-mustard-400 transition-colors">
                      {seq.name}
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5 text-xs">
                  <div className="bg-white/5 p-2.5 rounded-xl">
                    <p className="text-dark-muted text-[10px]">Open Rate</p>
                    <p className="text-base font-bold text-white font-display">{openRate}</p>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-xl">
                    <p className="text-dark-muted text-[10px]">Reply Rate</p>
                    <p className="text-base font-bold text-mustard-400 font-display">{replyRate}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-dark-muted pt-2 border-t border-white/5">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {stats.enrolled} Enrolled
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {(seq.steps || []).length} Steps
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
