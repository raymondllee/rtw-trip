#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RAW_TRIP_PATH = path.resolve(PROJECT_ROOT, 'data', 'trip.raw.json');
const GEO_CACHE_PATH = path.resolve(PROJECT_ROOT, 'data', 'geocache.json');
const OVERRIDES_PATH = path.resolve(PROJECT_ROOT, 'data', 'overrides.json');
const OUTPUT_PATH = path.resolve(PROJECT_ROOT, 'data', 'trip.json');
const UNRESOLVED_PATH = path.resolve(PROJECT_ROOT, 'data', 'unresolved.json');

function loadJSON(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function nominatimGeocode(query) {
  const encoded = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;
  const headers = { 'User-Agent': 'rtw-trip/1.0 (learning project)' };
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (Array.isArray(json) && json.length > 0) {
            const top = json[0];
            resolve({ lat: parseFloat(top.lat), lng: parseFloat(top.lon), source: 'nominatim' });
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function geocodeStops(stops) {
  const cache = loadJSON(GEO_CACHE_PATH, {});
  const overrides = loadJSON(OVERRIDES_PATH, {});
  const results = [];
  const unresolved = [];

  for (const stop of stops) {
    const key = stop.name;

    // Apply overrides first
    const ovr = overrides[key];
    if (ovr) {
      if (ovr.lat != null && ovr.lng != null) {
        cache[key] = { lat: ovr.lat, lng: ovr.lng };
        results.push({ ...stop, lat: ovr.lat, lng: ovr.lng, override: true });
        continue;
      }
    }
    if (cache[key]) {
      results.push({ ...stop, lat: cache[key].lat, lng: cache[key].lng });
      continue;
    }
    // Try with simple query first
    let query = key;
    if (ovr && ovr.name) {
      query = ovr.name;
    }
    let coords = await nominatimGeocode(query);
    if (!coords) {
      // Heuristic: try appending country if present in name; otherwise leave as-is
      coords = await nominatimGeocode(query);
    }
    if (coords) {
      cache[key] = { lat: coords.lat, lng: coords.lng };
      results.push({ ...stop, lat: coords.lat, lng: coords.lng });
      // Be polite to Nominatim
      await new Promise(r => setTimeout(r, 1000));
    } else {
      results.push({ ...stop });
      unresolved.push(stop);
    }
  }

  saveJSON(GEO_CACHE_PATH, cache);
  saveJSON(UNRESOLVED_PATH, unresolved);
  return results;
}

async function main() {
  if (!fs.existsSync(RAW_TRIP_PATH)) {
    console.error('Missing input data/trip.raw.json. Run the parser first.');
    process.exit(1);
  }
  const raw = loadJSON(RAW_TRIP_PATH, null);
  if (!raw) {
    console.error('Invalid trip.raw.json');
    process.exit(1);
  }
  const geocodedStops = await geocodeStops(raw.stops || []);
  const trip = { ...raw, stops: geocodedStops };
  saveJSON(OUTPUT_PATH, trip);
  console.log(`Geocoded stops: ${geocodedStops.filter(s => s.lat && s.lng).length}/${geocodedStops.length}`);
  console.log(`Unresolved list: ${UNRESOLVED_PATH}`);
  console.log(`Wrote: ${OUTPUT_PATH}`);
}

if (import.meta.url === `file://${__filename}`) {
  await main();
}


