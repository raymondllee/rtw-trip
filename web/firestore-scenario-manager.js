// Firestore-based Scenario Manager with Automatic Versioning
import { db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

export class FirestoreScenarioManager {
  constructor() {
    this.userId = 'default-user'; // TODO: Replace with actual user ID from auth
    this.currentScenarioId = null;
    this.autoVersionRetention = 50; // Keep last 50 auto-versions
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
    const newVersionNumber = currentVersion + 1;

    // Create new version document
    const versionRef = doc(collection(db, 'scenarios', scenarioId, 'versions'));
    const versionData = {
      versionNumber: newVersionNumber,
      versionName: isNamed ? versionName : '',
      itineraryData: JSON.parse(JSON.stringify(itineraryData)), // Deep copy
      isNamed,
      createdAt: Timestamp.now()
    };

    await setDoc(versionRef, versionData);

    // Update scenario's current version
    await updateDoc(scenarioRef, {
      currentVersion: newVersionNumber,
      updatedAt: Timestamp.now()
    });

    // Clean up old auto-versions if needed
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
}
