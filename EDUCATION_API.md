# Education System API Reference

This document describes the API endpoints for the education/curriculum system.

## Base URL

```
http://localhost:5001
```

## Endpoints

### Generate Curriculum

**POST** `/api/education/test/generate-curriculum`

Generate curriculum for a specific location using AI.

**Request Body:**
```json
{
  "student": {
    "id": "student_abc123",  // Optional - reuses existing student
    "name": "Maya",
    "age": 14,
    "grade": 8,
    "state": "California",
    "learning_style": "experiential",
    "time_budget_minutes_per_day": 60,
    "reading_level": 10,
    "interests": ["marine_biology", "photography"]
  },
  "location": {
    "id": "tokyo_japan",
    "name": "Tokyo",
    "country": "Japan",
    "region": "East Asia",
    "duration_days": 23,
    "arrival_date": "2025-11-01",
    "departure_date": "2025-11-23",
    "activity_type": "cultural exploration",
    "highlights": ["Technology", "Temples", "Food"],
    "trip_scenario_id": "scenario_123",  // Optional - links to trip
    "trip_version_id": "version_456"     // Optional - links to version
  },
  "subjects": ["science", "social_studies", "language_arts"]
}
```

**Response:**
```json
{
  "status": "success",
  "curriculum": { /* Generated curriculum */ },
  "metadata": {
    "model_used": "gemini-2.0-flash-exp",
    "generation_time": "2025-11-18T10:30:00Z"
  },
  "saved_ids": {
    "student_profile_id": "student_abc123",
    "curriculum_plan_id": "plan_def456",
    "activity_ids": ["activity_1", "activity_2", ...],
    "total_activities": 12,
    "location_id": "tokyo_japan"
  }
}
```

**Notes:**
- Automatically saves to Firestore (student_profiles, curriculum_plans, learning_activities)
- If trip_scenario_id and trip_version_id provided, adds curriculum reference to location

---

### List Curricula

**GET** `/api/education/curricula`

Get all curriculum plans with optional filters.

**Query Parameters:**
- `student_id` - Filter by student profile ID
- `location_id` - Filter by location ID
- `country` - Filter by country name
- `status` - Filter by status (draft, active, completed, archived)
- `limit` - Max results (default: 50)

**Examples:**
```bash
# Get all curricula
GET /api/education/curricula

# Get curricula for a specific student
GET /api/education/curricula?student_id=student_abc123

# Get curricula for Japan
GET /api/education/curricula?country=Japan

# Get active curricula
GET /api/education/curricula?status=active

# Combined filters
GET /api/education/curricula?student_id=student_abc123&country=Japan&limit=10
```

**Response:**
```json
{
  "status": "success",
  "count": 5,
  "curricula": [
    {
      "id": "plan_def456",
      "student_profile_id": "student_abc123",
      "location_id": "tokyo_japan",
      "location_name": "Tokyo",
      "country": "Japan",
      "region": "East Asia",
      "status": "draft",
      "created_at": "2025-11-18T10:30:00Z",
      "ai_model_used": "gemini-2.0-flash-exp",
      "semester": { /* Semester details */ },
      "location_lessons": { /* Location-based lessons */ }
    },
    ...
  ]
}
```

---

### Get Curriculum by ID

**GET** `/api/education/curricula/<plan_id>`

Get a specific curriculum plan by its ID.

**Example:**
```bash
GET /api/education/curricula/plan_def456
```

**Response:**
```json
{
  "status": "success",
  "curriculum": {
    "id": "plan_def456",
    "student_profile_id": "student_abc123",
    "location_id": "tokyo_japan",
    "location_name": "Tokyo",
    "country": "Japan",
    "status": "draft",
    "semester": { /* Semester overview */ },
    "location_lessons": {
      "tokyo_japan": {
        "location_id": "tokyo_japan",
        "location_name": "Tokyo",
        "duration_days": 23,
        "pre_trip": { /* Pre-trip content */ },
        "on_location": { /* On-location activities */ },
        "post_trip": { /* Post-trip reflections */ }
      }
    },
    "thematic_threads": [],
    "standards_coverage": {}
  }
}
```

---

### Get Curricula by Location

**GET** `/api/education/curricula/by-location/<location_id>`

Get all curricula generated for a specific location.

**Example:**
```bash
GET /api/education/curricula/by-location/tokyo_japan
```

**Response:**
```json
{
  "status": "success",
  "location_id": "tokyo_japan",
  "count": 2,
  "curricula": [
    { /* Curriculum 1 */ },
    { /* Curriculum 2 */ }
  ]
}
```

**Use Case:**
When viewing a trip location, show available curricula for that destination:
```javascript
// In your trip planning UI
const locationId = 'tokyo_japan';
const response = await fetch(`/api/education/curricula/by-location/${locationId}`);
const { curricula } = await response.json();

// Display: "3 curricula available for Tokyo"
```

---

### Get Student Curricula

**GET** `/api/education/students/<student_id>/curricula`

Get all curricula for a specific student, ordered by creation date (newest first).

**Example:**
```bash
GET /api/education/students/student_abc123/curricula
```

**Response:**
```json
{
  "status": "success",
  "student_id": "student_abc123",
  "count": 8,
  "curricula": [
    {
      "id": "plan_latest",
      "location_name": "Bali",
      "country": "Indonesia",
      "created_at": "2025-11-18T15:00:00Z",
      ...
    },
    {
      "id": "plan_older",
      "location_name": "Tokyo",
      "country": "Japan",
      "created_at": "2025-11-18T10:00:00Z",
      ...
    },
    ...
  ]
}
```

**Use Case:**
Build a student curriculum dashboard:
```javascript
const studentId = 'student_abc123';
const response = await fetch(`/api/education/students/${studentId}/curricula`);
const { curricula } = await response.json();

// Show student's learning journey across all destinations
```

---

## Relationships

The education system creates bidirectional relationships between trips and curricula:

### Trip → Curriculum

When curriculum is generated with `trip_scenario_id` and `trip_version_id`:

**TripLocation** (in scenarios collection):
```json
{
  "id": "tokyo_japan",
  "name": "Tokyo",
  "country": "Japan",
  "learning_moments": [ /* Educational opportunities */ ],
  "curriculum_plan_ids": ["plan_def456", "plan_xyz789"]  // ← Auto-added
}
```

### Curriculum → Trip

**CurriculumPlan** (in curriculum_plans collection):
```json
{
  "id": "plan_def456",
  "trip_scenario_id": "scenario_123",    // ← Links to trip
  "trip_version_id": "version_456",      // ← Links to version
  "location_id": "tokyo_japan",          // ← Links to location
  "country": "Japan",
  "location_lessons": {
    "tokyo_japan": { /* Lessons for Tokyo */ }
  }
}
```

### Querying Relationships

```javascript
// From trip location, get curricula
const locationId = location.id;
const curricula = await fetch(`/api/education/curricula/by-location/${locationId}`);

// From curriculum, get trip details
const curriculumPlan = await fetch(`/api/education/curricula/plan_def456`);
const tripScenarioId = curriculumPlan.trip_scenario_id;
const tripData = await fetch(`/api/scenarios/${tripScenarioId}/versions/${curriculumPlan.trip_version_id}`);

// Get all curricula for a country
const japanCurricula = await fetch(`/api/education/curricula?country=Japan`);
```

---

## Data Flow

### Generating Curriculum

```
1. POST /api/education/test/generate-curriculum
   ↓
2. Generate with Gemini AI
   ↓
3. Save to Firestore:
   - student_profiles/{studentId}
   - curriculum_plans/{planId}
   - learning_activities/{activityId} (for each activity)
   ↓
4. Update trip location (if trip IDs provided):
   - scenarios/{scenarioId}/versions/{versionId}
   - Add curriculum_plan_id to location
   ↓
5. Return IDs for saved documents
```

### Retrieving Curriculum

```
From Trip UI:
  → GET /api/education/curricula/by-location/{locationId}
  → Display available curricula for destination

From Student Dashboard:
  → GET /api/education/students/{studentId}/curricula
  → Display student's complete learning journey

From Curriculum Viewer:
  → GET /api/education/curricula/{planId}
  → Display full curriculum details
```

---

## Integration Examples

### Add "Education" Tab to Location View

```typescript
// In your trip location component
import { useState, useEffect } from 'react';

function LocationView({ location }) {
  const [curricula, setCurricula] = useState([]);

  useEffect(() => {
    if (location.id) {
      fetch(`/api/education/curricula/by-location/${location.id}`)
        .then(res => res.json())
        .then(data => setCurricula(data.curricula));
    }
  }, [location.id]);

  return (
    <div>
      <h2>{location.name}</h2>

      {/* Existing tabs: Overview, Costs, Transport */}

      {/* New: Education tab */}
      <Tab name="Education">
        {curricula.length > 0 ? (
          <div>
            <h3>{curricula.length} Curricula Available</h3>
            {curricula.map(curr => (
              <CurriculumCard key={curr.id} curriculum={curr} />
            ))}
          </div>
        ) : (
          <button onClick={() => generateCurriculum(location)}>
            Generate Curriculum for {location.name}
          </button>
        )}
      </Tab>
    </div>
  );
}
```

### Build Student Dashboard

```typescript
function StudentDashboard({ studentId }) {
  const [curricula, setCurricula] = useState([]);

  useEffect(() => {
    fetch(`/api/education/students/${studentId}/curricula`)
      .then(res => res.json())
      .then(data => setCurricula(data.curricula));
  }, [studentId]);

  // Group by country
  const byCountry = curricula.reduce((acc, curr) => {
    const country = curr.country || 'Other';
    if (!acc[country]) acc[country] = [];
    acc[country].push(curr);
    return acc;
  }, {});

  return (
    <div>
      <h1>Learning Journey</h1>
      {Object.entries(byCountry).map(([country, plans]) => (
        <div key={country}>
          <h2>{country}</h2>
          <p>{plans.length} locations</p>
          {plans.map(plan => (
            <CurriculumSummary key={plan.id} plan={plan} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## Error Handling

All endpoints return consistent error format:

```json
{
  "error": "Error message",
  "details": "Additional context"
}
```

**Common Status Codes:**
- `200` - Success
- `404` - Curriculum not found
- `500` - Server error (Firestore unavailable, AI generation failed, etc.)

---

## Future Enhancements

- [ ] PATCH `/api/education/curricula/<plan_id>` - Update curriculum
- [ ] DELETE `/api/education/curricula/<plan_id>` - Delete curriculum
- [ ] POST `/api/education/curricula/<plan_id>/activate` - Change status to active
- [ ] GET `/api/education/activities?curriculum_plan_id=<id>` - Get all activities for a plan
- [ ] POST `/api/education/generate-full-trip` - Generate curricula for all trip locations
