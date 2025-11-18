// Education System Type Definitions

export type LearningStyle = 'experiential' | 'structured' | 'mixed';
export type ActivityType = 'experiential' | 'structured' | 'reading' | 'video' | 'assignment' | 'reflection';
export type ActivityTiming = 'pre_trip' | 'on_location' | 'post_trip' | 'flexible';
export type ActivityStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type CurriculumStatus = 'draft' | 'active' | 'completed' | 'archived';
export type PortfolioStatus = 'building' | 'finalized' | 'shared';
export type AssessmentType = 'checkbox' | 'rubric' | 'self_reflection' | 'parent_review';
export type ResourceType = 'book' | 'article' | 'video' | 'podcast' | 'website' | 'khan_academy' | 'app';
export type PromptType = 'journal' | 'discussion' | 'essay' | 'creative';
export type ExportType = 'pdf' | 'web' | 'slideshow';
export type ExportFormat = 'chronological' | 'by_subject' | 'by_thread';

// ============================================
// STUDENT PROFILE
// ============================================

export interface StudentProfile {
  // Identity
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;

  // Demographics
  age: number;
  grade: number;
  grade_level_description?: string;
  state: string;
  country: string;

  // Curriculum Configuration
  subjects_parent_covers: string[];
  subjects_to_cover: string[];

  // Learning Preferences
  learning_style: LearningStyle;
  reading_level: number;
  time_budget_minutes_per_day: number;

  // Interests
  interests: string[];

  // Standards & Requirements
  educational_standards: string[];
  required_subjects: string[];

  // Linked trips
  active_trip_id?: string;
  curriculum_plan_id?: string;

  // Privacy
  parent_email?: string;
  school_name?: string;
  school_contact?: string;
}

// ============================================
// CURRICULUM PLAN
// ============================================

export interface CurriculumPlan {
  // Identity
  id: string;
  student_profile_id: string;
  trip_scenario_id: string;
  trip_version_id?: string;

  // Metadata
  created_at: Date;
  updated_at: Date;
  generated_at: Date;
  status: CurriculumStatus;

  // Semester Overview
  semester: Semester;

  // Location-Based Learning
  location_lessons: Record<string, LocationLearning>;

  // Thematic Threads
  thematic_threads: Thread[];

  // Standards Tracking
  standards_coverage: Record<string, StandardCoverage>;

  // Generation metadata
  ai_model_used: string;
  generation_prompt_hash?: string;
  customizations?: Customization[];
}

export interface Semester {
  title: string;
  start_date: string;
  end_date: string;
  total_weeks: number;
  total_destinations: number;
  subjects: Record<string, SubjectPlan>;
}

export interface SubjectPlan {
  subject: string;
  grade_level: number;
  learning_goals: string[];
  standards_addressed: string[];
  core_resources: Resource[];
  supplemental_resources: Resource[];
  assessment_plan: {
    formative: Assessment[];
    summative: Assessment[];
  };
  weekly_outline: WeeklyOutline[];
}

export interface WeeklyOutline {
  week_number: number;
  dates: { start: string; end: string };
  locations: string[];
  focus_topics: string[];
  estimated_hours: number;
}

export interface LocationLearning {
  location_id: string;
  location_name: string;
  arrival_date: string;
  departure_date: string;
  duration_days: number;

  pre_trip: {
    timeline: string;
    lessons: Lesson[];
    readings: Resource[];
    preparation_tasks: Task[];
  };

  on_location: {
    daily_menus: DailyLearningMenu[];
    field_trip_guides: FieldTripGuide[];
    experiential_activities: string[];  // Activity IDs
    structured_lessons: string[];       // Lesson IDs
  };

  post_trip: {
    reflection_prompts: Prompt[];
    synthesis_activities: string[];     // Activity IDs
    assessment_tasks: Task[];
  };

  subject_coverage: Record<string, {
    topics: string[];
    activities: string[];
    estimated_hours: number;
  }>;
}

export interface Thread {
  id: string;
  title: string;
  description: string;
  subject: string;
  locations: ThreadLocation[];
  culminating_project: {
    title: string;
    description: string;
    type: 'essay' | 'presentation' | 'portfolio' | 'creative';
    rubric?: Rubric;
    due_date?: string;
  };
}

export interface ThreadLocation {
  location_id: string;
  sequence_number: number;
  focus: string;
  activities: string[];
}

export interface StandardCoverage {
  description: string;
  covered_by: string[];
  status: ActivityStatus;
}

export interface Customization {
  timestamp: Date;
  field_path: string;
  old_value: any;
  new_value: any;
  user_note?: string;
}

// ============================================
// LEARNING ACTIVITIES
// ============================================

export interface LearningActivity {
  // Identity
  id: string;
  curriculum_plan_id: string;
  location_id?: string;
  thread_id?: string;

  // Classification
  type: ActivityType;
  subject: string;
  timing: ActivityTiming;

  // Content
  title: string;
  description: string;
  learning_objectives: string[];

  // Logistics
  estimated_duration_minutes: number;
  difficulty: Difficulty;
  prerequisites?: string[];

  // Instructions
  instructions: {
    before?: string;
    during?: string;
    after?: string;
    materials_needed?: string[];
    location_specific_notes?: string;
  };

  // Resources
  resources: Resource[];

  // Assessment
  assessment?: {
    type: AssessmentType;
    rubric?: Rubric;
    completion_criteria?: string;
  };

  // Metadata
  created_at: Date;
  ai_generated: boolean;
  customized: boolean;
  source?: string;
}

export interface Resource {
  type: ResourceType;
  title: string;
  author?: string;
  url?: string;
  isbn?: string;
  duration_minutes?: number;
  cost_usd?: number;
  required: boolean;
  age_appropriate: boolean;
  lexile_level?: number;
  notes?: string;
  khan_academy_id?: string;
  khan_academy_url?: string;
}

export interface Lesson {
  title: string;
  subject: string;
  objectives: string[];
  resources: Resource[];
  activities: string[];
  estimated_duration_minutes: number;
  homework?: string;
}

export interface DailyLearningMenu {
  date: string;
  location_id: string;
  options: MenuOption[];
  completed_option_ids?: string[];
  completion_notes?: string;
}

export interface MenuOption {
  id: string;
  title: string;
  type: ActivityType;
  subjects_covered: string[];
  estimated_duration_minutes: number;
  activities: string[];
  energy_level: EnergyLevel;
  weather_dependent: boolean;
}

export interface FieldTripGuide {
  site_name: string;
  location_id: string;
  place_id?: string;
  subjects: string[];
  key_concepts: string[];
  before: {
    readings: Resource[];
    guiding_questions: string[];
  };
  during: {
    observation_prompts: string[];
    photo_assignments: string[];
    interview_questions: string[];
    scavenger_hunt?: {
      items: string[];
      educational_purpose: string;
    };
  };
  after: {
    reflection_prompts: string[];
    research_tasks: string[];
    creative_assignments: string[];
  };
}

export interface Task {
  title: string;
  description: string;
  due_date?: string;
  estimated_duration_minutes: number;
  completion_criteria: string;
}

export interface Prompt {
  text: string;
  type: PromptType;
  word_count_target?: number;
}

export interface Rubric {
  criteria: RubricCriterion[];
  total_possible: number;
}

export interface RubricCriterion {
  name: string;
  description: string;
  levels: RubricLevel[];
}

export interface RubricLevel {
  score: number;
  descriptor: string;
  example?: string;
}

export interface Assessment {
  type: 'quiz' | 'project' | 'presentation' | 'essay' | 'portfolio';
  title: string;
  description: string;
  rubric?: Rubric;
  due_date?: string;
  weight?: number;
}

// ============================================
// PROGRESS TRACKING
// ============================================

export interface ProgressTracking {
  id: string;
  student_profile_id: string;
  curriculum_plan_id: string;
  activity_progress: Record<string, ActivityProgress>;
  daily_logs: Record<string, DailyLog>;
  subject_progress: Record<string, SubjectProgress>;
  thread_progress: Record<string, ThreadProgress>;
  summary: ProgressSummary;
}

export interface ActivityProgress {
  status: ActivityStatus;
  started_at?: Date;
  completed_at?: Date;
  time_spent_minutes?: number;
  completion_checked: boolean;
  rubric_scores?: Record<string, number>;
  self_reflection?: string;
  parent_notes?: string;
  photos?: string[];
  writing_samples?: string[];
  attachments?: string[];
}

export interface DailyLog {
  location_id: string;
  activities_completed: string[];
  time_spent_minutes: number;
  energy_level: EnergyLevel;
  highlights: string;
  challenges: string;
  parent_notes?: string;
}

export interface SubjectProgress {
  hours_completed: number;
  standards_met: string[];
  standards_in_progress: string[];
  standards_not_started: string[];
}

export interface ThreadProgress {
  locations_completed: number;
  locations_total: number;
  current_location_id?: string;
  culminating_project_status: ActivityStatus;
}

export interface ProgressSummary {
  total_hours: number;
  activities_completed: number;
  activities_total: number;
  completion_percentage: number;
  on_track: boolean;
  last_updated: Date;
}

// ============================================
// PORTFOLIO
// ============================================

export interface Portfolio {
  id: string;
  student_profile_id: string;
  curriculum_plan_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  status: PortfolioStatus;
  artifacts: PortfolioArtifacts;
  organized_by_subject: Record<string, OrganizedArtifacts>;
  organized_by_location: Record<string, OrganizedArtifacts>;
  organized_by_thread: Record<string, OrganizedArtifacts>;
  standards_evidence: Record<string, StandardEvidence>;
  exports: PortfolioExport[];
}

export interface PortfolioArtifacts {
  journals: JournalEntry[];
  essays: Essay[];
  photos: PhotoArtifact[];
  projects: Project[];
  videos?: any[];
  presentations?: any[];
  other?: any[];
}

export interface JournalEntry {
  date: string;
  location: string;
  entry: string;
  photos?: string[];
}

export interface Essay {
  title: string;
  subject: string;
  activity_id?: string;
  content: string;
  date_written: string;
  rubric_score?: number;
}

export interface PhotoArtifact {
  url: string;
  caption: string;
  location: string;
  date: string;
  educational_context: string;
}

export interface Project {
  title: string;
  type: string;
  subject: string;
  description: string;
  files: string[];
  created_date: string;
}

export interface OrganizedArtifacts {
  artifacts: string[];
  narrative?: string;
  highlights?: string[];
  synthesis?: string;
}

export interface StandardEvidence {
  description: string;
  evidence_artifacts: string[];
  notes: string;
}

export interface PortfolioExport {
  id: string;
  type: ExportType;
  created_at: Date;
  url?: string;
  shared_with?: string[];
  settings: {
    include_photos: boolean;
    include_journals: boolean;
    include_assessments: boolean;
    format: ExportFormat;
  };
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateProfileRequest {
  name: string;
  age: number;
  grade: number;
  state: string;
  subjects_parent_covers: string[];
  subjects_to_cover: string[];
  learning_style: LearningStyle;
  reading_level: number;
  time_budget_minutes_per_day: number;
  interests: string[];
}

export interface GenerateCurriculumRequest {
  student_profile_id: string;
  trip_scenario_id: string;
  trip_version_id?: string;
  subjects: string[];
  preferences?: {
    experiential_ratio: number;
    daily_time_minutes: number;
    include_threads: boolean;
    thread_count?: number;
  };
}

export interface GenerateCurriculumResponse {
  job_id: string;
  status: 'queued' | 'processing';
  estimated_completion_seconds: number;
}

export interface CurriculumGenerationStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress_percentage: number;
  current_step: string;
  curriculum_plan_id?: string;
  error?: string;
}

export interface ActivityCompletionRequest {
  status: ActivityStatus;
  time_spent_minutes?: number;
  completion_checked?: boolean;
  rubric_scores?: Record<string, number>;
  notes?: string;
}

export interface DailyLogRequest {
  plan_id: string;
  date: string;
  location_id: string;
  activities_completed: string[];
  time_spent_minutes: number;
  highlights: string;
  challenges?: string;
  parent_notes?: string;
}

export interface ProgressSummaryResponse {
  overall_completion: number;
  subject_breakdown: Record<string, SubjectProgress>;
  recent_activities: LearningActivity[];
  upcoming_deadlines: Task[];
  on_track: boolean;
  recommendations: string[];
}

export interface AddArtifactRequest {
  type: 'journal' | 'essay' | 'photo' | 'project';
  data: any;
  tags?: string[];
  educational_context?: string;
}

export interface ExportPortfolioRequest {
  type: ExportType;
  settings: {
    include_photos: boolean;
    include_journals: boolean;
    include_assessments: boolean;
    format: ExportFormat;
  };
}

export interface ShareCurriculumRequest {
  recipient_email: string;
  recipient_name: string;
  message?: string;
  include_progress: boolean;
  include_portfolio: boolean;
}

export interface ShareCurriculumResponse {
  share_id: string;
  share_url: string;
  expires_at?: Date;
}
