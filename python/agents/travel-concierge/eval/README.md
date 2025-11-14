# Evaluation Test Suite

## Overview

This directory contains **evaluation tests** that verify actual agent behavior and output quality, rather than just infrastructure. These tests use the ADK's `AgentEvaluator` to run conversations and evaluate agent responses.

## Philosophy

**Evaluations test "what" not "how":**
- ✅ Test actual behavior and output quality
- ✅ Test conversational flows
- ✅ Test real user scenarios
- ✅ More resilient to implementation changes
- ✅ Use LLM-based evaluation when appropriate

**vs. Code-based tests (in `tests/agent/`):**
- Test infrastructure (tools called, APIs hit)
- Fast, deterministic
- Test "how" (implementation details)

## Test Structure

### Test Files

- `test_eval.py` - Basic evaluation tests (original)
- `test_eval_expanded.py` - Comprehensive evaluation suite (20+ scenarios)

### Test Data Files

Located in `eval/data/`:

1. **Inspiration Tests:**
   - `inspire.test.json` - Original Americas inspiration test
   - `inspiration_comprehensive.test.json` - Asia, Europe, beach, budget scenarios

2. **Planning Tests:**
   - `planning.test.json` - Original planning test
   - `planning_comprehensive.test.json` - Flights, hotels, full itinerary

3. **Cost Research Tests:**
   - `cost_research.test.json` - Original cost research test
   - `cost_research_comprehensive.test.json` - Different destinations, travel styles, group sizes

4. **Itinerary Editing Tests:**
   - `itinerary_editing.test.json` - Original itinerary editing test
   - `itinerary_editing_comprehensive.test.json` - Add, remove, update, multi-edit

5. **Other Tests:**
   - `pretrip.test.json` - Pre-trip agent scenarios
   - `intrip.test.json` - In-trip agent scenarios

## Running Evaluations

### Run All Evaluations

```bash
poetry run pytest eval/test_eval_expanded.py -v
```

### Run Specific Test

```bash
poetry run pytest eval/test_eval_expanded.py::test_inspire_asia -v
```

### Run with Output

```bash
poetry run pytest eval/test_eval_expanded.py -v -s
```

## Test Coverage

### Current Coverage (20+ scenarios)

1. **Inspiration Agent** (5 tests)
   - Americas destinations
   - Asia destinations
   - Europe destinations
   - Beach destinations
   - Budget travel

2. **Planning Agent** (4 tests)
   - Flight planning
   - Hotel planning
   - Full itinerary planning
   - Flight search

3. **Cost Research Agent** (4 tests)
   - Tokyo cost research
   - Bangkok budget travel
   - Tokyo luxury travel
   - Family trip (multiple travelers)

4. **Itinerary Editing** (4 tests)
   - Add destination
   - Remove destination
   - Update duration
   - Multi-edit operations

5. **Pre-trip Agent** (1 test)
   - Pre-trip preparation

6. **In-trip Agent** (1 test)
   - In-trip assistance

### Test Scenarios Cover

- ✅ Different destinations (Asia, Europe, Americas, beach, budget)
- ✅ Different travel styles (budget, mid-range, luxury)
- ✅ Different group sizes (1 person, 2 people, 4 people)
- ✅ Different trip durations (5 days, 7 days, 10 days)
- ✅ Different operations (add, remove, update, multi-edit)
- ✅ Different agent types (inspiration, planning, cost research, itinerary editing)

## How Evaluations Work

### 1. Test Data Format

Each test data file contains:
- `eval_set_id`: Unique identifier
- `name`: Test set name
- `description`: What the test set covers
- `eval_cases`: Array of test scenarios

Each `eval_case` contains:
- `eval_id`: Unique test case ID
- `conversation`: Array of conversation turns
- `session_input`: Initial session state

### 2. Conversation Structure

Each conversation turn includes:
- `user_content`: User message
- `final_response`: Expected agent response (can be empty for open-ended tests)
- `intermediate_data`: Expected tool calls/transfers

### 3. Evaluation Process

1. **Load test data** from JSON file
2. **Run agent** with test scenarios
3. **Compare outputs** to expected behavior
4. **Report results** (pass/fail, metrics)

### 4. LLM-Based Evaluation

The ADK's `AgentEvaluator` can use LLM-based evaluation to:
- Check response quality
- Verify correctness
- Assess helpfulness
- Compare to expected outputs

## Adding New Tests

### 1. Create Test Data File

Create a new JSON file in `eval/data/`:

```json
{
  "eval_set_id": "my-test-set",
  "name": "My Test Set",
  "description": "What this test set covers",
  "eval_cases": [
    {
      "eval_id": "test-001",
      "conversation": [
        {
          "invocation_id": "test-001-001",
          "user_content": {
            "parts": [{"text": "User message here"}],
            "role": "user"
          },
          "final_response": {
            "parts": [{"text": ""}],
            "role": "model"
          },
          "intermediate_data": {
            "tool_uses": [
              {"name": "transfer_to_agent", "args": {"agent_name": "inspiration_agent"}}
            ]
          }
        }
      ],
      "session_input": {
        "app_name": "travel_concierge",
        "user_id": "test_user",
        "state": {
          "user_profile": {...}
        }
      }
    }
  ]
}
```

### 2. Add Test Function

Add to `eval/test_eval_expanded.py`:

```python
@pytest.mark.asyncio
async def test_my_new_scenario():
    """Test description."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/my_test_file.test.json"),
        num_runs=4
    )
```

## Best Practices

1. **Test Real Scenarios**
   - Use actual user queries
   - Test common use cases
   - Include edge cases

2. **Test Behavior, Not Implementation**
   - Focus on output quality
   - Test conversational flows
   - Verify helpfulness

3. **Use Multiple Runs**
   - Set `num_runs=4` for statistical significance
   - Account for LLM variability
   - Get average performance

4. **Keep Tests Focused**
   - One scenario per test case
   - Clear expected behavior
   - Easy to debug failures

5. **Document Test Purpose**
   - Clear test names
   - Descriptive docstrings
   - Explain what's being tested

## Integration with CI/CD

### Recommended Setup

1. **Code-based tests** (fast, every commit)
   - Run on every commit
   - Fast feedback (< 5 minutes)
   - Test infrastructure

2. **Evaluations** (slower, PRs/releases)
   - Run on PRs and releases
   - Can take longer (10-30 minutes)
   - Test behavior and quality

3. **Both together**
   - Comprehensive coverage
   - Fast + thorough
   - Catch both infrastructure and behavior issues

## Next Steps

1. ✅ Expand test scenarios (done)
2. 📝 Add more edge cases
3. 📝 Add LLM-based evaluation criteria
4. 📝 Add performance benchmarks
5. 📝 Integrate with CI/CD pipeline


