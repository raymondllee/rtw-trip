#!/usr/bin/env python3
"""View token usage and cost statistics for cost research agent."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from travel_concierge.tools.token_tracker import get_tracker, estimate_cost


def main():
    """Display current token usage statistics."""
    tracker = get_tracker()

    if tracker.total_interactions == 0:
        print("No cost research interactions tracked yet.")
        print("\nRun some cost research queries first, then check back!")
        return

    print("\n" + "=" * 80)
    print("📊 COST RESEARCH TOKEN USAGE & COST ANALYSIS")
    print("=" * 80 + "\n")

    stats = tracker.get_aggregate_stats()

    print(f"Total Destinations Researched: {stats['total_interactions']}")
    print(f"\n💰 COSTS:")
    print(f"  Total Cost: ${stats['total_cost_usd']:.4f}")
    print(f"  Avg per Destination: ${stats['avg_cost_per_destination']:.4f}")

    print(f"\n🔢 TOKENS:")
    print(f"  Total Tokens: {stats['total_tokens']:,}")
    print(f"    - Input Tokens: {stats['total_input_tokens']:,}")
    print(f"    - Output Tokens: {stats['total_output_tokens']:,}")
    print(f"  Avg per Destination: {stats['avg_tokens_per_destination']:,} tokens")

    print(f"\n⏱️ PERFORMANCE:")
    print(f"  Avg Duration: {stats['avg_duration_seconds']:.1f}s per destination")

    print(f"\n💡 PROJECTIONS:")
    # Project costs for common scenarios
    destinations_10 = 10 * stats['avg_cost_per_destination']
    destinations_50 = 50 * stats['avg_cost_per_destination']
    destinations_100 = 100 * stats['avg_cost_per_destination']

    print(f"  10 destinations: ${destinations_10:.2f}")
    print(f"  50 destinations: ${destinations_50:.2f}")
    print(f"  100 destinations: ${destinations_100:.2f}")

    # Show recent interactions
    print(f"\n📋 RECENT INTERACTIONS:")
    print("-" * 80)
    recent = tracker.interactions[-5:]  # Last 5
    for i, interaction in enumerate(reversed(recent), 1):
        summary = interaction.summary()
        print(f"{i}. {summary['destination']}")
        print(f"   ⏱️ {summary['duration_seconds']}s | "
              f"🔢 {summary['total_tokens']:,} tokens | "
              f"💵 ${summary['cost_usd']:.4f} | "
              f"🔍 {summary['searches']} searches")

    print("\n" + "=" * 80)

    # Show pricing breakdown
    print("\n📖 PRICING REFERENCE (Gemini 2.5 Flash):")
    print(f"  Input tokens: $0.075 per 1M tokens")
    print(f"  Output tokens: $0.30 per 1M tokens")
    print(f"  Cached input: $0.01875 per 1M tokens (75% discount)")

    print("\n💡 COST EXAMPLES:")
    print(f"  1,000 input + 500 output tokens = ${estimate_cost(1000, 500):.4f}")
    print(f"  5,000 input + 2,000 output tokens = ${estimate_cost(5000, 2000):.4f}")
    print(f"  10,000 input + 3,000 output tokens = ${estimate_cost(10000, 3000):.4f}")

    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    main()
