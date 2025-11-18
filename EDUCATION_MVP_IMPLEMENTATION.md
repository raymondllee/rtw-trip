# Education System MVP - Implementation Status

## Overview

Building a location-based homeschool curriculum generator that transforms the RTW trip itinerary into a comprehensive educational plan for Maya (age 14, 8th grade).

## Phase 1: Foundation ✅ IN PROGRESS

### Completed ✓

1. **Firestore Collections** ✓
   - Documented 5 new collections in `FIRESTORE_SETUP.md`:
     - `student_profiles/` - Student information and preferences
     - `curriculum_plans/` - Generated curriculum plans
     - `learning_activities/` - Individual activities and lessons
     - `progress_tracking/` - Completion tracking
     - `portfolios/` - Student work artifacts
   - Updated security rules

2. **TypeScript Type Definitions** ✓
   - Created `web/src/types/education.ts`
   - 50+ TypeScript interfaces covering all data models
   - Matches planning document exactly
   - Includes API request/response types

3. **Python Type Definitions** ✓
   - Created `python/agents/travel-concierge/travel_concierge/shared_libraries/education_types.py`
   - TypedDict classes for all models
   - Enums for type safety
   - Matches TypeScript types exactly

### Next Steps - Backend Implementation

#### 4. Flask API Endpoints (Pending)

**File**: `python/agents/travel-concierge/api_server.py`

Need to add:

```python
# Student Profile endpoints
@app.route('/api/education/profile', methods=['POST', 'GET'])
@app.route('/api/education/profile/<profile_id>', methods=['GET', 'PUT', 'DELETE'])

# Curriculum Generation endpoints
@app.route('/api/education/curriculum/generate', methods=['POST'])
@app.route('/api/education/curriculum/generate/<job_id>', methods=['GET'])
@app.route('/api/education/curriculum/<plan_id>', methods=['GET', 'PUT'])

# Progress Tracking endpoints
@app.route('/api/education/progress/<plan_id>', methods=['GET'])
@app.route('/api/education/progress/activity/<activity_id>', methods=['POST'])
@app.route('/api/education/progress/daily-log', methods=['POST'])
```

**Services Needed**:
- `EducationService` - Business logic for curriculum management
- `FirestoreEducationRepository` - Database operations
- `CurriculumGenerator` - Background job for generating curriculum

#### 5. ADK Tools for AI Generation (Pending)

**File**: `python/agents/travel-concierge/travel_concierge/tools/education_tools.py`

Need to create:

```python
@tool
def generate_curriculum_for_location(
    location_name: str,
    country: str,
    duration_days: int,
    student_age: int,
    student_grade: int,
    subjects: list[str]
) -> dict:
    """Generate location-specific educational content using Gemini."""

@tool
def suggest_thematic_threads(
    locations: list[dict],
    subjects: list[str],
    student_interests: list[str]
) -> list[dict]:
    """Analyze itinerary and suggest thematic learning threads."""

@tool
def generate_daily_menu(
    location: dict,
    date: str,
    subjects: list[str],
    time_budget_minutes: int
) -> dict:
    """Generate daily learning menu with activity options."""
```

**Prompt Templates**:
- Curriculum analysis prompt
- Location content generation prompt
- Thematic thread generation prompt
- Daily menu generation prompt
- Assessment rubric generation prompt

### Next Steps - Frontend Implementation

#### 6. Education Tab & Navigation (Pending)

**Files to create/modify**:
- `web/src/components/Education/` (new directory)
- `web/index.html` - Add "Education" tab to navigation
- `web/main.js` - Add education mode routing

#### 7. Student Profile Creation Form (Pending)

**Component**: `web/src/components/Education/ProfileForm.js`

Form fields:
- Student name, age, grade
- State, learning style
- Subjects parent covers (checkboxes)
- Subjects to generate (checkboxes)
- Time budget slider
- Interests (tag input)

#### 8. Curriculum Generation Wizard (Pending)

**Components**:
- `web/src/components/Education/GenerationWizard.js`
- `web/src/components/Education/GenerationProgress.js`

Flow:
1. Link to trip scenario
2. Configure generation settings
3. Show generation progress (polling)
4. Display success and redirect to dashboard

#### 9. Curriculum Dashboard (Pending)

**Component**: `web/src/components/Education/Dashboard.js`

Views:
- Overview (progress, subjects, threads)
- Timeline (week-by-week)
- Location detail (daily menus)
- Activity detail modal

## File Structure

```
rtw-trip/
├── FIRESTORE_SETUP.md                    # ✅ Updated with education collections
├── EDUCATION_MVP_IMPLEMENTATION.md       # ✅ This file
│
├── web/
│   └── src/
│       └── types/
│           └── education.ts              # ✅ TypeScript types
│
├── python/
│   └── agents/
│       └── travel-concierge/
│           ├── api_server.py             # ⏳ Need to add education endpoints
│           ├── travel_concierge/
│           │   ├── shared_libraries/
│           │   │   └── education_types.py   # ✅ Python types
│           │   ├── services/
│           │   │   └── education_service.py # ❌ Need to create
│           │   ├── repositories/
│           │   │   └── firestore_education.py # ❌ Need to create
│           │   └── tools/
│           │       └── education_tools.py   # ❌ Need to create
│           └── background_jobs/
│               └── curriculum_generator.py  # ❌ Need to create
```

## Testing Plan

Once implementation complete:

1. **Unit Tests**
   - Test each API endpoint
   - Test Firestore operations
   - Test curriculum generation logic

2. **Integration Tests**
   - Create student profile via API
   - Generate curriculum for actual RTW trip
   - Verify content quality and standards alignment

3. **E2E Test**
   - Full flow: Profile → Generate → View Dashboard → Mark activities complete → Export portfolio

## Estimated Implementation Time

- Backend (Flask + ADK): 4-6 hours
- Frontend (React components): 6-8 hours
- Testing & refinement: 2-3 hours
- **Total: 12-17 hours**

## Success Criteria

✅ Can create student profile for Maya
✅ Can generate semester overview from 43-stop itinerary
✅ Content is age-appropriate and relevant
✅ Covers Science + Social Studies subjects
✅ Can view curriculum in dashboard
✅ Can mark activities as complete
✅ Can export portfolio for school

## Next Steps

1. **Implement Flask API endpoints** for student profiles and curriculum generation
2. **Create ADK tools** with Gemini prompts for content generation
3. **Build frontend components** starting with student profile form
4. **Test curriculum generation** with first 3 destinations
5. **Iterate on content quality** based on output

---

## Questions to Consider

Before continuing with full implementation:

1. **AI Content Quality**: Should we generate a sample curriculum for 1-2 locations first to validate the prompts work well?

2. **Background Jobs**: Curriculum generation takes 2-3 minutes. Do we need a proper background job system (Celery, Redis) or is polling a simple in-memory job sufficient for MVP?

3. **Firestore vs Firebase Storage**: For portfolio photos/files, should we use Firebase Storage (better for large files) or embed URLs in Firestore?

4. **Development Workflow**: Want me to implement backend first (can test with API calls), then frontend? Or build them in parallel?

5. **Khan Academy Integration**: Save this for Phase 2, or try to integrate the Khan Academy API now?

---

**Ready to continue with implementation? Let me know if you want me to proceed with the backend, or if you'd like to review/adjust anything first!**
