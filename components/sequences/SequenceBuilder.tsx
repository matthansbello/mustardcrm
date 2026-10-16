'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CircleAlert, Plus, Rocket, Trash2, Clock } from 'lucide-react';
import { SequenceStep, Contact, ContactLifecycleStage } from '@/types';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { getContacts } from '@/lib/services/contacts';
import { createAndLaunchSequence } from '@/lib/services/sequences';

interface SequenceBuilderProps {
  onLaunch?: () => void;
  onCancel?: () => void;
}

/** Tokens the sender actually substitutes (see lib/email/sender.ts). */
const TOKENS: { token: string; label: string; field: keyof Contact }[] = [
  { token: 'first_name', label: 'First name', field: 'firstName' },
  { token: 'last_name', label: 'Last name', field: 'lastName' },
  { token: 'company', label: 'Company', field: 'companyName' },
  { token: 'title', label: 'Job title', field: 'title' },
];

const STAGES: ContactLifecycleStage[] = ['lead', 'contacted', 'replied', 'opportunity', 'customer'];

type Tab = 'steps' | 'audience' | 'preview';

function render(text: string, c: Contact | null): string {
  if (!c) return text;
  return text
    .replace(/{{first_name}}/gi, c.firstName || '')
    .replace(/{{last_name}}/gi, c.lastName || '')
    .replace(/{{company}}/gi, c.companyName || '')
    .replace(/{{title}}/gi, c.title || '');
}

export const SequenceBuilder: React.FC<SequenceBuilderProps> = ({ onLaunch, onCancel }) => {
  const { user, organization, inboxStatus } = useAuthStore();
  const signature = user?.displayName?.split(' ')[0] || 'Alex';

  const [name, setName] = useState('Untitled sequence');
  const [tab, setTab] = useState<Tab>('steps');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [audience, setAudience] = useState<{ mode: 'all' | 'tag' | 'stage'; value: string }>({ mode: 'all', value: '' });
  const [skipIncomplete, setSkipIncomplete] = useState(false);
  const [dailyCap, setDailyCap] = useState(organization?.settings?.defaultDailyCapPerMailbox || 40);
  const [sendWindow, setSendWindow] = useState('9-17');
  const [previewId, setPreviewId] = useState<string>('');

  const [steps, setSteps] = useState<SequenceStep[]>([
    {
      id: 'step-1',
      stepNumber: 1,
      dayDelay: 0,
      subject: 'Quick question about {{company}}',
      body: `Hi {{first_name}},\n\nI noticed {{company}} is growing its sales team. How are you handling outreach today?\n\nBest,\n${signature}`,
      branchOnReply: true,
    },
    {
      id: 'step-2',
      stepNumber: 2,
      dayDelay: 3,
      subject: 'Re: Quick question about {{company}}',
      body: `Hi {{first_name}},\n\nJust following up on my note below — would a short call next week be useful?\n\nBest,\n${signature}`,
      branchOnReply: true,
    },
  ]);
  const [activeIndex, setActiveIndex] = useState(0);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastFocused = useRef<'subject' | 'body'>('body');

  useEffect(() => {
    if (!organization?.id) return;
    getContacts(organization.id).then((data) => {
      setContacts(data);
      setContactsLoaded(true);
    });
  }, [organization?.id]);

  const allTags = useMemo(
    () => Array.from(new Set(contacts.flatMap((c) => c.tags || []))).sort((a, b) => a.localeCompare(b)),
    [contacts]
  );

  const audienceContacts = useMemo(() => {
    if (audience.mode === 'tag' && audience.value) return contacts.filter((c) => (c.tags || []).includes(audience.value));
    if (audience.mode === 'stage' && audience.value) return contacts.filter((c) => c.lifecycleStage === audience.value);
    return contacts.filter((c) => c.lifecycleStage !== 'unsubscribed' && c.lifecycleStage !== 'bounced');
  }, [contacts, audience]);

  // Every token used in any step must be filled for every recipient.
  const usedTokens = TOKENS.filter(({ token }) =>
    steps.some((s) => new RegExp(`{{${token}}}`, 'i').test(`${s.subject} ${s.body}`))
  );
  const incomplete = audienceContacts.filter((c) => usedTokens.some(({ field }) => !String(c[field] || '').trim()));
  const recipients = skipIncomplete ? audienceContacts.filter((c) => !incomplete.includes(c)) : audienceContacts;
  const blockedByTokens = incomplete.length > 0 && !skipIncomplete;

  const active = steps[activeIndex] || steps[0];
  const previewContact = recipients.find((c) => c.id === previewId) || recipients[0] || null;

  const updateStep = (patch: Partial<SequenceStep>) =>
    setSteps((prev) => prev.map((s, i) => (i === activeIndex ? { ...s, ...patch } : s)));

  const insertToken = (token: string) => {
    const text = `{{${token}}}`;
    const target = lastFocused.current === 'subject' ? subjectRef.current : bodyRef.current;
    const key = lastFocused.current === 'subject' ? 'subject' : 'body';
    const current = active[key];
    const start = target?.selectionStart ?? current.length;
    const end = target?.selectionEnd ?? current.length;
    updateStep({ [key]: current.slice(0, start) + text + current.slice(end) });
    requestAnimationFrame(() => {
      target?.focus();
      target?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        id: `step-${Date.now()}`,
        stepNumber: prev.length + 1,
        dayDelay: 3,
        subject: `Re: ${prev[0]?.subject || ''}`,
        body: `Hi {{first_name}},\n\nBumping this to the top of your inbox.\n\nBest,\n${signature}`,
        branchOnReply: true,
      },
    ]);
    setActiveIndex(steps.length);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepNumber: i + 1 })));
    setActiveIndex((i) => Math.max(0, i >= index ? i - 1 : i));
  };

  const launchProblem = !contactsLoaded
    ? 'Loading contacts…'
    : inboxStatus !== 'connected'
      ? 'Connect your Gmail inbox before launching.'
      : recipients.length === 0
        ? 'No contacts match this audience.'
        : blockedByTokens
          ? `${incomplete.length} recipient${incomplete.length === 1 ? ' is' : 's are'} missing data used in your emails.`
          : steps.some((s) => !s.subject.trim() || !s.body.trim())
            ? 'Every step needs a subject and a message.'
            : null;

  const handleLaunch = async () => {
    if (!organization?.id || !user?.id || isSaving || launchProblem) return;
    setIsSaving(true);
    setError(null);
    const [startHour, endHour] = sendWindow.split('-').map(Number);
    try {
      await createAndLaunchSequence(organization.id, {
        name: name.trim() || 'Untitled sequence',
        steps,
        createdBy: user.id,
        senderUserId: user.id,
        contacts: recipients,
        settings: {
          dailyCapPerMailbox: dailyCap,
          sendingWindow: {
            startHour,
            endHour,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
          },
        },
      });
      onLaunch?.();
    } catch (err) {
      console.error('Failed to launch sequence:', err);
      setError(err instanceof Error ? err.message : 'Failed to launch sequence');
    } finally {
      setIsSaving(false);
    }
  };

  let elapsed = 0;

  return (
    <div className="space-y-5">
      {/* Title bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2 lg:flex-1">
          {onCancel && (
            <button onClick={onCancel} className="btn btn-ghost btn-icon btn-sm shrink-0" aria-label="Back to sequences">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          {/* Invisible copy of the text sizes the input to fit its content. */}
          <div className="inline-grid min-w-0 max-w-full overflow-hidden">
            <span
              aria-hidden="true"
              className="invisible col-start-1 row-start-1 whitespace-pre border border-transparent px-1.5 py-0.5 font-display text-2xl font-semibold"
            >
              {name || ' '}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Sequence name"
              size={1}
              className="col-start-1 row-start-1 w-full min-w-[4ch] rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-display text-2xl font-semibold text-fg hover:border-line focus:border-accent focus:outline-none"
            />
          </div>
          <span className="badge badge-neutral shrink-0">Draft</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="segmented grid min-w-0 flex-1 grid-cols-3 lg:flex lg:flex-none" role="tablist">
            {(
              [
                ['steps', 'Steps', steps.length],
                ['audience', 'Audience', recipients.length],
                ['preview', 'Preview', null],
              ] as [Tab, string, number | null][]
            ).map(([key, label, count]) => (
              <button key={key} role="tab" aria-pressed={tab === key} onClick={() => setTab(key)}>
                {label}
                {count !== null && <span className="hidden tabular-nums text-fg-subtle sm:inline">{count}</span>}
              </button>
            ))}
          </div>
          <button
            onClick={handleLaunch}
            disabled={!!launchProblem || isSaving}
            title={launchProblem || undefined}
            className="btn btn-primary"
          >
            <Rocket className="h-4 w-4" />
            {isSaving ? 'Launching…' : 'Launch'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {launchProblem && contactsLoaded && (
        <div className={`alert ${blockedByTokens ? 'alert-warning' : 'alert-info'} items-center`}>
          <CircleAlert className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {launchProblem}
            {blockedByTokens && (
              <span className="text-amber-200/80">
                {' '}
                ({usedTokens.map((t) => t.label.toLowerCase()).join(', ')}) —{' '}
                {incomplete
                  .slice(0, 3)
                  .map((c) => c.email)
                  .join(', ')}
                {incomplete.length > 3 ? ` and ${incomplete.length - 3} more` : ''}
              </span>
            )}
          </span>
          {blockedByTokens && (
            <button onClick={() => setSkipIncomplete(true)} className="btn btn-secondary btn-sm shrink-0">
              Skip them
            </button>
          )}
        </div>
      )}

      {tab === 'steps' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          {/* Step list */}
          <div className="space-y-2">
            {steps.map((step, idx) => {
              elapsed += step.dayDelay;
              const isActive = idx === activeIndex;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveIndex(idx)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    isActive ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-fg">Step {step.stepNumber}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
                      <Clock className="h-3 w-3" />
                      {idx === 0 ? 'Immediately' : `Day ${elapsed}`}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-fg-muted">{step.subject || 'No subject'}</p>
                </button>
              );
            })}
            <button onClick={addStep} className="btn btn-secondary w-full border-dashed">
              <Plus className="h-4 w-4" />
              Add follow-up
            </button>
          </div>

          {/* Editor */}
          <section className="card">
            <div className="card-header flex-wrap">
              <h2 className="card-title">Step {active.stepNumber}</h2>
              <div className="flex flex-wrap items-center gap-2">
                {activeIndex > 0 && (
                  <label className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                    Send
                    <input
                      type="number"
                      min={1}
                      value={active.dayDelay}
                      onChange={(e) => updateStep({ dayDelay: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="input h-8 w-16 text-center"
                    />
                    days after previous step
                  </label>
                )}
                {steps.length > 1 && (
                  <button
                    onClick={() => removeStep(activeIndex)}
                    className="btn btn-ghost btn-icon btn-sm"
                    aria-label={`Delete step ${active.stepNumber}`}
                    title="Delete step"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <label htmlFor="step-subject" className="label">
                  Subject
                </label>
                <input
                  id="step-subject"
                  ref={subjectRef}
                  value={active.subject}
                  onFocus={() => (lastFocused.current = 'subject')}
                  onChange={(e) => updateStep({ subject: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="step-body" className="label mb-0">
                    Message
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-xs text-fg-subtle">Insert</span>
                    {TOKENS.map((t) => (
                      <button
                        key={t.token}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertToken(t.token)}
                        className="badge badge-neutral h-6 cursor-pointer px-2 hover:border-line-strong hover:text-fg"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  id="step-body"
                  ref={bodyRef}
                  rows={12}
                  value={active.body}
                  onFocus={() => (lastFocused.current = 'body')}
                  onChange={(e) => updateStep({ body: e.target.value })}
                  className="input resize-y"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={active.branchOnReply}
                  onChange={(e) => updateStep({ branchOnReply: e.target.checked })}
                  className="h-4 w-4 rounded border-line bg-canvas accent-[#3b82f6]"
                />
                Stop the sequence for anyone who replies
              </label>
            </div>
          </section>
        </div>
      )}

      {tab === 'audience' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Who gets this sequence</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className="segmented max-w-full overflow-x-auto">
                {(
                  [
                    ['all', 'All contacts'],
                    ['tag', 'By tag'],
                    ['stage', 'By stage'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    aria-pressed={audience.mode === mode}
                    onClick={() => setAudience({ mode, value: '' })}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {audience.mode === 'tag' && (
                <select
                  value={audience.value}
                  onChange={(e) => setAudience({ mode: 'tag', value: e.target.value })}
                  className="input"
                  aria-label="Tag"
                >
                  <option value="">Choose a tag…</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
              {audience.mode === 'stage' && (
                <select
                  value={audience.value}
                  onChange={(e) => setAudience({ mode: 'stage', value: e.target.value })}
                  className="input"
                  aria-label="Stage"
                >
                  <option value="">Choose a stage…</option>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              )}

              <p className="text-sm text-fg-muted">
                <span className="font-semibold text-fg">{recipients.length.toLocaleString()}</span> contacts will be
                enrolled
                {audience.mode === 'all' && ' (unsubscribed and bounced contacts are excluded)'}.
              </p>
              {incomplete.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={skipIncomplete}
                    onChange={(e) => setSkipIncomplete(e.target.checked)}
                    className="h-4 w-4 accent-[#3b82f6]"
                  />
                  Skip {incomplete.length} contact{incomplete.length === 1 ? '' : 's'} missing personalisation data
                </label>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Sending limits</h2>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label htmlFor="seq-cap" className="label">
                  Daily limit per mailbox
                </label>
                <input
                  id="seq-cap"
                  type="number"
                  min={1}
                  max={500}
                  value={dailyCap}
                  onChange={(e) => setDailyCap(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input"
                />
                <p className="hint">30–50 per day keeps a new mailbox out of spam folders.</p>
              </div>
              <div>
                <label htmlFor="seq-window" className="label">
                  Sending hours
                </label>
                <select id="seq-window" value={sendWindow} onChange={(e) => setSendWindow(e.target.value)} className="input">
                  <option value="9-17">9 am – 5 pm</option>
                  <option value="8-18">8 am – 6 pm</option>
                  <option value="7-20">7 am – 8 pm</option>
                </select>
                <p className="hint">In your time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'preview' && (
        <section className="card">
          <div className="card-header flex-wrap">
            <h2 className="card-title">Preview step {active.stepNumber}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activeIndex}
                onChange={(e) => setActiveIndex(Number(e.target.value))}
                className="input h-8 w-28"
                aria-label="Step"
              >
                {steps.map((s, i) => (
                  <option key={s.id} value={i}>
                    Step {s.stepNumber}
                  </option>
                ))}
              </select>
              {recipients.length > 0 && (
                <select
                  value={previewContact?.id || ''}
                  onChange={(e) => setPreviewId(e.target.value)}
                  className="input w-full sm:h-8 sm:w-64"
                  aria-label="Preview as contact"
                >
                  {recipients.slice(0, 200).map((c) => (
                    <option key={c.id} value={c.id}>
                      {`${c.firstName} ${c.lastName}`.trim()} — {c.email}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="p-3 sm:p-5">
            <div className="mx-auto max-w-2xl rounded-lg border border-line bg-canvas">
              <dl className="space-y-1 border-b border-line px-4 py-3 text-sm sm:px-5 [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere] [&_dt]:shrink-0">
                <div className="flex gap-2">
                  <dt className="w-16 text-fg-subtle">From</dt>
                  <dd className="text-fg">{user?.email}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 text-fg-subtle">To</dt>
                  <dd className="text-fg">{previewContact?.email || 'prospect@company.com'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 text-fg-subtle">Subject</dt>
                  <dd className="font-medium text-fg">{render(active.subject, previewContact)}</dd>
                </div>
              </dl>
              <div className="whitespace-pre-wrap break-words px-4 py-4 text-sm leading-relaxed text-fg sm:px-5">
                {render(active.body, previewContact)}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
