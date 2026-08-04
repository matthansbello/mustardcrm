/**
 * Mustard Domain Data Models & Firestore Schemas
 */

export type UserRole = 'admin' | 'manager' | 'rep';

export type InboxConnectionStatus = 'connected' | 'needs_reauth' | 'disconnected';

export type UserStatus = 'active' | 'invited' | 'inactive';

export interface OrganizationSettings {
  defaultDailyCapPerMailbox: number;
  defaultSendingWindow: {
    startHour: number;
    endHour: number;
    timezone: string;
  };
  unsubscribeFooterHtml?: string;
  physicalAddress?: string;
}

export interface Organization {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
  updatedAt: string;
  sendingDomain?: string;
  settings: OrganizationSettings;
}

export interface User {
  id: string;
  orgId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  inboxStatus: InboxConnectionStatus;
  lastConnectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invite {
  id: string;
  orgId: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  updatedAt: string;
}

export type ContactLifecycleStage =
  | 'lead'
  | 'contacted'
  | 'replied'
  | 'opportunity'
  | 'customer'
  | 'unsubscribed'
  | 'bounced';

export interface Contact {
  id: string;
  orgId: string;
  email: string;
  secondaryEmails?: string[];
  firstName: string;
  lastName: string;
  phone?: string;
  title?: string;
  companyId?: string;
  companyName?: string;
  linkedIn?: string;
  tags: string[];
  ownerId: string;
  lifecycleStage: ContactLifecycleStage;
  customFields: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  orgId: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  contactIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type DealStage =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'meeting_booked'
  | 'won'
  | 'lost';

export interface Deal {
  id: string;
  orgId: string;
  contactId: string;
  companyId?: string;
  title: string;
  value: number;
  stage: DealStage;
  ownerId: string;
  expectedCloseDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStep {
  id: string;
  stepNumber: number;
  dayDelay: number;
  subject: string;
  body: string;
  branchOnReply: boolean;
}

export interface SequenceSettings {
  sendingWindow: {
    startHour: number;
    endHour: number;
    timezone: string;
  };
  dailyCapPerMailbox: number;
  senderUserIds: string[];
}

export interface SequenceStats {
  enrolled: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

export type SequenceStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface Sequence {
  id: string;
  orgId: string;
  name: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  settings: SequenceSettings;
  stats: SequenceStats;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type EnrollmentStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'replied'
  | 'bounced'
  | 'unsubscribed'
  | 'error';

export interface EnrollmentHistoryItem {
  stepIndex: number;
  sentAt: string;
  messageId?: string;
  sendAttemptId: string;
}

export interface Enrollment {
  id: string;
  orgId: string;
  sequenceId: string;
  contactId: string;
  currentStepIndex: number;
  status: EnrollmentStatus;
  nextSendDueAt: string | null;
  lastSendAttemptId?: string;
  history: EnrollmentHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export type EmailEventType = 'sent' | 'open' | 'click' | 'reply' | 'bounce';

export interface EmailEvent {
  id: string;
  orgId: string;
  sequenceId: string;
  contactId: string;
  stepIndex?: number;
  type: EmailEventType;
  timestamp: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export type ImportJobStatus =
  | 'pending'
  | 'validating'
  | 'importing'
  | 'completed'
  | 'failed';

export type ImportJobType = 'contacts' | 'team';

export interface ImportJob {
  id: string;
  orgId: string;
  type: ImportJobType;
  fileName: string;
  storagePath: string;
  totalRows: number;
  processedRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  duplicateCount: number;
  status: ImportJobStatus;
  columnMapping: Record<string, string>;
  ownerId: string;
  errorReportUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleToken {
  userId: string;
  orgId: string;
  encryptedRefreshToken: string;
  encryptedAccessToken?: string;
  expiresAt?: number;
  scope: string;
  updatedAt: string;
}

export interface OrgStatsSummary {
  emailsSent: number;
  opens: number;
  clicks: number;
  replies: number;
  bounces: number;
  openRate: number;
  replyRate: number;
  meetingsBooked: number;
  pipelineValue: number;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  contactId: string;
  type:
    | 'email_sent'
    | 'email_opened'
    | 'email_clicked'
    | 'email_replied'
    | 'note_added'
    | 'stage_changed'
    | 'contact_created';
  title: string;
  description?: string;
  timestamp: string;
  actorId?: string;
}
