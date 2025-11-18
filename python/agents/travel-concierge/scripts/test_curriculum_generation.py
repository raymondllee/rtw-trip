#!/usr/bin/env python3
"""
Test curriculum generation with sample locations.

This script tests the AI-powered curriculum generation for a couple of sample
locations to validate prompt quality before implementing the full system.
"""

import json
import os
import sys
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from travel_concierge.shared_libraries.education_types import (
    StudentProfile,
    LearningStyle,
)

# Sample student profile (Maya, 14 years old, 8th grade)
SAMPLE_STUDENT = {
    "name": "Maya",
    "age": 14,
    "grade": 8,
    "state": "California",
    "country": "United States",
    "subjects_parent_covers": ["math", "chinese"],
    "subjects_to_cover": ["science", "social_studies", "language_arts"],
    "learning_style": "experiential",
    "reading_level": 10,  # Grade level
    "time_budget_minutes_per_day": 60,
    "interests": ["marine_biology", "photography", "architecture", "food_culture"],
}

# Sample locations from the RTW trip
SAMPLE_LOCATIONS = [
    {
        "id": "tokyo_japan",
        "name": "Tokyo",
        "city": "Tokyo",
        "country": "Japan",
        "region": "East Asia",
        "arrival_date": "2025-11-01",
        "departure_date": "2025-11-23",
        "duration_days": 23,
        "activity_type": "cultural_exploration",
        "highlights": [
            "Modern technology and robotics",
            "Traditional temples and shrines",
            "World-class museums",
            "Unique food culture",
            "Earthquake-resistant architecture",
            "Public transportation systems",
            "Pop culture and anime",
            "Historical sites (WWII, Meiji era)"
        ],
        "coordinates": {"lat": 35.6762, "lng": 139.6503},
        "timezone": "Asia/Tokyo"
    },
    {
        "id": "bali_indonesia",
        "name": "Bali",
        "city": "Denpasar",
        "country": "Indonesia",
        "region": "Southeast Asia",
        "arrival_date": "2025-09-01",
        "departure_date": "2025-09-07",
        "duration_days": 7,
        "activity_type": "diving_and_culture",
        "highlights": [
            "Coral reef ecosystems",
            "Marine biodiversity",
            "Volcanic geology",
            "Hindu temples and culture",
            "Traditional arts (batik, dance)",
            "Rice terraces and agriculture",
            "Local markets and economy"
        ],
        "coordinates": {"lat": -8.3405, "lng": 115.0920},
        "timezone": "Asia/Makassar"
    }
]


def generate_curriculum_prompt(location: dict, student: dict, subjects: list[str]) -> str:
    """Generate the prompt for curriculum content generation."""

    prompt = f"""You are an expert curriculum designer specializing in location-based, experiential learning for middle school students.

# Student Context
- Name: {student['name']}
- Age: {student['age']}
- Grade: {student['grade']}
- Learning Style: {student['learning_style']}
- Time Budget: {student['time_budget_minutes_per_day']} minutes per day
- Reading Level: Grade {student['reading_level']}
- Interests: {', '.join(student['interests'])}
- State Standards: {student['state']} Grade {student['grade']}

# Location Details
- Name: {location['name']}, {location['country']}
- Duration: {location['duration_days']} days
- Dates: {location['arrival_date']} to {location['departure_date']}
- Activity Type: {location['activity_type']}
- Highlights: {', '.join(location['highlights'])}

# Subjects to Cover
{', '.join(subjects)}

# Task
Generate comprehensive educational content for this location that aligns with California 8th grade standards.

Create a detailed learning plan with the following structure:

## 1. Pre-Trip Preparation (2 weeks before arrival)

### Readings
Provide 3-5 readings (articles, book chapters). For each:
- Title
- Source (specific publication or website)
- Estimated reading time
- Brief description
- Why it's relevant
- Reading level: appropriate for grade {student['reading_level']}

### Videos
Provide 2-3 educational videos. For each:
- Title
- Source (YouTube channel, PBS, National Geographic, etc.)
- Duration
- Description
- Key concepts covered

### Preparation Tasks
List 3-4 specific tasks to complete before the trip:
- Background research topics
- Vocabulary to learn
- Questions to consider
- Skills to practice

## 2. On-Location Activities

Create {min(location['duration_days'], 7)} days worth of learning activities. For each day or major activity:

### Experiential Activities (prioritize these - {student['learning_style']} learning style)
Provide specific, location-based activities:
- **Exact sites to visit** (with addresses or clear descriptions)
- **What to observe and document** (be specific)
- **Questions to investigate** (hands-on inquiry)
- **Photo/video assignments** with clear educational purpose
- **Local interviews** - who to talk to and what to ask
- **Hands-on challenges** that leverage being physically present

### Structured Lessons (for flexibility)
Provide 2-3 shorter activities for:
- Rest days
- Bad weather
- Evening time
- Travel time

Each activity should:
- Take 30-90 minutes
- Have clear learning objectives
- Connect to location's unique features
- Be appropriate for a {student['age']}-year-old
- Cover the specified subjects naturally

## 3. Post-Trip Reflections

### Reflection Prompts (5-7 prompts)
Journal prompts that encourage:
- Comparative thinking
- Personal insights
- Synthesis of learning
- Connection to prior knowledge

### Synthesis Activities (2-3 activities)
Longer-form assignments:
- Essays or reports
- Creative projects
- Presentations
- Research papers

### Assessment Opportunities
How to demonstrate learning:
- Portfolio pieces
- Presentations
- Written work
- Creative expressions

# Important Guidelines

1. **Be SPECIFIC**: Don't say "visit a museum" - say "Visit the Miraikan Science Museum, 3rd floor robotics exhibit, and compare ASIMO's movement to human biomechanics."

2. **Include PRACTICAL DETAILS**:
   - Best times to visit
   - Estimated costs (if applicable)
   - What to bring
   - How to get there

3. **AGE-APPROPRIATE**: Content for {student['grade']}th grade
   - Reading level: Grade {student['reading_level']}
   - Concepts should challenge but not overwhelm
   - Activities should be engaging for {student['age']}-year-olds

4. **EXPERIENTIAL FOCUS**: {student['learning_style']} learning style means:
   - 70% experiential, hands-on activities
   - 30% structured reading/lessons
   - Real-world application
   - Learning by doing

5. **SUBJECT INTEGRATION**: Naturally weave together:
   {', '.join(f'   - {subject}' for subject in subjects)}

6. **STANDARDS ALIGNMENT**: Reference California 8th grade standards where relevant

7. **STUDENT INTERESTS**: Connect to: {', '.join(student['interests'])}

# Output Format

Provide your response in valid JSON format with this structure:

{{
  "location_id": "{location['id']}",
  "location_name": "{location['name']}, {location['country']}",
  "duration_days": {location['duration_days']},

  "pre_trip": {{
    "timeline": "2 weeks before arrival",
    "readings": [
      {{
        "title": "...",
        "source": "...",
        "reading_time_minutes": 20,
        "description": "...",
        "relevance": "...",
        "url": "..." or null
      }}
    ],
    "videos": [
      {{
        "title": "...",
        "source": "...",
        "duration_minutes": 15,
        "description": "...",
        "key_concepts": ["..."],
        "url": "..." or null
      }}
    ],
    "preparation_tasks": [
      {{
        "title": "...",
        "description": "...",
        "estimated_duration_minutes": 30
      }}
    ]
  }},

  "on_location": {{
    "experiential_activities": [
      {{
        "title": "...",
        "type": "experiential",
        "subject": "...",
        "estimated_duration_minutes": 120,
        "learning_objectives": ["..."],
        "description": "...",
        "instructions": {{
          "before": "...",
          "during": "...",
          "after": "..."
        }},
        "site_details": {{
          "name": "...",
          "address": "...",
          "best_time": "...",
          "cost_usd": 0,
          "what_to_bring": ["..."]
        }}
      }}
    ],
    "structured_lessons": [
      {{
        "title": "...",
        "type": "structured",
        "subject": "...",
        "estimated_duration_minutes": 60,
        "learning_objectives": ["..."],
        "description": "...",
        "activities": ["Read...", "Watch...", "Write..."]
      }}
    ]
  }},

  "post_trip": {{
    "reflection_prompts": [
      {{
        "text": "...",
        "type": "journal",
        "word_count_target": 300
      }}
    ],
    "synthesis_activities": [
      {{
        "title": "...",
        "type": "essay",
        "subject": "...",
        "description": "...",
        "estimated_duration_minutes": 120,
        "learning_objectives": ["..."]
      }}
    ]
  }},

  "subject_coverage": {{
    "science": {{
      "topics": ["..."],
      "standards": ["CA-NGSS-MS-LS2-1", "..."],
      "estimated_hours": 8.0
    }},
    "social_studies": {{
      "topics": ["..."],
      "standards": ["..."],
      "estimated_hours": 5.0
    }},
    "language_arts": {{
      "topics": ["..."],
      "standards": ["..."],
      "estimated_hours": 3.0
    }}
  }}
}}

Make it specific, engaging, and educationally sound. This will be used for real homeschooling during travel!
"""

    return prompt


def test_curriculum_generation():
    """Test curriculum generation for sample locations."""

    print("=" * 80)
    print("TESTING CURRICULUM GENERATION")
    print("=" * 80)
    print()

    # Check if we have Google AI API key
    google_api_key = os.getenv('GOOGLE_API_KEY')
    if not google_api_key:
        print("ERROR: GOOGLE_API_KEY environment variable not set")
        print("Please set it in your .env file or export it")
        return

    try:
        import google.generativeai as genai
        genai.configure(api_key=google_api_key)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        print("✓ Connected to Gemini API")
        print()
    except ImportError:
        print("ERROR: google-generativeai package not installed")
        print("Run: pip install google-generativeai")
        return
    except Exception as e:
        print(f"ERROR: Failed to initialize Gemini: {e}")
        return

    # Generate curriculum for each location
    for location in SAMPLE_LOCATIONS:
        print(f"\n{'=' * 80}")
        print(f"GENERATING CURRICULUM FOR: {location['name']}, {location['country']}")
        print(f"Duration: {location['duration_days']} days")
        print(f"Subjects: {', '.join(SAMPLE_STUDENT['subjects_to_cover'])}")
        print(f"{'=' * 80}\n")

        # Generate prompt
        prompt = generate_curriculum_prompt(
            location=location,
            student=SAMPLE_STUDENT,
            subjects=SAMPLE_STUDENT['subjects_to_cover']
        )

        print("Sending request to Gemini...")
        print(f"Prompt length: {len(prompt)} characters")
        print()

        try:
            # Generate content
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=8000,
                )
            )

            # Extract text from response
            result_text = response.text

            # Try to parse as JSON
            try:
                # Remove markdown code blocks if present
                if result_text.strip().startswith('```'):
                    result_text = result_text.strip()
                    result_text = result_text.split('```')[1]
                    if result_text.startswith('json'):
                        result_text = result_text[4:]

                result_json = json.loads(result_text)

                print("✓ Successfully generated curriculum")
                print()

                # Save to file
                output_file = f"curriculum_{location['id']}.json"
                output_path = os.path.join(os.path.dirname(__file__), output_file)

                with open(output_path, 'w') as f:
                    json.dump(result_json, f, indent=2)

                print(f"✓ Saved to: {output_path}")
                print()

                # Display summary
                print("CURRICULUM SUMMARY:")
                print(f"  Location: {result_json.get('location_name', 'N/A')}")
                print()

                if 'pre_trip' in result_json:
                    pre_trip = result_json['pre_trip']
                    print(f"  Pre-Trip Prep:")
                    print(f"    - {len(pre_trip.get('readings', []))} readings")
                    print(f"    - {len(pre_trip.get('videos', []))} videos")
                    print(f"    - {len(pre_trip.get('preparation_tasks', []))} prep tasks")
                    print()

                if 'on_location' in result_json:
                    on_loc = result_json['on_location']
                    print(f"  On-Location:")
                    print(f"    - {len(on_loc.get('experiential_activities', []))} experiential activities")
                    print(f"    - {len(on_loc.get('structured_lessons', []))} structured lessons")
                    print()

                if 'post_trip' in result_json:
                    post_trip = result_json['post_trip']
                    print(f"  Post-Trip:")
                    print(f"    - {len(post_trip.get('reflection_prompts', []))} reflection prompts")
                    print(f"    - {len(post_trip.get('synthesis_activities', []))} synthesis activities")
                    print()

                if 'subject_coverage' in result_json:
                    print(f"  Subject Coverage:")
                    for subject, details in result_json['subject_coverage'].items():
                        hours = details.get('estimated_hours', 0)
                        topics = len(details.get('topics', []))
                        print(f"    - {subject}: {topics} topics, {hours} hours")
                    print()

                # Show sample activities
                if 'on_location' in result_json and result_json['on_location'].get('experiential_activities'):
                    print("  Sample Experiential Activities:")
                    for i, activity in enumerate(result_json['on_location']['experiential_activities'][:2], 1):
                        print(f"    {i}. {activity.get('title', 'Untitled')}")
                        print(f"       Subject: {activity.get('subject', 'N/A')}")
                        print(f"       Duration: {activity.get('estimated_duration_minutes', 0)} min")
                        if 'site_details' in activity:
                            print(f"       Site: {activity['site_details'].get('name', 'N/A')}")
                    print()

            except json.JSONDecodeError as e:
                print(f"⚠ Failed to parse JSON response: {e}")
                print()
                print("Raw response:")
                print(result_text[:500])
                print()

                # Save raw response
                output_file = f"curriculum_{location['id']}_raw.txt"
                output_path = os.path.join(os.path.dirname(__file__), output_file)
                with open(output_path, 'w') as f:
                    f.write(result_text)
                print(f"Saved raw response to: {output_path}")
                print()

        except Exception as e:
            print(f"✗ Error generating curriculum: {e}")
            print()
            continue

    print("=" * 80)
    print("TESTING COMPLETE")
    print("=" * 80)
    print()
    print("Review the generated curriculum files and validate:")
    print("  1. Content is age-appropriate for 8th grade")
    print("  2. Activities are specific and actionable")
    print("  3. Good balance of experiential vs structured (70/30)")
    print("  4. Standards alignment is reasonable")
    print("  5. Resources are real and accessible")
    print()


if __name__ == '__main__':
    test_curriculum_generation()
