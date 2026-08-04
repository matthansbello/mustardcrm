import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Deal, DealStage } from '@/types';

/**
 * Fetch all deals for an organization
 */
export async function getDeals(orgId: string): Promise<Deal[]> {
  if (!orgId) return [];
  try {
    const dealsRef = collection(db, `organizations/${orgId}/deals`);
    const snapshot = await getDocs(dealsRef);
    const deals: Deal[] = [];
    snapshot.forEach((docSnap) => {
      deals.push(docSnap.data() as Deal);
    });
    return deals;
  } catch (error) {
    console.error('Error fetching deals:', error);
    return [];
  }
}

/**
 * Create a new deal
 */
export async function createDeal(
  orgId: string,
  dealData: Omit<Deal, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>
): Promise<Deal> {
  const dealId = `deal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newDeal: Deal = {
    ...dealData,
    id: dealId,
    orgId,
    createdAt: now,
    updatedAt: now,
  };

  const dealRef = doc(db, `organizations/${orgId}/deals`, dealId);
  await setDoc(dealRef, newDeal);

  return newDeal;
}

/**
 * Update deal stage
 */
export async function updateDealStage(
  orgId: string,
  dealId: string,
  stage: DealStage
): Promise<void> {
  const dealRef = doc(db, `organizations/${orgId}/deals`, dealId);
  await updateDoc(dealRef, {
    stage,
    updatedAt: new Date().toISOString(),
  });
}
