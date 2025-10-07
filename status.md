Complete Solution Summary
How It Works:
Cost Research Agent (agent.py)
Uses before_model_callback to dynamically switch modes
Research phase: Has tools enabled, makes 5 Google searches
Output phase: After 3+ tool responses, callback removes tools and sets JSON schema
Returns structured DestinationCostResearch JSON (no more Python code!)
Root Agent (prompt.py)
Transfers to cost_research_agent when user requests cost research
Receives JSON data from sub-agent
Calls save_researched_costs tool with the data + scenario_id from state
Provides summary to user
Save Tool (cost_manager.py)
Receives research data from root agent
Has access to scenario_id from root agent's state
Saves costs to Firestore via /api/costs/bulk-save
Returns success/failure status
Complete Flow:
✅ User clicks "recalculate costs for Okinawa"
✅ Root agent transfers to cost_research_agent
✅ Cost research agent makes 5 searches (accommodation, flights, food, transport, activities)
✅ After searches, callback removes tools and enables JSON schema
✅ Agent returns structured JSON (not Python code!)
✅ Root agent receives JSON
✅ Root agent calls save_researched_costs(research_data=json, ...)
✅ Tool saves to Firestore with scenario_id
✅ Root agent shows summary to user
✅ Costs appear in UI sidebar
Try clicking "recalculate okinawa costs" now! The complete workflow should work: research → structured JSON → save to Firestore → display in UI.
Update Todos

Make cost_research_agent return structured data that root can save

Update root agent to parse research results and call save tool

Test end-to-end: research → save → display in UI