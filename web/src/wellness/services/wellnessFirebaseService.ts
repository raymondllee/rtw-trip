import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';

export interface WellnessUserData {
  userId: string;
  userName: string;
  responses: Record<string, string>;
  summaries?: Record<string, string>;
  lastUpdated: string;
  createdAt?: string;
}

export interface AnalysisData {
  analysisId: string;
  userId: string;
  analysis: any; // Analysis result from wellness agent
  createdAt: string;
}

class WellnessFirebaseService {
  private collectionName = 'wellness_users';
  private analysisCollectionName = 'wellness_analyses';

  /**
   * Get all wellness users
   */
  async getAllUsers(): Promise<WellnessUserData[]> {
    try {
      const usersRef = collection(db, this.collectionName);
      const snapshot = await getDocs(usersRef);
      return snapshot.docs.map(doc => doc.data() as WellnessUserData);
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  /**
   * Get a specific user by ID
   */
  async getUserById(userId: string): Promise<WellnessUserData | null> {
    try {
      const userRef = doc(db, this.collectionName, userId);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        return snapshot.data() as WellnessUserData;
      }
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Save or update a user
   */
  async saveUser(userData: WellnessUserData): Promise<boolean> {
    try {
      const userRef = doc(db, this.collectionName, userData.userId);
      const now = new Date().toISOString();

      const dataToSave = {
        ...userData,
        lastUpdated: now,
        createdAt: userData.createdAt || now
      };

      await setDoc(userRef, dataToSave, { merge: true });
      console.log('✅ User saved:', userData.userId);
      return true;
    } catch (error) {
      console.error('Error saving user:', error);
      return false;
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      const userRef = doc(db, this.collectionName, userId);
      await deleteDoc(userRef);
      console.log('✅ User deleted:', userId);
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  /**
   * Generate a user ID from name
   */
  generateUserId(userName: string): string {
    return userName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
  }

  /**
   * Get current user from localStorage (for session management)
   */
  getCurrentUser(): string | null {
    return localStorage.getItem('wellness_current_user');
  }

  /**
   * Set current user in localStorage
   */
  setCurrentUser(userId: string): void {
    localStorage.setItem('wellness_current_user', userId);
  }

  /**
   * Check if user has summaries
   */
  hasSummaries(userId: string, userData?: WellnessUserData): boolean {
    if (userData && userData.summaries) {
      return Object.keys(userData.summaries).length > 0;
    }
    return false;
  }

  /**
   * Save wellness analysis
   */
  async saveAnalysis(userId: string, analysis: any): Promise<string | null> {
    try {
      const analysisId = `${userId}-${Date.now()}`;
      const analysisRef = doc(db, this.analysisCollectionName, analysisId);

      const analysisData: AnalysisData = {
        analysisId,
        userId,
        analysis,
        createdAt: new Date().toISOString()
      };

      await setDoc(analysisRef, analysisData);
      console.log('✅ Analysis saved:', analysisId);
      return analysisId;
    } catch (error) {
      console.error('Error saving analysis:', error);
      return null;
    }
  }

  /**
   * Get analyses for a user
   */
  async getUserAnalyses(userId: string): Promise<AnalysisData[]> {
    try {
      const analysesRef = collection(db, this.analysisCollectionName);
      const q = query(analysesRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as AnalysisData);
    } catch (error) {
      console.error('Error getting user analyses:', error);
      return [];
    }
  }

  /**
   * Export user data (for compatibility with old system)
   */
  async exportUserData(userId: string): Promise<string> {
    const userData = await this.getUserById(userId);
    if (userData) {
      return JSON.stringify(userData, null, 2);
    }
    return '';
  }

  /**
   * Import user data (for compatibility with old system)
   */
  async importUserData(jsonData: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonData);

      // Handle bulk import format { wellness_users: [...] }
      if (parsed.wellness_users && Array.isArray(parsed.wellness_users)) {
        console.log(`Processing bulk import of ${parsed.wellness_users.length} users...`);
        const promises = parsed.wellness_users.map((user: WellnessUserData) => this.saveUser(user));
        const results = await Promise.all(promises);
        return results.every(r => r);
      }

      // Handle single user import
      const userData = parsed as WellnessUserData;
      return await this.saveUser(userData);
    } catch (error) {
      console.error('Error importing user data:', error);
      return false;
    }
  }
}

export const wellnessFirebaseService = new WellnessFirebaseService();
