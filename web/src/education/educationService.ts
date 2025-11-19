/**
 * Education Service - API client for curriculum and education features
 */

// Get API base URL from config without requiring Google Maps API key
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const apiConfig = (window as any).API_CONFIG;
    if (apiConfig?.BASE_URL) {
      return apiConfig.BASE_URL;
    }
  }
  return 'http://localhost:5001';
}

export interface CurriculumPlan {
  id: string;
  student_profile_id: string;
  trip_scenario_id: string;
  trip_version_id?: string;
  location_id: string;
  location_name: string;
  country: string;
  region?: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  generated_at: string;
  ai_model_used: string;
  semester: {
    title: string;
    start_date: string;
    end_date: string;
    total_weeks: number;
    total_destinations: number;
  };
  location_lessons: Record<string, any>;
  thematic_threads: any[];
  standards_coverage: Record<string, any>;
}

export interface GenerateCurriculumRequest {
  student: {
    id?: string;
    name: string;
    age: number;
    grade: number;
    state: string;
    learning_style: string;
    time_budget_minutes_per_day: number;
    reading_level: number;
    interests: string[];
  };
  location: {
    id: string;
    name: string;
    country: string;
    region?: string;
    duration_days: number;
    arrival_date?: string;
    departure_date?: string;
    activity_type?: string;
    highlights: string[];
    trip_scenario_id?: string;
    trip_version_id?: string;
  };
  subjects: string[];
}

export interface GenerateCurriculumResponse {
  status: 'success' | 'partial_success';
  curriculum: any;
  metadata: {
    model_used: string;
    generation_time: string;
    prompt_length?: number;
  };
  saved_ids?: {
    student_profile_id: string;
    curriculum_plan_id: string;
    activity_ids: string[];
    total_activities: number;
    location_id: string;
  };
  raw_text?: string;
  error?: string;
}

export interface ListCurriculaResponse {
  status: 'success';
  count: number;
  curricula: CurriculumPlan[];
}

export class EducationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Generate curriculum for a destination
   */
  async generateCurriculum(request: GenerateCurriculumRequest): Promise<GenerateCurriculumResponse> {
    const response = await fetch(`${this.baseUrl}/api/education/test/generate-curriculum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate curriculum');
    }

    return await response.json();
  }

  /**
   * Get all curricula for a specific location
   */
  async getCurriculaByLocation(locationId: string): Promise<ListCurriculaResponse> {
    const response = await fetch(`${this.baseUrl}/api/education/curricula/by-location/${locationId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch curricula');
    }

    return await response.json();
  }

  /**
   * Get a specific curriculum by ID
   */
  async getCurriculum(planId: string): Promise<{ status: 'success'; curriculum: CurriculumPlan }> {
    const response = await fetch(`${this.baseUrl}/api/education/curricula/${planId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch curriculum');
    }

    return await response.json();
  }

  /**
   * List all curricula with optional filters
   */
  async listCurricula(filters?: {
    student_id?: string;
    location_id?: string;
    country?: string;
    status?: string;
    limit?: number;
  }): Promise<ListCurriculaResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
    }

    const url = `${this.baseUrl}/api/education/curricula${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list curricula');
    }

    return await response.json();
  }

  /**
   * Get all curricula for a specific student
   */
  async getStudentCurricula(studentId: string): Promise<ListCurriculaResponse> {
    const response = await fetch(`${this.baseUrl}/api/education/students/${studentId}/curricula`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch student curricula');
    }

    return await response.json();
  }

  /**
   * Update a curriculum plan
   */
  async updateCurriculum(planId: string, updates: any): Promise<{ status: 'success'; updated_at: string }> {
    const response = await fetch(`${this.baseUrl}/api/education/curricula/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update curriculum');
    }

    return await response.json();
  }

  /**
   * Add a custom activity to a curriculum plan
   */
  async addCustomActivity(planId: string, activityData: any): Promise<{ status: 'success'; activity_id: string }> {
    const response = await fetch(`${this.baseUrl}/api/education/curricula/${planId}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activityData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add custom activity');
    }

    return await response.json();
  }
}

// Export singleton instance
export const educationService = new EducationService();
