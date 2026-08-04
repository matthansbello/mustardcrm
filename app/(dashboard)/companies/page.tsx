'use client';

import React, { useState, useEffect } from 'react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Company } from '@/types';
import { getCompanies, createCompany } from '@/lib/services/companies';
import { Building2, Plus, ExternalLink, X } from 'lucide-react';

export default function CompaniesPage() {
  const containerRef = useGsapReveal<HTMLDivElement>({
    stagger: 0.1,
    yOffset: 48,
    scaleFrom: 0.9,
    blurFrom: 10,
  });
  const { organization } = useAuthStore();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newCompany, setNewCompany] = useState({
    name: '',
    domain: '',
    industry: '',
    size: '10-50',
  });

  const fetchCompanies = async () => {
    if (!organization?.id) return;
    setIsLoading(true);
    const data = await getCompanies(organization.id);
    setCompanies(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, [organization?.id]);

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.name || !organization?.id) return;

    try {
      const created = await createCompany(organization.id, {
        name: newCompany.name,
        domain: newCompany.domain || undefined,
        industry: newCompany.industry || undefined,
        size: newCompany.size || undefined,
        contactIds: [],
      });

      setCompanies((prev) => [created, ...prev]);
      setNewCompany({ name: '', domain: '', industry: '', size: '10-50' });
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to create company:', err);
    }
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Companies</h1>
          <p className="text-xs text-dark-muted">Track target accounts and linked contact decision-makers.</p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-mustard px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Add Company</span>
        </button>
      </div>

      {isLoading ? (
        <div className="glass-panel p-12 rounded-2xl border border-white/10 text-center text-xs text-dark-muted">
          Loading companies...
        </div>
      ) : companies.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl border border-white/10 text-center space-y-3">
          <Building2 className="w-10 h-10 text-gray-600 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-white">No target companies yet</h3>
            <p className="text-xs text-dark-muted mt-1 max-w-sm mx-auto">
              Add company accounts to organize contacts by organization and industry.
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-mustard px-4 py-2 rounded-xl text-xs font-semibold"
          >
            Add First Company
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {companies.map((comp) => (
            <div key={comp.id} className="glass-panel glass-panel-hover p-5 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-300 font-bold font-display text-sm">
                  {comp.name.slice(0, 2).toUpperCase()}
                </div>
                {comp.domain && (
                  <a href={`https://${comp.domain}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white p-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <div>
                <h3 className="text-base font-bold text-white font-display">{comp.name}</h3>
                {comp.domain && <p className="text-[11px] text-dark-muted font-mono">{comp.domain}</p>}
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-dark-muted">
                <span>{comp.industry || 'General'}</span>
                <span className="text-mustard-400 font-medium">{(comp.contactIds || []).length} Contacts</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Company Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-white/10 space-y-6 relative">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute right-4 top-4 text-gray-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-300">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-display text-white">Add Target Company</h3>
                <p className="text-xs text-dark-muted">Create a company account record</p>
              </div>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Company Name *</label>
                <input
                  type="text"
                  required
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  placeholder="Acme Corp"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-mustard-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Domain Website</label>
                <input
                  type="text"
                  value={newCompany.domain}
                  onChange={(e) => setNewCompany({ ...newCompany, domain: e.target.value })}
                  placeholder="acme.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-mustard-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300">Industry</label>
                  <input
                    type="text"
                    value={newCompany.industry}
                    onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                    placeholder="SaaS / Software"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-mustard-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300">Company Size</label>
                  <select
                    value={newCompany.size}
                    onChange={(e) => setNewCompany({ ...newCompany, size: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-mustard-500"
                  >
                    <option value="1-10">1-10 employees</option>
                    <option value="10-50">10-50 employees</option>
                    <option value="50-200">50-200 employees</option>
                    <option value="200-500">200-500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="glass-button px-4 py-2 rounded-xl text-xs font-medium text-gray-300"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-mustard px-5 py-2 rounded-xl text-xs font-semibold">
                  Save Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
