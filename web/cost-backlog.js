import { normalizeId } from './destination-id-manager.js';

/**
 * Build a quick lookup map of costs by destination ID (normalized)
 * @param {Array} costs
 * @returns {Map<string, {count: number, totalUSD: number, items: Array}>}
 */
function buildCostLookup(costs = []) {
  const map = new Map();
  costs.forEach((cost) => {
    const destIdRaw = cost.destination_id ?? cost.destinationId ?? null;
    if (!destIdRaw) return;
    const destId = normalizeId(destIdRaw);
    if (!map.has(destId)) {
      map.set(destId, { count: 0, totalUSD: 0, items: [] });
    }
    const entry = map.get(destId);
    entry.count += 1;
    const amountUSD = typeof cost.amount_usd === 'number'
      ? cost.amount_usd
      : typeof cost.amountUSD === 'number'
        ? cost.amountUSD
        : typeof cost.amount === 'number'
          ? cost.amount
          : 0;
    entry.totalUSD += amountUSD || 0;
    entry.items.push(cost);
  });
  return map;
}

/**
 * Find destinations that have no associated cost items.
 * @param {Object} data - Itinerary data with locations and costs
 * @returns {Array<Object>} Array of enriched destination info objects
 */
export function findDestinationsWithoutCosts(data) {
  const locations = data?.locations || [];
  const costs = data?.costs || [];
  const legs = data?.legs || [];

  const costLookup = buildCostLookup(costs);

  return locations
    .filter((location) => {
      const id = normalizeId(location.id);
      const entry = costLookup.get(id);
      return !entry || entry.count === 0;
    })
    .map((location, index) => {
      const id = normalizeId(location.id);
      const leg = legs.find((candidate) => {
        if (Array.isArray(candidate.destination_ids)) {
          return candidate.destination_ids
            .map((destId) => normalizeId(destId))
            .includes(id);
        }
        if (Array.isArray(candidate.regions) && location.region) {
          return candidate.regions.includes(location.region);
        }
        return false;
      });

      const subLeg = leg?.sub_legs?.find((sub) => {
        if (Array.isArray(sub.destination_ids)) {
          return sub.destination_ids
            .map((destId) => normalizeId(destId))
            .includes(id);
        }
        return false;
      }) || null;

      const neighborPrev = locations[index - 1] || null;
      const neighborNext = locations[index + 1] || null;

      return {
        id: location.id,
        normalizedId: id,
        name: location.name,
        city: location.city,
        country: location.country,
        region: location.region,
        activityType: location.activity_type,
        durationDays: location.duration_days,
        arrivalDate: location.arrival_date,
        departureDate: location.departure_date,
        highlights: Array.isArray(location.highlights) ? location.highlights : [],
        notes: location.notes || '',
        leg: leg ? leg.name : null,
        subLeg: subLeg ? subLeg.name : null,
        neighbors: {
          previous: neighborPrev
            ? {
                id: neighborPrev.id,
                name: neighborPrev.name,
                region: neighborPrev.region,
                country: neighborPrev.country,
                departureDate: neighborPrev.departure_date
              }
            : null,
          next: neighborNext
            ? {
                id: neighborNext.id,
                name: neighborNext.name,
                region: neighborNext.region,
                country: neighborNext.country,
                arrivalDate: neighborNext.arrival_date
              }
            : null
        }
      };
    });
}

/**
 * Generate a structured prompt for the cost agent to handle multiple destinations.
 * @param {Array<Object>} destinations - Enriched destinations from findDestinationsWithoutCosts
 * @param {Object} data - Itinerary data for context (optional)
 * @returns {string} Prompt text ready to send to the agent
 */
export function generateBulkCostPrompt(destinations, data = {}) {
  if (!destinations || destinations.length === 0) {
    return '';
  }

  const tripTitle = data?.trip?.title || 'this round-the-world trip';
  const travelers = Array.isArray(data?.trip?.travelers)
    ? data.trip.travelers.join(', ')
    : '3 travelers';

  const destinationBlocks = destinations.map((dest, index) => {
    const lines = [];
    lines.push(`${index + 1}. ${dest.name}${dest.city ? ` (${dest.city})` : ''}${dest.country ? `, ${dest.country}` : ''}`);

    if (dest.region || dest.leg) {
      const clusters = [
        dest.leg ? `Leg: ${dest.leg}` : null,
        dest.subLeg ? `Sub-leg: ${dest.subLeg}` : null,
        dest.region ? `Region: ${dest.region}` : null
      ].filter(Boolean);
      if (clusters.length) {
        lines.push(`   ${clusters.join(' • ')}`);
      }
    }

    if (dest.arrivalDate || dest.departureDate || dest.durationDays) {
      const dateBits = [];
      if (dest.arrivalDate) dateBits.push(`Arrive ${dest.arrivalDate}`);
      if (dest.departureDate) dateBits.push(`Depart ${dest.departureDate}`);
      if (dest.durationDays) dateBits.push(`${dest.durationDays} days`);
      lines.push(`   Schedule: ${dateBits.join(' • ')}`);
    }

    if (dest.activityType) {
      lines.push(`   Primary focus: ${dest.activityType}`);
    }

    const highlights = (dest.highlights || []).slice(0, 5);
    if (highlights.length) {
      lines.push(`   Highlights: ${highlights.join(', ')}`);
    }

    if (dest.notes) {
      lines.push(`   Notes: ${dest.notes}`);
    }

    if (dest.neighbors?.previous || dest.neighbors?.next) {
      const neighborBits = [];
      if (dest.neighbors.previous) {
        neighborBits.push(`Comes from ${dest.neighbors.previous.name} (${dest.neighbors.previous.country})`);
      }
      if (dest.neighbors.next) {
        neighborBits.push(`Continues to ${dest.neighbors.next.name} (${dest.neighbors.next.country})`);
      }
      lines.push(`   Travel context: ${neighborBits.join(' → ')}`);
    }

    lines.push(`   Destination ID: ${dest.normalizedId}`);
    return lines.join('\n');
  }).join('\n\n');

  return `You are the RTW trip cost-planning assistant. Help the traveler(s) (${travelers}) estimate costs for the destinations below on ${tripTitle}.

For each destination, produce 3-6 cost line items that cover major spend categories (flights/transfers in or out if applicable, accommodation, key activities, food, transport, other notable expenses). Use realistic per-trip totals for the whole party. All amounts must be numeric (no strings) and expressed in USD.

Return a single JSON array. Each element must follow exactly (do not add or rename fields):
{
  "destination_id": "<match the Destination ID>",
  "notes": "<optional high-level notes>",
  "costs": [
    {
      "category": "flight|accommodation|activity|food|transport|other",
      "description": "<short human-friendly label>",
      "amount": 0.0,
      "currency": "USD",
      "amount_usd": 0.0,
      "date": "YYYY-MM-DD",
      "booking_status": "estimated|researched|booked|paid",
      "source": "ai_estimate",
      "notes": "<optional detail>"
    }
  ]
}

Destinations to cover:

${destinationBlocks}

Output only the JSON array, no markdown.`;
}
