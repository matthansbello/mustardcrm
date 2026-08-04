'use client';

import React, { useState, useEffect } from 'react';
import { SequenceStep, Contact } from '@/types';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { getContacts } from '@/lib/services/contacts';
import { createAndLaunchSequence } from '@/lib/services/sequences';
import { Send, Plus, AlertTriangle } from 'lucide-react';

interface SequenceBuilderProps {
  onLaunch?: () => void;
}

export const SequenceBuilder: React.FC<SequenceBuilderProps> = ({ onLaunch }) => {
  const { user, organization } = useAuthStore();

  const [sequenceName, setSequenceName] = useState('New Executive Outreach Sequence');
  const [activeTab, setActiveTab] = useState<'timeline' | 'settings' | 'preview'>('timeline');
  const [enrolledContacts, setEnrolledContacts] = useState<Contact[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadContacts() {
      if (organization?.id) {
        const contacts = await getContacts(organization.id);
        setEnrolledContacts(contacts);
        if (contacts.length > 0) {
          setSelectedPreviewContact(contacts[0]);
        }
      }
    }
    loadContacts();
  }, [organization?.id]);

  const [steps, setSteps] = useState<SequenceStep[]>([
    {
      id: 'step-1',
      stepNumber: 1,
      dayDelay: 0,
      subject: 'Quick question regarding {{company}} outreach',
      body: 'Hi {{first_name}},\n\nI noticed {{company}} is scaling outreach. How are you handling deliverability for your team?\n\nBest,\n' + (user?.displayName || 'Alex'),
      branchOnReply: true,
    },
    {
      id: 'step-2',
      stepNumber: 2,
      dayDelay: 3,
      subject: 'Re: Quick question regarding {{company}} outreach',
      body: 'Hi {{first_name}},\n\nFollowing up on my previous message. Would love to share how we help teams boost reply rates by 3x.\n\nBest,\n' + (user?.displayName || 'Alex'),
      branchOnReply: true,
    },
  ]);

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [selectedPreviewContact, setSelectedPreviewContact] = useState<Contact | null>(null);

  // Token Validation Guard: Check if enrolled contacts are missing required tokens
  const activeStep = steps[activeStepIndex] || steps[0];
  const requiredTokens: string[] = [];
  if (activeStep.body.includes('{{company}}') || activeStep.subject.includes('{{company}}')) requiredTokens.push('companyName');
  if (activeStep.body.includes('{{first_name}}') || activeStep.subject.includes('{{first_name}}')) requiredTokens.push('firstName');

  const contactsMissingTokens = enrolledContacts.filter((c) =>
    requiredTokens.some((token) => !c[token as keyof Contact])
  );

  const isLaunchBlocked = enrolledContacts.length > 0 && contactsMissingTokens.length > 0;

  const insertToken = (token: string) => {
    const current = steps[activeStepIndex];
    const updated = { ...current, body: current.body + ` {{${token}}}` };
    setSteps(steps.map((s, idx) => (idx === activeStepIndex ? updated : s)));
  };

  const addStep = () => {
    const newStep: SequenceStep = {
      id: `step-${steps.length + 1}`,
      stepNumber: steps.length + 1,
      dayDelay: 3,
      subject: `Re: ${steps[0].subject}`,
      body: 'Hi {{first_name}},\n\nJust bringing this back to the top of your inbox.\n\nBest,\n' + (user?.displayName || 'Alex'),
      branchOnReply: true,
    };
    setSteps([...steps, newStep]);
    setActiveStepIndex(steps.length);
  };

  const renderPreviewText = (text: string, contact: Contact | null) => {
    if (!contact) return text;
    return text
      .replace(/{{first_name}}/g, contact.firstName || '[First Name]')
      .replace(/{{company}}/g, contact.companyName || '[Company Name]')
      .replace(/{{title}}/g, contact.title || '[Job Title]');
  };

  const handleSaveAndLaunch = async () => {
    if (!organization?.id || !user?.id || isSaving || isLaunchBlocked) return;
    if (enrolledContacts.length === 0) {
      alert('Add contacts before launching a sequence.');
      return;
    }
    if (user.inboxStatus !== 'connected') {
      alert('Connect your Gmail inbox before launching a sequence.');
      return;
    }
    setIsSaving(true);
    try {
      await createAndLaunchSequence(organization.id, {
        name: sequenceName,
        steps,
        createdBy: user.id,
        senderUserId: user.id,
        contacts: enrolledContacts,
      });
      onLaunch?.();
    } catch (err) {
      console.error('Failed to launch sequence:', err);
      alert(err instanceof Error ? err.message : 'Failed to launch sequence');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sequence Builder Title Bar */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-mustard-400 uppercase tracking-wider">Sequence Builder</span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-gray-300">Draft</span>
          </div>
          <input
            type="text"
            value={sequenceName}
            onChange={(e) => setSequenceName(e.target.value)}
            className="bg-transparent text-xl font-bold font-display text-white border-b border-transparent hover:border-white/20 focus:border-mustard-500 focus:outline-none py-0.5"
          />
        </div>

        {/* Action Tabs & Launch Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'timeline' ? 'bg-blue-500 text-white font-semibold shadow-glow-mustard' : 'text-gray-400 hover:text-white'}`}
            >
              Timeline Steps ({steps.length})
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'preview' ? 'bg-blue-500 text-white font-semibold shadow-glow-mustard' : 'text-gray-400 hover:text-white'}`}
            >
              Live Preview
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-blue-500 text-white font-semibold shadow-glow-mustard' : 'text-gray-400 hover:text-white'}`}
            >
              Settings
            </button>
          </div>

          <button
            onClick={handleSaveAndLaunch}
            disabled={isLaunchBlocked || isSaving}
            className="btn-mustard px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save & Launch Sequence'}</span>
          </button>
        </div>
      </div>

      {/* Token Validation Guard Blocking Warning Banner */}
      {isLaunchBlocked && (
        <div className="p-4 rounded-2xl bg-sky-950/70 border border-sky-500/40 text-sky-200 text-xs flex items-center justify-between gap-4 shadow-glow-mustard">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-sky-300 shrink-0 animate-pulse" />
            <div>
              <p className="font-bold text-sky-100">Token Guard Warning: Launch Blocked</p>
              <p className="text-[11px] text-sky-200/80">
                {contactsMissingTokens.length} enrolled contact ({contactsMissingTokens.map((c) => c.email).join(', ')}) is missing the required `{"{{company}}"}` token. Please update contact details to unblock launch.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Editor Mode */}
      {activeTab === 'timeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Step Timeline Sidebar */}
          <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Sequence Timeline</h4>

            <div className="space-y-4 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-white/10">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`relative pl-9 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    activeStepIndex === idx
                      ? 'bg-mustard-500/10 border-mustard-500/50 shadow-glow-mustard/20'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`absolute left-2 top-4 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeStepIndex === idx ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'
                  }`}>
                    {step.stepNumber}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Step {step.stepNumber}</span>
                    <span className="text-[10px] text-dark-muted font-mono">
                      {step.dayDelay === 0 ? 'Day 0 (Immediate)' : `Day +${step.dayDelay}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-dark-muted truncate mt-1">{step.subject}</p>
                </div>
              ))}

              <button
                onClick={addStep}
                className="w-full py-2.5 rounded-xl border border-dashed border-white/20 hover:border-mustard-500 text-xs font-medium text-gray-400 hover:text-mustard-400 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Sequence Step</span>
              </button>
            </div>
          </div>

          {/* Template Body Editor & Chips */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-sm font-bold text-white">Editing Step {activeStep.stepNumber}</h4>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-dark-muted">Delay:</span>
                <input
                  type="number"
                  value={activeStep.dayDelay}
                  onChange={(e) => {
                    const updated = { ...activeStep, dayDelay: parseInt(e.target.value) || 0 };
                    setSteps(steps.map((s, idx) => (idx === activeStepIndex ? updated : s)));
                  }}
                  className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-mustard-500"
                />
                <span className="text-dark-muted">Days</span>
              </div>
            </div>

            {/* Token Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-dark-muted font-medium">Insert Token:</span>
              {['first_name', 'company', 'title'].map((token) => (
                <button
                  key={token}
                  onClick={() => insertToken(token)}
                  className="px-2.5 py-1 rounded-lg bg-mustard-500/10 hover:bg-mustard-500/20 text-mustard-400 border border-mustard-500/30 text-[11px] font-mono transition-colors"
                >
                  +{`{{${token}}}`}
                </button>
              ))}
            </div>

            {/* Subject Input */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300">Subject Line</label>
              <input
                type="text"
                value={activeStep.subject}
                onChange={(e) => {
                  const updated = { ...activeStep, subject: e.target.value };
                  setSteps(steps.map((s, idx) => (idx === activeStepIndex ? updated : s)));
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-mustard-500"
              />
            </div>

            {/* Body Area */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300">Email Body HTML / Plain</label>
              <textarea
                rows={10}
                value={activeStep.body}
                onChange={(e) => {
                  const updated = { ...activeStep, body: e.target.value };
                  setSteps(steps.map((s, idx) => (idx === activeStepIndex ? updated : s)));
                }}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white font-sans leading-relaxed focus:outline-none focus:border-mustard-500 resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Mode */}
      {activeTab === 'preview' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h4 className="text-sm font-bold text-white">Live Prospect Rendering Preview</h4>
              <p className="text-xs text-dark-muted">Test how token substitution renders for enrolled contacts.</p>
            </div>

            {enrolledContacts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-dark-muted">Preview Contact:</span>
                <select
                  onChange={(e) => {
                    const selected = enrolledContacts.find((c) => c.id === e.target.value);
                    if (selected) setSelectedPreviewContact(selected);
                  }}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  {enrolledContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Rendered Email Preview Box */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 text-xs">
            <div className="border-b border-white/10 pb-3 space-y-1">
              <p className="text-dark-muted">
                To: <span className="text-white font-mono">{selectedPreviewContact?.email || 'prospect@company.com'}</span>
              </p>
              <p className="text-dark-muted">
                Subject:{' '}
                <span className="text-white font-semibold">
                  {renderPreviewText(activeStep.subject, selectedPreviewContact)}
                </span>
              </p>
            </div>

            <div className="whitespace-pre-wrap leading-relaxed text-gray-200 font-sans">
              {renderPreviewText(activeStep.body, selectedPreviewContact)}
            </div>
          </div>
        </div>
      )}

      {/* Settings Mode */}
      {activeTab === 'settings' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-6 max-w-2xl">
          <h4 className="text-sm font-bold text-white border-b border-white/10 pb-3">Sequence Throttle & Window Settings</h4>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Daily Send Cap Per Mailbox</label>
              <input
                type="number"
                defaultValue={40}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-mustard-500"
              />
              <p className="text-[10px] text-dark-muted">Deliverability safety cap to prevent spam flags.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Sending Window</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none">
                <option>9:00 AM – 5:00 PM (Recipient Timezone)</option>
                <option>8:00 AM – 6:00 PM (Sender Timezone)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
