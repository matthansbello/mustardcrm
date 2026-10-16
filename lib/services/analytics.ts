import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Deal, Sequence, User, OrgStatsSummary } from '@/types';

export interface DashboardKpis {
  emailsSent: number;
  openRate: number;
  replyRate: number;
  meetingsBooked: number;
  pipelineValue: number;
}

export interface SequenceAnalyticsItem {
  id: string;
  name: string;
  enrolled: number;
  sent: number;
  opened: number;
  openRate: number;
  replied: number;
  replyRate: number;
  clicked: number;
  bounced: number;
  meetingsBooked: number;
}

export interface RepPerformanceItem {
  userId: string;
  displayName: string;
  email: string;
  emailsSent: number;
  replies: number;
  replyRate: number;
  meetingsBooked: number;
  pipelineValue: number;
  inboxStatus: 'connected' | 'needs_reauth' | 'disconnected';
}

export async function getAggregatedKpis(orgId: string): Promise<DashboardKpis> {
  if (!orgId) {
    return { emailsSent: 0, openRate: 0, replyRate: 0, meetingsBooked: 0, pipelineValue: 0 };
  }

  try {
    const statsRef = doc(db, `organizations/${orgId}/stats`, 'summary');
    const snap = await getDoc(statsRef);

    const dealsRef = collection(db, `organizations/${orgId}/deals`);
    const dealsSnap = await getDocs(dealsRef);
    let pipelineValue = 0;
    let meetingsBooked = 0;
    dealsSnap.forEach((d) => {
      const data = d.data() as Deal;
      pipelineValue += data.value || 0;
      if (data.stage === 'meeting_booked' || data.stage === 'won') meetingsBooked++;
    });

    if (snap.exists()) {
      const s = snap.data() as OrgStatsSummary & DashboardKpis & { opens?: number; replies?: number };
      const emailsSent = s.emailsSent || 0;
      const opens = s.opens || 0;
      const replies = s.replies || 0;
      return {
        emailsSent,
        openRate: emailsSent > 0 ? Number(((opens / emailsSent) * 100).toFixed(1)) : s.openRate || 0,
        replyRate: emailsSent > 0 ? Number(((replies / emailsSent) * 100).toFixed(1)) : s.replyRate || 0,
        meetingsBooked: s.meetingsBooked ?? meetingsBooked,
        pipelineValue: s.pipelineValue ?? pipelineValue,
      };
    }

    return {
      emailsSent: 0,
      openRate: 0,
      replyRate: 0,
      meetingsBooked,
      pipelineValue,
    };
  } catch (err) {
    console.error('Error fetching aggregated KPIs:', err);
    return { emailsSent: 0, openRate: 0, replyRate: 0, meetingsBooked: 0, pipelineValue: 0 };
  }
}

export async function getSequenceAnalytics(orgId: string): Promise<SequenceAnalyticsItem[]> {
  if (!orgId) return [];

  try {
    const seqRef = collection(db, `organizations/${orgId}/sequences`);
    const snap = await getDocs(seqRef);
    const result: SequenceAnalyticsItem[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() as Sequence;
      const stats = data.stats || {
        enrolled: 0,
        sent: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        bounced: 0,
      };
      const openRate = stats.sent > 0 ? Number(((stats.opened / stats.sent) * 100).toFixed(1)) : 0;
      const replyRate = stats.sent > 0 ? Number(((stats.replied / stats.sent) * 100).toFixed(1)) : 0;

      result.push({
        id: data.id,
        name: data.name,
        enrolled: stats.enrolled,
        sent: stats.sent,
        opened: stats.opened,
        openRate,
        replied: stats.replied,
        replyRate,
        clicked: stats.clicked,
        bounced: stats.bounced,
        meetingsBooked: 0,
      });
    });

    return result;
  } catch (err) {
    console.error('Error fetching sequence analytics:', err);
    return [];
  }
}

export async function getRepLeaderboard(orgId: string): Promise<RepPerformanceItem[]> {
  if (!orgId) return [];

  try {
    const usersRef = collection(db, `organizations/${orgId}/users`);
    const snap = await getDocs(usersRef);
    const dealsSnap = await getDocs(collection(db, `organizations/${orgId}/deals`));
    const pipelineByOwner = new Map<string, number>();
    const meetingsByOwner = new Map<string, number>();

    dealsSnap.forEach((d) => {
      const deal = d.data() as Deal;
      pipelineByOwner.set(deal.ownerId, (pipelineByOwner.get(deal.ownerId) || 0) + (deal.value || 0));
      if (deal.stage === 'meeting_booked' || deal.stage === 'won') {
        meetingsByOwner.set(deal.ownerId, (meetingsByOwner.get(deal.ownerId) || 0) + 1);
      }
    });

    // Active members only (not invited placeholders or deactivated users); fetch stats in parallel.
    const members = snap.docs.map((d) => d.data() as User).filter((u) => u.status === 'active');
    const repStats = await Promise.all(
      members.map((u) => getDoc(doc(db, `organizations/${orgId}/stats`, `rep_${u.id}`)))
    );

    const result: RepPerformanceItem[] = members.map((u, i) => {
      const stats = repStats[i].exists() ? repStats[i].data() : {};
      const emailsSent = Number(stats.emailsSent || 0);
      const replies = Number(stats.replies || 0);
      return {
        userId: u.id,
        displayName: u.displayName || u.email,
        email: u.email,
        emailsSent,
        replies,
        replyRate: emailsSent > 0 ? Number(((replies / emailsSent) * 100).toFixed(1)) : 0,
        meetingsBooked: meetingsByOwner.get(u.id) || 0,
        pipelineValue: pipelineByOwner.get(u.id) || 0,
        inboxStatus: u.inboxStatus || 'disconnected',
      };
    });

    return result.sort(
      (a, b) => b.replyRate - a.replyRate || b.emailsSent - a.emailsSent || b.pipelineValue - a.pipelineValue
    );
  } catch (err) {
    console.error('Error fetching rep leaderboard:', err);
    return [];
  }
}
