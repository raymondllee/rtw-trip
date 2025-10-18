// @ts-nocheck
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

import type { TripData, TripScenarioVersion } from '../types/trip';
import { db } from '../firebase/config';

export class FirestoreScenarioManager {
  constructor() {
    this.userId = 'default-user'; // TODO: Replace with actual user ID from auth
    this.currentScenarioId = null;
    this.autoVersionRetention = 50; // Keep last 50 auto-versions

    // Debug: Verify Firebase is initialized
    console.log('🔥 FirestoreScenarioManager initialized, db available:', !!db);
    if (!db) {
      console.error('❌ Firestore database is not initialized!');
    }
  }

  /**
   * Deterministic stringify with sorted keys for stable hashing/comparison
   */
  _stableStringify(obj) {
    const seen = new WeakSet();
    const stringify = (value) => {
      if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
      }
      if (seen.has(value)) {
        return '"[Circular]"';
      }
      seen.add(value);
      if (Array.isArray(value)) {
        return '[' + value.map((v) => stringify(v)).join(',') + ']';
      }
      const keys = Object.keys(value).sort();
      return '{' + keys.map((k) => JSON.stringify(k) + ':' + stringify(value[k])).join(',') + '}';
    };
    return stringify(obj);
  }

  /**
   * Simple djb2 hash for strings (fast, non-crypto)
   */
  _hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    // Convert to unsigned 32-bit and string
    return (hash >>> 0).toString(36);
  }

  /**
   * Get or create a scenario
   */
  async getOrCreateScenario(name, description = '') {
    const scenariosRef = collection(db, 'scenarios');
    const scenarioQuery = query(
      scenariosRef,
      where('userId', '==', this.userId),
      where('name', '==', name),
      limit(1)
    );

    const snapshot = await getDocs(scenarioQuery);

    if (!snapshot.empty) {
      const scenarioDoc = snapshot.docs[0];
      this.currentScenarioId = scenarioDoc.id;
      return { id: scenarioDoc.id, ...scenarioDoc.data() };
    }

    // Create new scenario
    const newScenarioRef = doc(collection(db, 'scenarios'));
    const scenarioData = {
      userId: this.userId,
      name,
      description,
      currentVersion: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await setDoc(newScenarioRef, scenarioData);
    this.currentScenarioId = newScenarioRef.id;

    return { id: newScenarioRef.id, ...scenarioData };
  }

  /**
   * Save a new version of the scenario (auto-save)
   */
  async saveVersion(scenarioId, itineraryData, isNamed = false, versionName = '') {
    if (!scenarioId) {
      throw new Error('Scenario ID is required');
    }

    const scenarioRef = doc(db, 'scenarios', scenarioId);
    const scenarioDoc = await getDoc(scenarioRef);

    if (!scenarioDoc.exists()) {
      throw new Error('Scenario not found');
    }

    const currentVersion = scenarioDoc.data().currentVersion || 0;
    const latest = await this.getLatestVersion(scenarioId);

    // For autosave, compute a hash to detect changes
    let currentHash = null;
    if (!isNamed) {
      const currentStr = this._stableStringify(itineraryData);
      currentHash = this._hashString(currentStr);
    }

    // Compare with latest version for autosaves
    if (!isNamed && latest) {
      const lastHash = latest.itineraryDataHash || this._hashString(this._stableStringify(latest.itineraryData || {}));
      if (lastHash === currentHash) {
        // Touch scenario timestamps but skip creating a new identical version
        await updateDoc(scenarioRef, {
          updatedAt: Timestamp.now(),
          lastAutosaveAt: Timestamp.now(),
          lastAutosaveHash: currentHash,
        });
        return { id: latest.id, skipped: true, reason: 'no_changes' };
      }
    }

    const newVersionNumber = currentVersion + 1;
    const versionRef = doc(collection(db, 'scenarios', scenarioId, 'versions'));
    const versionData = {
      versionNumber: newVersionNumber,
      versionName: isNamed ? versionName : '',
      itineraryData: JSON.parse(JSON.stringify(itineraryData)), // Deep copy
      // Only store hash for autosaves; named versions can compute on demand later
      itineraryDataHash: currentHash,
      isNamed,
      isAutosave: !isNamed,
      createdAt: Timestamp.now()
    };

    await setDoc(versionRef, versionData);

    await updateDoc(scenarioRef, {
      currentVersion: newVersionNumber,
      updatedAt: Timestamp.now()
    });

    if (!isNamed) {
      await this.cleanupOldVersions(scenarioId);
    }

    return { id: versionRef.id, ...versionData };
  }

  /**
   * Get the latest version of a scenario
   */
  async getLatestVersion(scenarioId) {
    const versionsRef = collection(db, 'scenarios', scenarioId, 'versions');
    const versionsQuery = query(
      versionsRef,
      orderBy('versionNumber', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(versionsQuery);

    if (snapshot.empty) {
      return null;
    }

    const versionDoc = snapshot.docs[0];
    return { id: versionDoc.id, ...versionDoc.data() };
  }

  /**
   * Get all versions for a scenario
   */
  async getVersionHistory(scenarioId, limitCount = 50) {
    const versionsRef = collection(db, 'scenarios', scenarioId, 'versions');
    const versionsQuery = query(
      versionsRef,
      orderBy('versionNumber', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(versionsQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get a specific version by version number
   */
  async getVersion(scenarioId, versionNumber) {
    const versionsRef = collection(db, 'scenarios', scenarioId, 'versions');
    const versionsQuery = query(
      versionsRef,
      where('versionNumber', '==', versionNumber),
      limit(1)
    );

    const snapshot = await getDocs(versionsQuery);

    if (snapshot.empty) {
      return null;
    }

    const versionDoc = snapshot.docs[0];
    return { id: versionDoc.id, ...versionDoc.data() };
  }

  /**
   * Delete a specific version by version number and update currentVersion if needed
   */
  async deleteVersion(scenarioId, versionNumber) {
    const versionsRef = collection(db, 'scenarios', scenarioId, 'versions');
    const q = query(versionsRef, where('versionNumber', '==', versionNumber), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return { deleted: 0 };

    const versionDoc = snap.docs[0];
    await deleteDoc(doc(db, 'scenarios', scenarioId, 'versions', versionDoc.id));

    // Recompute currentVersion to the highest remaining
    const latest = await this.getLatestVersion(scenarioId);
    const scenarioRef = doc(db, 'scenarios', scenarioId);
    if (latest) {
      await updateDoc(scenarioRef, { currentVersion: latest.versionNumber, updatedAt: Timestamp.now() });
    } else {
      await updateDoc(scenarioRef, { currentVersion: 0, updatedAt: Timestamp.now() });
    }

    return { deleted: 1 };
  }

  /**
   * Delete all unlabeled versions for a scenario (optionally keep the latest one)
   */
  async deleteUnlabeledVersions(scenarioId, keepLatest = true) {
    const versionsRef = collection(db, 'scenarios', scenarioId, 'versions');
    const allSnap = await getDocs(versionsRef);
    const versions = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const unlabeled = versions.filter(v => !v.isNamed);
    if (unlabeled.length === 0) return { deleted: 0 };

    // Optionally keep the highest versionNumber among unlabeled
    let toDelete = unlabeled;
    if (keepLatest) {
      const maxUnlabeled = unlabeled.reduce((a, b) => (a.versionNumber > b.versionNumber ? a : b));
      toDelete = unlabeled.filter(v => v.id !== maxUnlabeled.id);
    }

    await Promise.all(toDelete.map(v => deleteDoc(doc(db, 'scenarios', scenarioId, 'versions', v.id))));

    // Update currentVersion to highest remaining
    const latest = await this.getLatestVersion(scenarioId);
    const scenarioRef = doc(db, 'scenarios', scenarioId);
    if (latest) {
      await updateDoc(scenarioRef, { currentVersion: latest.versionNumber, updatedAt: Timestamp.now() });
    } else {
      await updateDoc(scenarioRef, { currentVersion: 0, updatedAt: Timestamp.now() });
    }

    return { deleted: toDelete.length };
  }

  /**
   * Revert to a specific version (creates new version with old data)
   */
  async revertToVersion(scenarioId, versionNumber) {
    const oldVersion = await this.getVersion(scenarioId, versionNumber);

    if (!oldVersion) {
      throw new Error(`Version ${versionNumber} not found`);
    }

    // Create new version with old data
    return await this.saveVersion(
      scenarioId,
      oldVersion.itineraryData,
      true,
      `Reverted to v${versionNumber}`
    );
  }

  /**
   * Name/tag a specific version
   */
  async nameVersion(scenarioId, versionNumber, versionName) {
    const versionsRef = collection(db, 'scenarios', scenarioId, 'versions');
    const versionsQuery = query(
      versionsRef,
      where('versionNumber', '==', versionNumber),
      limit(1)
    );

    const snapshot = await getDocs(versionsQuery);

    if (snapshot.empty) {
      throw new Error(`Version ${versionNumber} not found`);
    }

    const versionDoc = snapshot.docs[0];
    await updateDoc(doc(db, 'scenarios', scenarioId, 'versions', versionDoc.id), {
      versionName,
      isNamed: true
    });

    return { id: versionDoc.id, ...versionDoc.data(), versionName, isNamed: true };
  }

  /**
   * Get all scenarios for current user
   */
  async listScenarios() {
    const scenariosRef = collection(db, 'scenarios');
    const scenariosQuery = query(
      scenariosRef,
      where('userId', '==', this.userId),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(scenariosQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get a specific scenario by ID
   */
  async getScenario(scenarioId) {
    const scenarioRef = doc(db, 'scenarios', scenarioId);
    const scenarioDoc = await getDoc(scenarioRef);

    if (!scenarioDoc.exists()) {
      return null;
    }

    return { id: scenarioDoc.id, ...scenarioDoc.data() };
  }

  /**
   * Rename a scenario
   */
  async renameScenario(scenarioId, newName) {
    if (!scenarioId) {
      throw new Error('Scenario ID is required');
    }

    if (!newName || !newName.trim()) {
      throw new Error('New name is required');
    }

    const scenarioRef = doc(db, 'scenarios', scenarioId);
    const scenarioDoc = await getDoc(scenarioRef);

    if (!scenarioDoc.exists()) {
      throw new Error('Scenario not found');
    }

    // Update scenario name
    await updateDoc(scenarioRef, {
      name: newName.trim(),
      updatedAt: Timestamp.now()
    });

    return { id: scenarioId, name: newName.trim() };
  }

  /**
   * Delete a scenario and all its versions
   */
  async deleteScenario(scenarioId) {
    // Delete all versions first
    const versionsRef = collection(db, 'scenarios', scenarioId, 'versions');
    const versionsSnapshot = await getDocs(versionsRef);

    const deletePromises = versionsSnapshot.docs.map(versionDoc =>
      deleteDoc(doc(db, 'scenarios', scenarioId, 'versions', versionDoc.id))
    );

    await Promise.all(deletePromises);

    // Delete the scenario document
    await deleteDoc(doc(db, 'scenarios', scenarioId));
  }

  /**
   * Clean up old auto-versions, keeping only the most recent N versions
   * Named versions are never deleted
   */
  async cleanupOldVersions(scenarioId) {
    const versionsRef = collection(db, 'scenarios', scenarioId, 'versions');
    const autoVersionsQuery = query(
      versionsRef,
      where('isNamed', '==', false),
      orderBy('versionNumber', 'desc')
    );

    const snapshot = await getDocs(autoVersionsQuery);
    const autoVersions = snapshot.docs;

    if (autoVersions.length > this.autoVersionRetention) {
      const versionsToDelete = autoVersions.slice(this.autoVersionRetention);
      const deletePromises = versionsToDelete.map(versionDoc =>
        deleteDoc(doc(db, 'scenarios', scenarioId, 'versions', versionDoc.id))
      );

      await Promise.all(deletePromises);
      console.log(`Cleaned up ${versionsToDelete.length} old auto-versions`);
    }
  }

  /**
   * Subscribe to real-time updates for a scenario
   */
  subscribeToScenario(scenarioId, callback) {
    const scenarioRef = doc(db, 'scenarios', scenarioId);
    return onSnapshot(scenarioRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() });
      }
    });
  }

  /**
   * Subscribe to real-time updates for versions
   */
  subscribeToVersions(scenarioId, callback) {
    const versionsRef = collection(db, 'scenarios', scenarioId, 'versions');
    const versionsQuery = query(
      versionsRef,
      orderBy('versionNumber', 'desc'),
      limit(50)
    );

    return onSnapshot(versionsQuery, (snapshot) => {
      const versions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(versions);
    });
  }

  /**
   * Save a new scenario with initial data
   * Returns the scenario ID
   */
  async saveScenario(scenarioData) {
    const { name, description, data } = scenarioData;

    // Create the scenario
    const scenario = await this.getOrCreateScenario(name, description || '');

    // Save the initial version
    await this.saveVersion(scenario.id, data, true, 'Initial version');

    return scenario.id;
  }

  /**
   * Migrate localStorage scenarios to Firestore
   */
  async migrateFromLocalStorage() {
    const storageKey = 'rtw-scenarios';
    const scenariosJson = localStorage.getItem(storageKey);

    if (!scenariosJson) {
      console.log('No localStorage scenarios to migrate');
      return [];
    }

    const scenarios = JSON.parse(scenariosJson);
    const migrated = [];

    for (const [name, scenarioData] of Object.entries(scenarios)) {
      try {
        // Create scenario in Firestore
        const scenario = await this.getOrCreateScenario(
          scenarioData.name || name,
          scenarioData.description || ''
        );

        // Create initial version with the data
        await this.saveVersion(
          scenario.id,
          scenarioData.data,
          true,
          'Migrated from localStorage'
        );

        migrated.push(scenario.name);
        console.log(`Migrated scenario: ${scenario.name}`);
      } catch (error) {
        console.error(`Failed to migrate scenario ${name}:`, error);
      }
    }

    return migrated;
  }

  /**
   * Save a summary for a scenario
   */
  async saveSummary(scenarioId, summaryData) {
    if (!scenarioId) {
      throw new Error('Scenario ID is required');
    }

    const scenarioRef = doc(db, 'scenarios', scenarioId);
    const scenarioDoc = await getDoc(scenarioRef);

    if (!scenarioDoc.exists()) {
      throw new Error('Scenario not found');
    }

    // Update scenario with summary data
    await updateDoc(scenarioRef, {
      summary: summaryData,
      summaryGeneratedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    console.log(`Summary saved to scenario ${scenarioId}`);
  }

  /**
   * Get the saved summary for a scenario
   */
  async getSummary(scenarioId) {
    const scenarioRef = doc(db, 'scenarios', scenarioId);
    const scenarioDoc = await getDoc(scenarioRef);

    if (!scenarioDoc.exists()) {
      throw new Error('Scenario not found');
    }

    const data = scenarioDoc.data();
    return data.summary || null;
  }

  /**
   * Check if a scenario has a saved summary
   */
  async hasSummary(scenarioId) {
    const summary = await this.getSummary(scenarioId);
    return summary !== null;
  }

  /**
   * Delete a summary from a scenario
   */
  async deleteSummary(scenarioId) {
    if (!scenarioId) {
      throw new Error('Scenario ID is required');
    }

    const scenarioRef = doc(db, 'scenarios', scenarioId);
    await updateDoc(scenarioRef, {
      summary: null,
      summaryGeneratedAt: null,
      updatedAt: Timestamp.now()
    });

    console.log(`Summary deleted from scenario ${scenarioId}`);
  }
}
