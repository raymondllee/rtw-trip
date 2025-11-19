# Education Dashboard

A dedicated interface for managing students, curricula, and testing educational features in the RTW Trip Planner.

## Overview

The Education Dashboard provides a centralized interface to:
- **Manage student profiles** - Create and view student learners
- **Track curricula** - View, filter, and manage all generated curricula
- **Test curriculum generation** - Experiment with AI curriculum generation without saving

## Files

- **`web/education-dashboard.html`** - Main dashboard page
- **`web/education-dashboard.css`** - Dashboard styles
- **`web/src/education/educationDashboard.ts`** - Dashboard functionality
- **`web/src/education/educationService.ts`** - API service (existing)

## Features

### 1. Students View

**Purpose**: Manage student profiles and view their learning progress

**Features**:
- View all student profiles as cards
- See completion percentage and statistics for each student
- Create new student profiles
- Quick access to student's curricula
- Generate curriculum for a specific student

**Student Card Shows**:
- Name, age, grade, state
- Overall completion percentage
- Number of curricula
- Total hours logged (when progress tracking is implemented)
- Total activities across all curricula

### 2. Curriculum Manager

**Purpose**: Central hub for viewing and managing all curricula

**Features**:
- View all curricula across all students
- Filter by:
  - Student
  - Location
  - Status (draft, active, completed, archived)
- Sort by:
  - Most recent
  - Oldest first
  - Location
- Search by title or location name
- View curriculum details in modal
- Export curriculum as JSON

**Curriculum Card Shows**:
- Semester title
- Location names
- Status badge
- Date range and duration
- Activity count
- Subjects covered
- Action buttons (View Details, Export)

### 3. Testing Lab

**Purpose**: Test curriculum generation with different parameters without affecting student profiles

**Features**:
- **Student Profile Section**:
  - Name, age, grade, state
  - Learning style (experiential, structured, mixed)
  - Interests (comma-separated)
  - Time budget and reading level

- **Location Section**:
  - Location name and country
  - Duration in days
  - Highlights (comma-separated)

- **Generation Options**:
  - Subject selection (science, social studies, language arts, math, art, music)
  - Time budget per day
  - Reading level

- **Results Preview**:
  - Generation statistics (total, pre-trip, on-location, post-trip activities)
  - Activity previews
  - Options to:
    - Save to student profile
    - Download as JSON
    - View full curriculum details

## Usage

### Accessing the Dashboard

1. Open your browser to the RTW Trip Planner
2. Navigate to `http://localhost:8000/education-dashboard.html`
3. Or click "Education Hub" link from the main app (if added)

### Creating a Student

1. Click **"+ New Student"** button
2. Fill in required fields:
   - Name
   - Age
   - Grade
   - State
   - Learning Style
3. Optional fields:
   - Interests
   - Time budget per day
   - Reading level
4. Click **"Create Student"**

### Generating a Curriculum

**Option A - From Testing Lab**:
1. Go to "Testing Lab" tab
2. Fill in student profile and location details
3. Select subjects
4. Click **"🚀 Generate Test Curriculum"**
5. Wait 30-60 seconds for AI generation
6. Review results
7. Click **"💾 Save to Student"** to save it

**Option B - From Student Card**:
1. Go to "Students" tab
2. Click **"+ Generate"** on a student card
3. Testing lab will pre-fill with student info
4. Add location details and generate

### Viewing Curricula

1. Go to "Curriculum Manager" tab
2. Use filters to narrow down results:
   - Select a student to see only their curricula
   - Select a location to see curricula for that destination
   - Filter by status
3. Click **"View Details"** to see full curriculum
4. Click **"Export"** to download JSON

### Managing Curricula

**View Details**:
- Click "View Details" on any curriculum card
- Modal shows:
  - Curriculum metadata
  - Activities by location
  - Pre-trip, on-location, and post-trip breakdown

**Export**:
- Click "Export" to download curriculum as JSON
- File format: `curriculum_{id}.json`
- Can be used for:
  - Backup
  - Sharing with educators
  - Analysis
  - Re-importing (future feature)

## API Endpoints Used

The dashboard uses the following API endpoints:

### Students
- **`GET /api/education/students`** - List all students
- **`POST /api/education/students`** - Create new student
- **`GET /api/education/students/{id}/curricula`** - Get student's curricula

### Curricula
- **`GET /api/education/curricula`** - List all curricula with filters
- **`GET /api/education/curricula/{id}`** - Get specific curriculum
- **`POST /api/education/test/generate-curriculum`** - Generate curriculum

## Testing Workflow

### Test Scenario 1: Create Student and Generate Curriculum

1. **Create a test student**:
   - Name: "Maya"
   - Age: 14
   - Grade: 8
   - State: California
   - Learning Style: Experiential
   - Interests: "marine biology, photography, architecture"

2. **Generate curriculum**:
   - Click "+ Generate" on Maya's card
   - Location: Tokyo, Japan
   - Duration: 23 days
   - Highlights: "Modern technology, ancient temples, sushi culture"
   - Subjects: Science, Social Studies, Language Arts
   - Click "Generate"

3. **Review results**:
   - Check activity counts
   - Preview sample activities
   - View full curriculum details

4. **Verify in Curriculum Manager**:
   - Switch to "Curriculum Manager" tab
   - Filter by student "Maya"
   - Should see new curriculum

### Test Scenario 2: Testing Lab Experimentation

1. Go to "Testing Lab"
2. Generate curriculum for:
   - Student: Different age/grade combinations
   - Locations: Various countries and durations
   - Subjects: Different subject combinations
3. Compare results:
   - Download multiple results as JSON
   - Analyze which prompts work best
   - Iterate on student profiles

## UI Components

### Navigation
- **Header**: Contains "Education Hub" title and action buttons
- **Tabs**: Switch between Students, Curriculum Manager, Testing Lab
- **Active state**: Highlighted tab with blue underline

### Cards
- **Student Cards**: Grid layout, hover effect, progress bars
- **Curriculum Cards**: List layout, status badges, metadata
- **Activity Preview**: Compact cards with title, description, metadata

### Modals
- **New Student Modal**: Form to create student profile
- **Curriculum Detail Modal**: Full curriculum view with tabs
- **Loading Overlay**: Shows during API calls with spinner

### Forms
- **Testing Lab Form**: Multi-section form with student, location, options
- **Validation**: HTML5 validation for required fields
- **Radio/Checkbox Groups**: For learning style and subjects

## Styling

The dashboard uses a modern, clean design with:

- **Color Scheme**:
  - Primary: Blue (#4A90E2)
  - Success: Green (#28a745)
  - Warning: Yellow (#ffc107)
  - Danger: Red (#dc3545)

- **Layout**:
  - Max width: 1400px
  - Responsive grid system
  - Mobile-friendly (stacks on small screens)

- **Typography**:
  - System font stack (-apple-system, Segoe UI, etc.)
  - Clear hierarchy (h1: 28px, h2: 24px, h3: 18px)

- **Spacing**:
  - Consistent spacing scale (4px, 8px, 16px, 24px, 32px)
  - Card padding: 24px
  - Grid gaps: 24px

## Future Enhancements

### Phase 2 - Progress Tracking
- Mark activities as complete
- Log time spent
- Add notes and photos
- Track daily learning

### Phase 3 - Portfolio Management
- Upload student work
- Organize by subject/location
- Generate PDF portfolios
- Share with educators

### Phase 4 - Analytics
- Time spent per subject
- Completion trends over time
- Standards coverage reports
- Learning insights

### Phase 5 - Collaboration
- Share curricula with other parents/teachers
- Comments and feedback
- Curriculum templates
- Community sharing

### Phase 6 - Mobile App
- Native mobile app for on-the-go logging
- Offline support
- Photo upload from phone
- Quick activity check-off

## Troubleshooting

### Dashboard doesn't load
- Check that API server is running on port 5001
- Open browser console for errors
- Verify Firestore credentials are configured

### Students don't appear
- Check Firestore connection
- Verify `student_profiles` collection exists
- Check browser console for API errors

### Curriculum generation fails
- Verify `GOOGLE_API_KEY` is set
- Check API server logs
- Ensure Gemini API quota is not exceeded
- Verify location data is properly formatted

### Filters don't work
- Check that curricula are loaded
- Verify filter values match data
- Clear filters and try again

### Export doesn't download
- Check browser download settings
- Verify curriculum data is loaded
- Try a different browser

## Development

### Local Development

```bash
# Start API server
cd python/agents/travel-concierge
python api_server.py

# Start web server
cd web
python -m http.server 8000

# Open dashboard
open http://localhost:8000/education-dashboard.html
```

### TypeScript Compilation

```bash
cd web
# If you need to compile TypeScript
npx tsc src/education/educationDashboard.ts --outDir dist
```

### Adding New Features

1. **HTML**: Add UI components to `education-dashboard.html`
2. **CSS**: Add styles to `education-dashboard.css`
3. **TypeScript**: Add functionality to `educationDashboard.ts`
4. **API**: Add endpoints to `api_server.py`

## Related Documentation

- **`EDUCATION_MVP_IMPLEMENTATION.md`** - Education feature overview
- **`FIRESTORE_SETUP.md`** - Database schema
- **`EDUCATION_API.md`** - API reference
- **`EDUCATION_INTEGRATION.md`** - Integration guide

## Support

For issues or questions:
1. Check this documentation
2. Review browser console errors
3. Check API server logs
4. File an issue in the project repository
