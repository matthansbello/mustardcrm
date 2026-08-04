import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Company } from '@/types';

/**
 * Fetch all companies for an organization
 */
export async function getCompanies(orgId: string): Promise<Company[]> {
  if (!orgId) return [];
  try {
    const companiesRef = collection(db, `organizations/${orgId}/companies`);
    const snapshot = await getDocs(companiesRef);
    const companies: Company[] = [];
    snapshot.forEach((docSnap) => {
      companies.push(docSnap.data() as Company);
    });
    return companies;
  } catch (error) {
    console.error('Error fetching companies:', error);
    return [];
  }
}

/**
 * Create a new company
 */
export async function createCompany(
  orgId: string,
  companyData: Omit<Company, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>
): Promise<Company> {
  const companyId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newCompany: Company = {
    ...companyData,
    id: companyId,
    orgId,
    createdAt: now,
    updatedAt: now,
  };

  const companyRef = doc(db, `organizations/${orgId}/companies`, companyId);
  await setDoc(companyRef, newCompany);

  return newCompany;
}
