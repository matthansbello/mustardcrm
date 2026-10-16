import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { OrganizationSettings } from '@/types';

/** Update the workspace name and default sending settings (admins only, enforced by Firestore rules). */
export async function updateOrganization(
  orgId: string,
  data: { name: string; settings: Pick<OrganizationSettings, 'defaultDailyCapPerMailbox' | 'defaultSendingWindow'> }
): Promise<void> {
  await updateDoc(doc(db, 'organizations', orgId), {
    name: data.name.trim(),
    'settings.defaultDailyCapPerMailbox': data.settings.defaultDailyCapPerMailbox,
    'settings.defaultSendingWindow': data.settings.defaultSendingWindow,
    updatedAt: new Date().toISOString(),
  });
}
