'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useMagnetic } from '@/lib/hooks/useMagnetic';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import {
  Zap,
  Mail,
  Users,
  ArrowRight,
  ShieldCheck,
  BarChart3,
  Sparkles,
  Layers,
  Lock,
  Cpu,
} from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function LandingPage() {
  const heroRef = useGsapReveal<HTMLDivElement>({
    stagger: 0.14,
    yOffset: 72,
    scaleFrom: 0.85,
    blurFrom: 18,
    rotateFrom: 2,
  });
  const featureRef = useGsapReveal<HTMLDivElement>({
    stagger: 0.12,
    yOffset: 48,
    selector: '.feature-card',
    scaleFrom: 0.9,
    blurFrom: 10,
  });
  const prefersReducedMotion = useReducedMotion();
  const ctaRef = useMagnetic<HTMLAnchorElement>(0.4);
  const logoRef = useMagnetic<HTMLDivElement>(0.25);
  const orb1 = useRef<HTMLDivElement>(null);
  const orb2 = useRef<HTMLDivElement>(null);
  const orb3 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion || typeof window === 'undefined') return;

    const ctx = gsap.context(() => {
      // Floating blue orbs
      if (orb1.current) {
        gsap.to(orb1.current, {
          x: 60,
          y: -40,
          scale: 1.15,
          duration: 6,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }
      if (orb2.current) {
        gsap.to(orb2.current, {
          x: -50,
          y: 50,
          scale: 0.9,
          duration: 8,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }
      if (orb3.current) {
        gsap.to(orb3.current, {
          x: 30,
          y: -70,
          duration: 7,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }

      // Aggressive ScrollTrigger storytelling
      gsap.from('.story-heading', {
        scrollTrigger: {
          trigger: '.story-section',
          start: 'top 85%',
        },
        opacity: 0,
        y: 50,
        scale: 0.92,
        filter: 'blur(10px)',
        duration: 1,
        ease: 'power4.out',
      });

      gsap.from('.story-card', {
        scrollTrigger: {
          trigger: '.story-section',
          start: 'top 75%',
        },
        opacity: 0,
        y: 80,
        rotateX: 12,
        scale: 0.88,
        filter: 'blur(12px)',
        stagger: 0.18,
        duration: 1.05,
        ease: 'power4.out',
        clearProps: 'filter,transform',
      });

      // Feature cards hover punch
      gsap.utils.toArray<HTMLElement>('.feature-card').forEach((card) => {
        card.addEventListener('mouseenter', () => {
          gsap.to(card, {
            y: -8,
            scale: 1.03,
            duration: 0.35,
            ease: 'power3.out',
          });
        });
        card.addEventListener('mouseleave', () => {
          gsap.to(card, {
            y: 0,
            scale: 1,
            duration: 0.5,
            ease: 'elastic.out(1, 0.5)',
          });
        });
      });
    });

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  return (
    <div className="min-h-screen bg-dark-bg relative overflow-hidden flex flex-col justify-between">
      {/* Aggressive blue ambient orbs */}
      <div
        ref={orb1}
        className="blue-orb w-[520px] h-[520px] top-[-120px] left-[10%] bg-blue-500/25"
      />
      <div
        ref={orb2}
        className="blue-orb w-[420px] h-[420px] top-[40%] right-[-80px] bg-cyan-400/15"
      />
      <div
        ref={orb3}
        className="blue-orb w-[380px] h-[380px] bottom-[-60px] left-[30%] bg-indigo-500/20"
      />

      <nav className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between z-10">
        <div ref={logoRef} className="flex items-center gap-3 cursor-default">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 via-blue-500 to-cyan-400 flex items-center justify-center shadow-glow-blue">
            <Zap className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">Mustard</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-xs font-medium text-gray-300 hover:text-white transition-colors px-3 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="btn-mustard px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 pt-16 pb-24 text-center z-10 my-auto">
        <div ref={heroRef} className="space-y-6" data-gsap-reveal>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel border border-blue-400/20 text-xs font-medium text-blue-200 shadow-glow-mustard">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
            <span>Built natively for Google Workspace teams</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold font-display tracking-tight text-white leading-none">
            High-Octane CRM & <br />
            <span className="text-gradient-mustard">Cold Outreach Platform</span>
          </h1>

          <p className="text-lg md:text-xl text-dark-muted max-w-2xl mx-auto font-light leading-relaxed">
            Manage contacts, pipelines, and multi-step cold email sequences sent directly from your
            team&apos;s real Gmail accounts with zero deliverability friction.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              ref={ctaRef}
              href="/onboarding"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl btn-mustard text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span>Connect Workspace Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl glass-button text-sm font-medium text-white flex items-center justify-center gap-2"
            >
              <span>Explore Dashboard</span>
            </Link>
          </div>
        </div>

        <div ref={featureRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 text-left">
          <div className="feature-card glass-panel glass-panel-hover p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white font-display">Native Gmail Sending</h3>
            <p className="text-xs text-dark-muted leading-relaxed">
              Emails land natively in your rep&apos;s Sent box and recipient&apos;s thread via OAuth
              2.0. No third-party SMTP wrappers.
            </p>
          </div>

          <div className="feature-card glass-panel glass-panel-hover p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white font-display">Bulk Contact Import</h3>
            <p className="text-xs text-dark-muted leading-relaxed">
              Drag and drop CSV/XLSX files with auto column mapping, real-time email deduplication,
              and progress tracking.
            </p>
          </div>

          <div className="feature-card glass-panel glass-panel-hover p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white font-display">Smart Deal Kanban</h3>
            <p className="text-xs text-dark-muted leading-relaxed">
              Automated deal stage movements on prospect reply, GSAP drag reflow, and real-time
              open/click tracking.
            </p>
          </div>
        </div>

        <div className="story-section mt-24 text-left space-y-8 perspective-[1200px]">
          <div className="story-heading text-center space-y-2">
            <h2 className="text-3xl font-bold font-display text-white">
              Engineered for Maximum Deliverability
            </h2>
            <p className="text-xs text-dark-muted">
              Why Google Workspace teams scale faster with Mustard
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="story-card glass-panel p-6 rounded-2xl border border-blue-500/20 space-y-3">
              <Lock className="w-6 h-6 text-blue-400" />
              <h4 className="text-base font-bold text-white font-display">Server Token Isolation</h4>
              <p className="text-xs text-dark-muted">
                OAuth refresh tokens are encrypted with AES-256 and locked in server-only Firestore
                rules, keeping secrets untouchable by client SDKs.
              </p>
            </div>

            <div className="story-card glass-panel p-6 rounded-2xl border border-cyan-500/20 space-y-3">
              <Cpu className="w-6 h-6 text-cyan-400" />
              <h4 className="text-base font-bold text-white font-display">Idempotent Sending</h4>
              <p className="text-xs text-dark-muted">
                Every sequence send is protected by a unique attempt ID guard so network retries
                never double-send emails to your prospects.
              </p>
            </div>

            <div className="story-card glass-panel p-6 rounded-2xl border border-indigo-500/20 space-y-3">
              <Layers className="w-6 h-6 text-indigo-400" />
              <h4 className="text-base font-bold text-white font-display">Token Validation Guard</h4>
              <p className="text-xs text-dark-muted">
                Surfaces missing personalization tokens before launch to ensure your campaigns never
                send raw `{'{{token}}'}` tags to real leads.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-6 px-6 text-center text-xs text-dark-muted z-10 glass-panel !rounded-none !border-x-0 !border-b-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Google Workspace OAuth 2.0 Verified Architecture</span>
          </div>
          <p>© 2026 Mustard CRM. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
