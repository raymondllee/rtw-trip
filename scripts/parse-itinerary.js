#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ITINERARY_PATH = path.resolve(PROJECT_ROOT, 'itineary.md');

function readItineraryMarkdown(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Itinerary file not found at ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function parseYearFromHeader(line) {
  // Example header: **V2: ... (June - December 2026)**
  const yearMatch = line.match(/(19|20)\d{2}/);
  return yearMatch ? parseInt(yearMatch[0], 10) : null;
}

function detectLegFromLine(line) {
  // Lines like: - **I. Asia Leg: ...**
  const leg = line
    .replace(/[*_`]/g, '')
    .replace(/^\s*-\s*/, '')
    .trim();
  return leg;
}

function normalizeMonthName(name) {
  return name.trim();
}

function monthToIndex(monthName) {
  const months = [
    'January','February','March','April','May','June','July','August','September','October','November','December'
  ];
  const idx = months.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
  return idx; // 0-based
}

function toISODate(monthName, day, year) {
  const m = monthToIndex(monthName);
  if (m < 0) return null;
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(parseInt(day, 10)).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function parseStops(markdown) {
  const lines = markdown.split(/\r?\n/);
  let currentYear = null;
  let currentLeg = null;
  const stops = [];

  // Regex to match entries like: "June 12 - June 18: Bali, Indonesia (7 Days)"
  // or single-day: "July 18: Kuala Lumpur, Malaysia (1 Day)"
  const rangeRe = /^(?:\s*-\s*)?\*?-?\s*\*?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?\s*:\s*([^\(\n]+)\s*\(([^)]*?Day[^)]*)\)\s*$/;
  const singleRe = /^(?:\s*-\s*)?\*?-?\s*\*?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?\s*:\s*([^\(\n]+)\s*\(([^)]*?Day[^)]*)\)\s*$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!currentYear) {
      const y = parseYearFromHeader(line);
      if (y) currentYear = y;
    }

    // Detect leg headings (bold, with "Leg" keyword or roman numerals)
    if (/\bLeg\b/i.test(line) && /\*\*/.test(line)) {
      currentLeg = detectLegFromLine(line);
      continue;
    }

    // Skip obvious non-stop lines
    if (/^[-*]?\s*Itinerary:/.test(line)) continue;
    if (/^[-*]?\s*Cost Breakdown/.test(line)) continue;
    if (/^[-*]?\s*TOTAL FOR/i.test(line)) continue;
    if (/^[-*]?\s*Overall Grand Total/i.test(line)) continue;
    if (/^[-*]?\s*Focus:/i.test(line)) continue;
    if (/^[-*]?\s*Accommodation Style:/i.test(line)) continue;
    if (/^[-*]?\s*Sub-segment Total:/i.test(line)) continue;
    if (/^[-*]?\s*Flights\b/i.test(line)) continue;
    if (/^[-*]?\s*Ground Transportation\b/i.test(line)) continue;
    if (/^[-*]?\s*Food & Incidentals\b/i.test(line)) continue;
    if (/^[-*]?\s*Activity Costs\b/i.test(line)) continue;
    if (/^[-*]?\s*Gorilla Permit\b/i.test(line)) continue;
    if (/^[-*]?\s*Accommodation\b/i.test(line)) continue;
    if (/^[-*]?\s*Trekking Package\b/i.test(line)) continue;
    if (/^[-*]?\s*Kilimanjaro Climb Package\b/i.test(line)) continue;
    if (/^[-*]?\s*Antarctica Expedition Package\b/i.test(line)) continue;
    if (/\bTravel to\b/i.test(line)) continue;
    if (/\bReturn Home\b/i.test(line)) continue;

    let m = line.match(rangeRe);
    if (m) {
      const [, m1, d1, m2, d2, yOpt, placeRaw] = m;
      const year = yOpt ? parseInt(yOpt, 10) : currentYear;
      if (!year) continue;
      const startDate = toISODate(normalizeMonthName(m1), d1, year);
      const endDate = toISODate(normalizeMonthName(m2), d2, year);
      const name = placeRaw.trim();
      stops.push({ name, startDate, endDate, leg: currentLeg || null, raw: line });
      continue;
    }

    m = line.match(singleRe);
    if (m) {
      const [, m1, d1, yOpt, placeRaw] = m;
      const year = yOpt ? parseInt(yOpt, 10) : currentYear;
      if (!year) continue;
      const date = toISODate(normalizeMonthName(m1), d1, year);
      const name = placeRaw.trim();
      stops.push({ name, startDate: date, endDate: date, leg: currentLeg || null, raw: line });
    }
  }

  // Post-process: remove duplicates that are clearly headers (e.g., non-location lines)
  const clean = stops.filter(s => /[A-Za-z]/.test(s.name));
  return clean;
}

function buildTrip(markdown) {
  const titleLine = markdown.split(/\r?\n/).find(l => l.startsWith('**')) || 'Round the World Trip';
  const tripName = titleLine.replace(/[*_]/g, '').trim();
  const stops = parseStops(markdown);
  return { tripName, stops };
}

function main() {
  const md = readItineraryMarkdown(ITINERARY_PATH);
  const trip = buildTrip(md);
  const outPath = path.resolve(PROJECT_ROOT, 'data', 'trip.raw.json');
  fs.writeFileSync(outPath, JSON.stringify(trip, null, 2), 'utf8');
  console.log(`Parsed stops: ${trip.stops.length}`);
  console.log(`Wrote: ${outPath}`);
}

if (import.meta.url === `file://${__filename}`) {
  main();
}


