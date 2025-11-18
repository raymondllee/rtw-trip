# Education System Integration

This document explains how the education system integrates with trip planning, cost tracking, and itinerary management.

## Overview

The education system adds two key features to your travel planning:

1. **Learning Moments** - Educational opportunities at each destination
2. **Education Costs** - Track costs for educational materials and activities

## Learning Moments

Learning moments capture specific educational opportunities available at each destination. They help the curriculum generator create better, more specific lesson plans.

### What is a Learning Moment?

A learning moment is a specific educational experience at a destination:
- A museum visit (e.g., "Miraikan Science Museum robotics exhibit")
- A cultural activity (e.g., "Traditional batik workshop")
- A natural observation (e.g., "Coral reef snorkeling at Padang Bai")
- A historical site (e.g., "Sensoji Temple architecture study")
- An interaction (e.g., "Interview local fishermen at market")

### Structure

```typescript
{
  id: "learning_moment_123",
  subject: "science",                    // Academic subject
  title: "Coral Reef Ecosystem Study",
  description: "Snorkel at Padang Bai to observe coral reef biodiversity...",
  type: "observation",                   // site_visit, activity, experience, etc.
  location: "Padang Bai Beach, Bali",   // Specific location within destination
  estimated_duration_minutes: 180,
  estimated_cost_usd: 45,               // Gear rental + boat
  age_appropriate_min: 10,              // Minimum age: 10
  age_appropriate_max: null,            // No max age
  standards_addressed: [
    "CA-NGSS-MS-LS2-1",                 // Ecosystems: Interactions
    "CA-NGSS-MS-LS2-4"                  // Energy and matter transfer
  ],
  tags: ["hands-on", "outdoor", "marine-biology"]
}
```

### Subjects

- `science` - Natural sciences, biology, physics, chemistry
- `social_studies` - History, geography, civics, economics
- `language_arts` - Reading, writing, communication
- `art` - Visual arts, design, architecture
- `music` - Music theory, performance, cultural music
- `history` - Historical events, sites, artifacts
- `geography` - Physical geography, maps, navigation
- `culture` - Cultural practices, traditions, customs
- `general` - Multi-subject or general education

### Types

- `site_visit` - Visiting a specific location (museum, monument, etc.)
- `activity` - Participating in an activity (workshop, class, etc.)
- `experience` - Experiential learning (snorkeling, cooking, etc.)
- `observation` - Observing phenomena (markets, nature, etc.)
- `interaction` - Interacting with people (interviews, conversations)
- `research` - Research-based learning (library, archives, etc.)

### Adding to Locations

In your itinerary data:

```json
{
  "locations": [
    {
      "id": "bali_indonesia",
      "name": "Bali",
      "country": "Indonesia",
      "duration_days": 7,
      "highlights": [
        "Beautiful beaches",
        "Coral reefs",
        "Traditional culture"
      ],
      "learning_moments": [
        {
          "subject": "science",
          "title": "Marine Biodiversity at Padang Bai",
          "description": "Snorkel to observe coral reefs and fish species...",
          "type": "observation",
          "location": "Padang Bai",
          "estimated_duration_minutes": 180,
          "estimated_cost_usd": 45,
          "age_appropriate_min": 10,
          "tags": ["hands-on", "outdoor"]
        },
        {
          "subject": "culture",
          "title": "Balinese Temple Architecture",
          "description": "Study Hindu temple design at Tanah Lot...",
          "type": "site_visit",
          "location": "Tanah Lot Temple",
          "estimated_duration_minutes": 90,
          "estimated_cost_usd": 10,
          "age_appropriate_min": 8,
          "tags": ["cultural", "architecture"]
        }
      ]
    }
  ]
}
```

## Education Costs

Track costs for educational materials and activities separately from regular travel expenses.

### Cost Categories

Three new categories for education:

1. **`education`** - General educational expenses
2. **`educational_materials`** - Books, apps, subscriptions, supplies
3. **`educational_activities`** - Museum admissions, tours, classes, workshops

### Examples

#### Educational Materials

```json
{
  "id": "cost_materials_001",
  "category": "educational_materials",
  "description": "Marine biology field guide for Indonesia",
  "amount": 25,
  "currency": "USD",
  "amount_usd": 25,
  "date": "2025-08-15",
  "destination_id": "bali_indonesia",
  "booking_status": "paid",
  "source": "manual",
  "notes": "Purchased for coral reef studies"
}
```

```json
{
  "id": "cost_materials_002",
  "category": "educational_materials",
  "description": "Khan Academy subscription (3 months)",
  "amount": 0,
  "currency": "USD",
  "amount_usd": 0,
  "date": "2025-09-01",
  "booking_status": "paid",
  "source": "manual",
  "notes": "Free account for math/science lessons"
}
```

#### Educational Activities

```json
{
  "id": "cost_activity_001",
  "category": "educational_activities",
  "description": "Miraikan Science Museum admission",
  "amount": 630,
  "currency": "JPY",
  "amount_usd": 6,
  "date": "2025-11-10",
  "destination_id": "tokyo_japan",
  "booking_status": "estimated",
  "source": "web_research",
  "notes": "Adult admission, student may be discounted"
}
```

```json
{
  "id": "cost_activity_002",
  "category": "educational_activities",
  "description": "Traditional batik workshop",
  "amount": 500000,
  "currency": "IDR",
  "amount_usd": 35,
  "date": "2025-09-04",
  "destination_id": "bali_indonesia",
  "booking_status": "researched",
  "source": "web_research",
  "notes": "2-hour workshop, materials included"
}
```

### Integration with Curriculum

When generating curriculum, the system:

1. **Uses Learning Moments** to create specific activities
   - "Visit Miraikan Science Museum" becomes a detailed lesson plan
   - Costs from learning moments inform the estimated budget

2. **Tracks Education Costs** separately
   - Shows total educational budget across the trip
   - Breaks down by materials vs. activities
   - Links costs to specific locations

3. **Suggests Additional Costs** during generation
   - Recommends relevant books or resources
   - Estimates admission fees for suggested activities
   - Calculates total education budget

## How Curriculum Generator Uses This Data

### Without Learning Moments

Curriculum generator creates generic activities:
- "Visit a science museum in Tokyo" (vague)
- "Learn about coral reefs" (no specific location)

### With Learning Moments

Curriculum generator creates specific activities:
- "Visit Miraikan Science Museum, 3rd floor robotics exhibit. Study ASIMO's biomechanics and compare to human movement patterns." (specific)
- "Snorkel at Padang Bai to document 10 coral reef fish species using the field guide. Estimate population sizes and create biodiversity chart." (actionable)

### Cost Integration

The system automatically:
- Adds costs for suggested educational activities
- Recommends pre-purchasing materials
- Tracks total education budget vs. trip budget
- Shows cost breakdown in curriculum dashboard

## API Usage

### Adding Learning Moments via API

```bash
POST /api/itinerary/add-learning-moment
{
  "destination_id": "bali_indonesia",
  "learning_moment": {
    "subject": "science",
    "title": "Coral Reef Study",
    "description": "...",
    "type": "observation",
    "estimated_cost_usd": 45
  }
}
```

### Adding Education Costs via API

```bash
POST /api/costs/add
{
  "category": "educational_activities",
  "description": "Museum admission",
  "amount": 15,
  "currency": "USD",
  "destination_id": "tokyo_japan"
}
```

### Querying Education Costs

```bash
GET /api/costs/by-category?category=education
GET /api/costs/by-category?category=educational_materials
GET /api/costs/by-category?category=educational_activities
```

## Best Practices

### 1. Be Specific

**Good:**
```json
{
  "title": "Earthquake Engineering at Miraikan",
  "location": "Miraikan Science Museum, 3rd Floor",
  "description": "Interactive earthquake simulator demonstrates building design principles..."
}
```

**Too Vague:**
```json
{
  "title": "Science Museum",
  "location": "Tokyo",
  "description": "Visit a museum"
}
```

### 2. Include Costs

Even if free, specify `estimated_cost_usd: 0` so the curriculum generator knows it's accessible.

### 3. Tag Appropriately

Use tags to help filtering:
- `hands-on` - Interactive/participatory
- `outdoor` - Outdoor activity
- `indoor` - Indoor activity (weather backup)
- `museum` - Museum/gallery visit
- `guided` - Requires a guide
- `self-paced` - Can do independently

### 4. Age Range

Set realistic age ranges:
- Snorkeling: `age_appropriate_min: 10` (safety)
- Advanced museum: `age_appropriate_max: 18` (university level)
- Most activities: Leave max as `null` (all ages)

### 5. Standards Alignment

Reference actual standards when known:
- California: `CA-NGSS-MS-LS2-1` (science), `CA-HSS-8.1` (social studies)
- Common Core: `CCSS.ELA-LITERACY.W.8.2` (language arts)
- Leave empty if unsure - curriculum generator will suggest

## Example: Complete Location with Learning Moments

```json
{
  "id": "tokyo_japan",
  "name": "Tokyo",
  "country": "Japan",
  "duration_days": 23,
  "highlights": [
    "Modern technology",
    "Traditional temples",
    "World-class museums"
  ],
  "learning_moments": [
    {
      "subject": "science",
      "title": "Robotics and AI at Miraikan",
      "description": "Explore cutting-edge robotics including ASIMO, interactive AI exhibits, and earthquake engineering demonstrations",
      "type": "site_visit",
      "location": "Miraikan Science Museum, 2-3-6 Aomi, Koto City",
      "estimated_duration_minutes": 180,
      "estimated_cost_usd": 6,
      "age_appropriate_min": 10,
      "standards_addressed": ["CA-NGSS-MS-ETS1-2"],
      "tags": ["hands-on", "museum", "technology"]
    },
    {
      "subject": "history",
      "title": "WWII and Post-War Recovery",
      "description": "Visit Hiroshima Peace Memorial Museum (virtual tour) and study Japan's post-war economic miracle",
      "type": "research",
      "location": "Online resources + local sites",
      "estimated_duration_minutes": 120,
      "estimated_cost_usd": 0,
      "age_appropriate_min": 12,
      "standards_addressed": ["CA-HSS-8.1"],
      "tags": ["historical", "indoor", "self-paced"]
    },
    {
      "subject": "culture",
      "title": "Shinto Religion at Sensoji Temple",
      "description": "Explore Japan's indigenous religion through temple architecture, rituals, and symbolism",
      "type": "site_visit",
      "location": "Sensoji Temple, Asakusa",
      "estimated_duration_minutes": 90,
      "estimated_cost_usd": 0,
      "age_appropriate_min": 8,
      "tags": ["cultural", "outdoor", "self-paced"]
    }
  ]
}
```

## Next Steps

1. **Add Learning Moments** to your itinerary destinations
2. **Track Education Costs** separately from travel expenses
3. **Generate Curriculum** - the system will use learning moments for specific activities
4. **Review & Adjust** - customize generated curriculum based on your needs

For questions or help, see:
- `EDUCATION_MVP_IMPLEMENTATION.md` - Full implementation details
- `FIRESTORE_SETUP.md` - Database schema and setup
- `web/src/types/education.ts` - TypeScript type definitions
- `python/.../education_types.py` - Python type definitions
