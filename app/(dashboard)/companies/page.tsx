'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CircleAlert, ExternalLink, Plus, Search } from 'lucide-react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Company } from '@/types';
import { getCompanies, createCompany } from '@/lib/services/companies';
import { getContacts } from '@/lib/services/contacts';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';

const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];
const EMPTY = { name: '', domain: '', industry: '', size: '' };

function cleanDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

export default function CompaniesPage() {
  const containerRef = useGsapReveal<HTMLDivElement>();
  const { organization } = useAuthStore();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [contactCounts, setContactCounts] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization?.id) return;
    setIsLoading(true);
    Promise.all([getCompanies(organization.id), getContacts(organization.id)]).then(([comps, contacts]) => {
      // Contacts reference companies by name; count them so the column is meaningful.
      const counts = new Map<string, number>();
      contacts.forEach((c) => {
        const key = (c.companyName || '').trim().toLowerCase();
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
      });
      setCompanies(comps.sort((a, b) => a.name.localeCompare(b.name)));
      setContactCounts(counts);
      setIsLoading(false);
    });
  }, [organization?.id]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter((c) =>
      [c.name, c.domain, c.industry].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))
    );
  }, [companies, search]);

  const closeModal = () => {
    setIsAddOpen(false);
    setError(null);
    setForm(EMPTY);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !organization?.id) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createCompany(organization.id, {
        name: form.name.trim(),
        domain: cleanDomain(form.domain) || undefined,
        industry: form.industry.trim() || undefined,
        size: form.size || undefined,
        contactIds: [],
      });
      setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save company.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <PageHeader
        title="Companies"
        description="Accounts you’re selling to. Contacts are linked by company name."
        actions={
          <button onClick={() => setIsAddOpen(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Add company
          </button>
        }
      />

      <section className="card overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-16 text-center text-sm text-fg-muted">Loading companies…</p>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No companies yet"
            description="Add the accounts you’re targeting to see how many of their people are in your contacts."
            action={
              <button onClick={() => setIsAddOpen(true)} className="btn btn-primary">
                <Plus className="h-4 w-4" />
                Add company
              </button>
            }
          />
        ) : (
          <>
            <div className="border-b border-line p-3">
              <div className="relative sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search companies…"
                  aria-label="Search companies"
                  className="input h-8 pl-9"
                />
              </div>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {visible.map((comp) => (
                <li key={comp.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-xs font-semibold text-fg-muted">
                    {comp.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{comp.name}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {[comp.industry, comp.size && `${comp.size} employees`, comp.domain].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums text-fg">
                      {contactCounts.get(comp.name.trim().toLowerCase()) || 0}
                    </p>
                    <p className="text-[11px] text-fg-subtle">contacts</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Industry</th>
                    <th>Size</th>
                    <th className="text-right">Contacts</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((comp) => {
                    const count = contactCounts.get(comp.name.trim().toLowerCase()) || 0;
                    return (
                      <tr key={comp.id} className="hover:bg-surface-2">
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-xs font-semibold text-fg-muted">
                              {comp.name.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-fg">{comp.name}</p>
                              {comp.domain && (
                                <a
                                  href={`https://${comp.domain}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-accent-fg"
                                >
                                  {comp.domain}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-fg-muted">{comp.industry || '—'}</td>
                        <td className="text-fg-muted">{comp.size ? `${comp.size} employees` : '—'}</td>
                        <td className="text-right tabular-nums text-fg">{count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              {visible.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-fg-muted">No companies match “{search}”.</p>
              )}
            </div>
          </>
        )}
      </section>

      <Modal
        isOpen={isAddOpen}
        onClose={closeModal}
        locked={saving}
        title="Add company"
        footer={
          <>
            <button type="button" onClick={closeModal} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="add-company-form" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : 'Save company'}
            </button>
          </>
        }
      >
        {error && (
          <div className="alert alert-error mb-4">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <form id="add-company-form" onSubmit={handleAdd} className="space-y-4">
          <div>
            <label htmlFor="co-name" className="label">
              Company name <span className="text-rose-400">*</span>
            </label>
            <input
              id="co-name"
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Acme Inc."
              className="input"
            />
          </div>
          <div>
            <label htmlFor="co-domain" className="label">
              Website
            </label>
            <input
              id="co-domain"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              placeholder="acme.com"
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="co-industry" className="label">
                Industry
              </label>
              <input
                id="co-industry"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                placeholder="Software"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="co-size" className="label">
                Employees
              </label>
              <select
                id="co-size"
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="input"
              >
                <option value="">Unknown</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
