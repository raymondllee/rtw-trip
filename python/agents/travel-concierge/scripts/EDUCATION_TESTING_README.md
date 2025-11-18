# Education System Testing

## Overview

This directory contains test scripts for validating the AI-powered curriculum generation before implementing the full system.

## Prerequisites

### 1. Google API Key

You need a Google API key to use Gemini for curriculum generation.

**Get your API key:**
1. Visit https://aistudio.google.com/app/apikey
2. Click "Create API key"
3. Copy the key

**Set the environment variable:**

```bash
# Option 1: Export for current session
export GOOGLE_API_KEY="your-api-key-here"

# Option 2: Add to .env file (create if doesn't exist)
echo "GOOGLE_API_KEY=your-api-key-here" >> /home/user/rtw-trip/.env
```

### 2. Install Dependencies

```bash
cd /home/user/rtw-trip/python/agents/travel-concierge
pip install google-generativeai
```

## Running the Test

### Test Curriculum Generation

This script generates curriculum content for Tokyo and Bali to validate prompt quality:

```bash
cd /home/user/rtw-trip/python/agents/travel-concierge
export GOOGLE_API_KEY="your-key-here"  # If not in .env
python scripts/test_curriculum_generation.py
```

**What it does:**
- Generates comprehensive curriculum for 2 sample locations
- Tests AI prompts with real student profile (Maya, 14, 8th grade)
- Creates pre-trip, on-location, and post-trip content
- Validates JSON output format
- Saves results to JSON files for review

**Output files:**
- `scripts/curriculum_tokyo_japan.json` - Tokyo curriculum
- `scripts/curriculum_bali_indonesia.json` - Bali curriculum

### What to Review

After generation, check the output files for:

1. **Content Quality**
   - Is it age-appropriate for 8th grade?
   - Are activities specific and actionable?
   - Does it align with California standards?

2. **Balance**
   - ~70% experiential activities
   - ~30% structured lessons
   - Good variety of subjects (science, social studies, language arts)

3. **Practicality**
   - Are sites and locations real/accessible?
   - Are time estimates reasonable?
   - Are resources actual (not fabricated)?

4. **Educational Value**
   - Clear learning objectives
   - Meaningful connections to location
   - Appropriate depth for grade level

## Sample Student Profile

The test uses this profile:
- Name: Maya
- Age: 14
- Grade: 8
- State: California
- Learning Style: Experiential (70% hands-on, 30% structured)
- Time Budget: 60 minutes/day
- Subjects: Science, Social Studies, Language Arts
- Interests: Marine biology, Photography, Architecture, Food culture

## Sample Locations

### Tokyo, Japan
- Duration: 23 days
- Activity Type: Cultural exploration
- Highlights: Technology, temples, museums, food, architecture, history

### Bali, Indonesia
- Duration: 7 days
- Activity Type: Diving and culture
- Highlights: Coral reefs, marine life, volcanoes, temples, arts, agriculture

## Next Steps

After validating the curriculum quality:

1. **Adjust prompts** if needed (in `test_curriculum_generation.py`)
2. **Re-run tests** to verify improvements
3. **Implement backend** - Flask API endpoints
4. **Implement frontend** - Education dashboard
5. **Full integration** - Generate curriculum for all 43 locations

## Troubleshooting

### "GOOGLE_API_KEY environment variable not set"
- Make sure you've exported the API key or added it to .env
- Restart your terminal/shell after setting it

### "No module named 'google'"
- Run: `pip install google-generativeai`

### "JSON parsing error"
- This usually means the AI returned markdown-wrapped JSON
- The script tries to handle this automatically
- Check the raw output file (*_raw.txt) if parsing fails

### Generation takes a long time
- Curriculum generation for each location takes 15-30 seconds
- This is normal for comprehensive content generation
- Total script run time: ~1-2 minutes for 2 locations

## Cost Estimate

Using Gemini 2.0 Flash:
- Cost per location: ~$0.001-0.01 (very low!)
- Full trip (43 locations): ~$0.05-0.50
- This is extremely affordable for the value provided

## Questions?

See the main implementation docs:
- `/home/user/rtw-trip/EDUCATION_MVP_IMPLEMENTATION.md`
- `/home/user/rtw-trip/FIRESTORE_SETUP.md`
