// Service for managing wellness summaries and user data

export interface UserSummary {
  userId: string;
  userName: string;
  summaries: Record<string, string>; // key: "RING_DIMENSION", value: summary text
  lastUpdated: string;
  isEdited: boolean; // true if user has manually edited summaries
}

export interface UserData {
  userId: string;
  userName: string;
  responses: Record<string, string>;
  lastUpdated: string;
}

class SummaryStorageService {
  private readonly STORAGE_KEY = 'wellness_summaries';
  private readonly USERS_KEY = 'wellness_users';
  private readonly CURRENT_USER_KEY = 'wellness_current_user';

  // User Management
  getCurrentUser(): string | null {
    return localStorage.getItem(this.CURRENT_USER_KEY);
  }

  setCurrentUser(userId: string): void {
    localStorage.setItem(this.CURRENT_USER_KEY, userId);
  }

  getAllUsers(): UserData[] {
    const usersJson = localStorage.getItem(this.USERS_KEY);
    if (!usersJson) return [];
    
    try {
      return JSON.parse(usersJson);
    } catch {
      return [];
    }
  }

  saveUser(userData: UserData): void {
    const users = this.getAllUsers();
    const existingIndex = users.findIndex(u => u.userId === userData.userId);
    
    if (existingIndex >= 0) {
      users[existingIndex] = { ...userData, lastUpdated: new Date().toISOString() };
    } else {
      users.push({ ...userData, lastUpdated: new Date().toISOString() });
    }
    
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

  deleteUser(userId: string): void {
    const users = this.getAllUsers().filter(u => u.userId !== userId);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    
    // Also delete their summaries
    this.deleteUserSummaries(userId);
    
    // If this was the current user, clear current user
    if (this.getCurrentUser() === userId) {
      localStorage.removeItem(this.CURRENT_USER_KEY);
    }
  }

  // Summary Management
  getUserSummaries(userId: string): UserSummary | null {
    const summariesJson = localStorage.getItem(this.STORAGE_KEY);
    if (!summariesJson) return null;
    
    try {
      const allSummaries: UserSummary[] = JSON.parse(summariesJson);
      return allSummaries.find(s => s.userId === userId) || null;
    } catch {
      return null;
    }
  }

  saveUserSummaries(userSummary: UserSummary): void {
    const summariesJson = localStorage.getItem(this.STORAGE_KEY);
    let allSummaries: UserSummary[] = [];
    
    if (summariesJson) {
      try {
        allSummaries = JSON.parse(summariesJson);
      } catch {
        allSummaries = [];
      }
    }
    
    const existingIndex = allSummaries.findIndex(s => s.userId === userSummary.userId);
    
    if (existingIndex >= 0) {
      allSummaries[existingIndex] = { ...userSummary, lastUpdated: new Date().toISOString() };
    } else {
      allSummaries.push({ ...userSummary, lastUpdated: new Date().toISOString() });
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allSummaries));
  }

  updateSummary(userId: string, ringDimension: string, summary: string): void {
    const userSummaries = this.getUserSummaries(userId);
    
    if (userSummaries) {
      userSummaries.summaries[ringDimension] = summary;
      userSummaries.isEdited = true;
      this.saveUserSummaries(userSummaries);
    } else {
      // Create new user summary entry
      const newUserSummary: UserSummary = {
        userId,
        userName: this.getUserById(userId)?.userName || 'Unknown User',
        summaries: { [ringDimension]: summary },
        lastUpdated: new Date().toISOString(),
        isEdited: true
      };
      this.saveUserSummaries(newUserSummary);
    }
  }

  deleteUserSummaries(userId: string): void {
    const summariesJson = localStorage.getItem(this.STORAGE_KEY);
    if (!summariesJson) return;
    
    try {
      const allSummaries: UserSummary[] = JSON.parse(summariesJson);
      const filteredSummaries = allSummaries.filter(s => s.userId !== userId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredSummaries));
    } catch {
      // Ignore parsing errors
    }
  }

  // Helper methods
  getUserById(userId: string): UserData | null {
    const users = this.getAllUsers();
    return users.find(u => u.userId === userId) || null;
  }

  generateUserId(userName: string): string {
    // Create a simple ID based on name and timestamp
    const timestamp = Date.now();
    const cleanName = userName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanName}_${timestamp}`;
  }

  // Check if summaries exist for a user
  hasSummaries(userId: string): boolean {
    const userSummaries = this.getUserSummaries(userId);
    return userSummaries !== null && Object.keys(userSummaries.summaries).length > 0;
  }

  // Get summary for specific ring/dimension
  getSummary(userId: string, ringDimension: string): string | null {
    const userSummaries = this.getUserSummaries(userId);
    return userSummaries?.summaries[ringDimension] || null;
  }

  // Check if a summary has been manually edited
  isSummaryEdited(userId: string): boolean {
    const userSummaries = this.getUserSummaries(userId);
    return userSummaries?.isEdited || false;
  }

  // Export/Import functionality
  exportUserData(userId: string): string {
    const userData = this.getUserById(userId);
    const userSummaries = this.getUserSummaries(userId);
    
    return JSON.stringify({
      userData,
      userSummaries,
      exportDate: new Date().toISOString()
    }, null, 2);
  }

  importUserData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.userData) {
        this.saveUser(data.userData);
      }
      
      if (data.userSummaries) {
        this.saveUserSummaries(data.userSummaries);
      }
      
      return true;
    } catch {
      return false;
    }
  }
}

export const summaryStorageService = new SummaryStorageService();
