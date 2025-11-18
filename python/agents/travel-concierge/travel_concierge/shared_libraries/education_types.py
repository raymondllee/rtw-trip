"""
Education System Type Definitions

Type definitions for the homeschool curriculum generation system.
Matches the TypeScript types in web/src/types/education.ts
"""

from datetime import datetime
from typing import TypedDict, Literal, Optional, List, Dict, Any
from enum import Enum


# ============================================
# ENUMS
# ============================================

class LearningStyle(str, Enum):
    EXPERIENTIAL = "experiential"
    STRUCTURED = "structured"
    MIXED = "mixed"


class ActivityType(str, Enum):
    EXPERIENTIAL = "experiential"
    STRUCTURED = "structured"
    READING = "reading"
    VIDEO = "video"
    ASSIGNMENT = "assignment"
    REFLECTION = "reflection"


class ActivityTiming(str, Enum):
    PRE_TRIP = "pre_trip"
    ON_LOCATION = "on_location"
    POST_TRIP = "post_trip"
    FLEXIBLE = "flexible"


class ActivityStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class EnergyLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CurriculumStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class PortfolioStatus(str, Enum):
    BUILDING = "building"
    FINALIZED = "finalized"
    SHARED = "shared"


class AssessmentType(str, Enum):
    CHECKBOX = "checkbox"
    RUBRIC = "rubric"
    SELF_REFLECTION = "self_reflection"
    PARENT_REVIEW = "parent_review"


class ResourceType(str, Enum):
    BOOK = "book"
    ARTICLE = "article"
    VIDEO = "video"
    PODCAST = "podcast"
    WEBSITE = "website"
    KHAN_ACADEMY = "khan_academy"
    APP = "app"


class PromptType(str, Enum):
    JOURNAL = "journal"
    DISCUSSION = "discussion"
    ESSAY = "essay"
    CREATIVE = "creative"


class ExportType(str, Enum):
    PDF = "pdf"
    WEB = "web"
    SLIDESHOW = "slideshow"


class ExportFormat(str, Enum):
    CHRONOLOGICAL = "chronological"
    BY_SUBJECT = "by_subject"
    BY_THREAD = "by_thread"


# ============================================
# STUDENT PROFILE
# ============================================

class StudentProfile(TypedDict, total=False):
    # Identity
    id: str
    name: str
    created_at: datetime
    updated_at: datetime

    # Demographics
    age: int
    grade: int
    grade_level_description: Optional[str]
    state: str
    country: str

    # Curriculum Configuration
    subjects_parent_covers: List[str]
    subjects_to_cover: List[str]

    # Learning Preferences
    learning_style: LearningStyle
    reading_level: int
    time_budget_minutes_per_day: int

    # Interests
    interests: List[str]

    # Standards & Requirements
    educational_standards: List[str]
    required_subjects: List[str]

    # Linked trips
    active_trip_id: Optional[str]
    curriculum_plan_id: Optional[str]

    # Privacy
    parent_email: Optional[str]
    school_name: Optional[str]
    school_contact: Optional[str]


# ============================================
# RESOURCES & ASSESSMENTS
# ============================================

class Resource(TypedDict, total=False):
    type: ResourceType
    title: str
    author: Optional[str]
    url: Optional[str]
    isbn: Optional[str]
    duration_minutes: Optional[int]
    cost_usd: Optional[float]
    required: bool
    age_appropriate: bool
    lexile_level: Optional[int]
    notes: Optional[str]
    khan_academy_id: Optional[str]
    khan_academy_url: Optional[str]


class RubricLevel(TypedDict):
    score: int
    descriptor: str
    example: Optional[str]


class RubricCriterion(TypedDict):
    name: str
    description: str
    levels: List[RubricLevel]


class Rubric(TypedDict):
    criteria: List[RubricCriterion]
    total_possible: int


class Assessment(TypedDict, total=False):
    type: Literal['quiz', 'project', 'presentation', 'essay', 'portfolio']
    title: str
    description: str
    rubric: Optional[Rubric]
    due_date: Optional[str]
    weight: Optional[float]


class Task(TypedDict):
    title: str
    description: str
    due_date: Optional[str]
    estimated_duration_minutes: int
    completion_criteria: str


class Prompt(TypedDict):
    text: str
    type: PromptType
    word_count_target: Optional[int]


# ============================================
# LEARNING ACTIVITIES
# ============================================

class ActivityInstructions(TypedDict, total=False):
    before: Optional[str]
    during: Optional[str]
    after: Optional[str]
    materials_needed: Optional[List[str]]
    location_specific_notes: Optional[str]


class ActivityAssessment(TypedDict, total=False):
    type: AssessmentType
    rubric: Optional[Rubric]
    completion_criteria: Optional[str]


class LearningActivity(TypedDict, total=False):
    # Identity
    id: str
    curriculum_plan_id: str
    location_id: Optional[str]
    thread_id: Optional[str]

    # Classification
    type: ActivityType
    subject: str
    timing: ActivityTiming

    # Content
    title: str
    description: str
    learning_objectives: List[str]

    # Logistics
    estimated_duration_minutes: int
    difficulty: Difficulty
    prerequisites: Optional[List[str]]

    # Instructions
    instructions: ActivityInstructions

    # Resources
    resources: List[Resource]

    # Assessment
    assessment: Optional[ActivityAssessment]

    # Metadata
    created_at: datetime
    ai_generated: bool
    customized: bool
    source: Optional[str]


class Lesson(TypedDict):
    title: str
    subject: str
    objectives: List[str]
    resources: List[Resource]
    activities: List[str]  # Activity IDs
    estimated_duration_minutes: int
    homework: Optional[str]


class MenuOption(TypedDict):
    id: str
    title: str
    type: ActivityType
    subjects_covered: List[str]
    estimated_duration_minutes: int
    activities: List[str]  # Activity IDs
    energy_level: EnergyLevel
    weather_dependent: bool


class DailyLearningMenu(TypedDict, total=False):
    date: str
    location_id: str
    options: List[MenuOption]
    completed_option_ids: Optional[List[str]]
    completion_notes: Optional[str]


class ScavengerHunt(TypedDict):
    items: List[str]
    educational_purpose: str


class FieldTripGuide(TypedDict, total=False):
    site_name: str
    location_id: str
    place_id: Optional[str]
    subjects: List[str]
    key_concepts: List[str]
    before: Dict[str, Any]  # readings, guiding_questions
    during: Dict[str, Any]  # observation_prompts, photo_assignments, etc.
    after: Dict[str, Any]   # reflection_prompts, research_tasks, etc.


# ============================================
# CURRICULUM PLAN
# ============================================

class WeeklyOutline(TypedDict):
    week_number: int
    dates: Dict[str, str]  # start, end
    locations: List[str]
    focus_topics: List[str]
    estimated_hours: float


class SubjectPlan(TypedDict):
    subject: str
    grade_level: int
    learning_goals: List[str]
    standards_addressed: List[str]
    core_resources: List[Resource]
    supplemental_resources: List[Resource]
    assessment_plan: Dict[str, List[Assessment]]  # formative, summative
    weekly_outline: List[WeeklyOutline]


class Semester(TypedDict):
    title: str
    start_date: str
    end_date: str
    total_weeks: int
    total_destinations: int
    subjects: Dict[str, SubjectPlan]


class SubjectCoverage(TypedDict):
    topics: List[str]
    activities: List[str]
    estimated_hours: float


class LocationLearning(TypedDict, total=False):
    location_id: str
    location_name: str
    arrival_date: str
    departure_date: str
    duration_days: int
    pre_trip: Dict[str, Any]
    on_location: Dict[str, Any]
    post_trip: Dict[str, Any]
    subject_coverage: Dict[str, SubjectCoverage]


class ThreadLocation(TypedDict):
    location_id: str
    sequence_number: int
    focus: str
    activities: List[str]


class CulminatingProject(TypedDict, total=False):
    title: str
    description: str
    type: Literal['essay', 'presentation', 'portfolio', 'creative']
    rubric: Optional[Rubric]
    due_date: Optional[str]


class Thread(TypedDict):
    id: str
    title: str
    description: str
    subject: str
    locations: List[ThreadLocation]
    culminating_project: CulminatingProject


class StandardCoverage(TypedDict):
    description: str
    covered_by: List[str]
    status: ActivityStatus


class Customization(TypedDict):
    timestamp: datetime
    field_path: str
    old_value: Any
    new_value: Any
    user_note: Optional[str]


class CurriculumPlan(TypedDict, total=False):
    # Identity
    id: str
    student_profile_id: str
    trip_scenario_id: str
    trip_version_id: Optional[str]

    # Metadata
    created_at: datetime
    updated_at: datetime
    generated_at: datetime
    status: CurriculumStatus

    # Semester Overview
    semester: Semester

    # Location-Based Learning
    location_lessons: Dict[str, LocationLearning]

    # Thematic Threads
    thematic_threads: List[Thread]

    # Standards Tracking
    standards_coverage: Dict[str, StandardCoverage]

    # Generation metadata
    ai_model_used: str
    generation_prompt_hash: Optional[str]
    customizations: Optional[List[Customization]]


# ============================================
# PROGRESS TRACKING
# ============================================

class ActivityProgress(TypedDict, total=False):
    status: ActivityStatus
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    time_spent_minutes: Optional[int]
    completion_checked: bool
    rubric_scores: Optional[Dict[str, float]]
    self_reflection: Optional[str]
    parent_notes: Optional[str]
    photos: Optional[List[str]]
    writing_samples: Optional[List[str]]
    attachments: Optional[List[str]]


class DailyLog(TypedDict, total=False):
    location_id: str
    activities_completed: List[str]
    time_spent_minutes: int
    energy_level: EnergyLevel
    highlights: str
    challenges: str
    parent_notes: Optional[str]


class SubjectProgress(TypedDict):
    hours_completed: float
    standards_met: List[str]
    standards_in_progress: List[str]
    standards_not_started: List[str]


class ThreadProgress(TypedDict, total=False):
    locations_completed: int
    locations_total: int
    current_location_id: Optional[str]
    culminating_project_status: ActivityStatus


class ProgressSummary(TypedDict):
    total_hours: float
    activities_completed: int
    activities_total: int
    completion_percentage: float
    on_track: bool
    last_updated: datetime


class ProgressTracking(TypedDict):
    id: str
    student_profile_id: str
    curriculum_plan_id: str
    activity_progress: Dict[str, ActivityProgress]
    daily_logs: Dict[str, DailyLog]
    subject_progress: Dict[str, SubjectProgress]
    thread_progress: Dict[str, ThreadProgress]
    summary: ProgressSummary


# ============================================
# PORTFOLIO
# ============================================

class JournalEntry(TypedDict, total=False):
    date: str
    location: str
    entry: str
    photos: Optional[List[str]]


class Essay(TypedDict, total=False):
    title: str
    subject: str
    activity_id: Optional[str]
    content: str
    date_written: str
    rubric_score: Optional[float]


class PhotoArtifact(TypedDict):
    url: str
    caption: str
    location: str
    date: str
    educational_context: str


class Project(TypedDict):
    title: str
    type: str
    subject: str
    description: str
    files: List[str]
    created_date: str


class PortfolioArtifacts(TypedDict, total=False):
    journals: List[JournalEntry]
    essays: List[Essay]
    photos: List[PhotoArtifact]
    projects: List[Project]
    videos: Optional[List[Any]]
    presentations: Optional[List[Any]]
    other: Optional[List[Any]]


class OrganizedArtifacts(TypedDict, total=False):
    artifacts: List[str]
    narrative: Optional[str]
    highlights: Optional[List[str]]
    synthesis: Optional[str]


class StandardEvidence(TypedDict):
    description: str
    evidence_artifacts: List[str]
    notes: str


class PortfolioExportSettings(TypedDict):
    include_photos: bool
    include_journals: bool
    include_assessments: bool
    format: ExportFormat


class PortfolioExport(TypedDict, total=False):
    id: str
    type: ExportType
    created_at: datetime
    url: Optional[str]
    shared_with: Optional[List[str]]
    settings: PortfolioExportSettings


class Portfolio(TypedDict, total=False):
    id: str
    student_profile_id: str
    curriculum_plan_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    status: PortfolioStatus
    artifacts: PortfolioArtifacts
    organized_by_subject: Dict[str, OrganizedArtifacts]
    organized_by_location: Dict[str, OrganizedArtifacts]
    organized_by_thread: Dict[str, OrganizedArtifacts]
    standards_evidence: Dict[str, StandardEvidence]
    exports: List[PortfolioExport]


# ============================================
# API REQUEST/RESPONSE TYPES
# ============================================

class CreateProfileRequest(TypedDict):
    name: str
    age: int
    grade: int
    state: str
    subjects_parent_covers: List[str]
    subjects_to_cover: List[str]
    learning_style: LearningStyle
    reading_level: int
    time_budget_minutes_per_day: int
    interests: List[str]


class CurriculumPreferences(TypedDict, total=False):
    experiential_ratio: float
    daily_time_minutes: int
    include_threads: bool
    thread_count: Optional[int]


class GenerateCurriculumRequest(TypedDict, total=False):
    student_profile_id: str
    trip_scenario_id: str
    trip_version_id: Optional[str]
    subjects: List[str]
    preferences: Optional[CurriculumPreferences]


class GenerateCurriculumResponse(TypedDict):
    job_id: str
    status: Literal['queued', 'processing']
    estimated_completion_seconds: int


class CurriculumGenerationStatus(TypedDict, total=False):
    job_id: str
    status: Literal['queued', 'processing', 'completed', 'failed']
    progress_percentage: float
    current_step: str
    curriculum_plan_id: Optional[str]
    error: Optional[str]


class ActivityCompletionRequest(TypedDict, total=False):
    status: ActivityStatus
    time_spent_minutes: Optional[int]
    completion_checked: Optional[bool]
    rubric_scores: Optional[Dict[str, float]]
    notes: Optional[str]


class DailyLogRequest(TypedDict, total=False):
    plan_id: str
    date: str
    location_id: str
    activities_completed: List[str]
    time_spent_minutes: int
    highlights: str
    challenges: Optional[str]
    parent_notes: Optional[str]


class ProgressSummaryResponse(TypedDict):
    overall_completion: float
    subject_breakdown: Dict[str, SubjectProgress]
    recent_activities: List[LearningActivity]
    upcoming_deadlines: List[Task]
    on_track: bool
    recommendations: List[str]


class AddArtifactRequest(TypedDict, total=False):
    type: Literal['journal', 'essay', 'photo', 'project']
    data: Any
    tags: Optional[List[str]]
    educational_context: Optional[str]


class ExportPortfolioRequest(TypedDict):
    type: ExportType
    settings: PortfolioExportSettings


class ShareCurriculumRequest(TypedDict, total=False):
    recipient_email: str
    recipient_name: str
    message: Optional[str]
    include_progress: bool
    include_portfolio: bool


class ShareCurriculumResponse(TypedDict, total=False):
    share_id: str
    share_url: str
    expires_at: Optional[datetime]
