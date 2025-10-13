import { FirestoreScenarioManager } from './firestore-scenario-manager.js';
import { StatePersistence } from './state-persistence.js';
import { summaryManager } from './summary-manager.js';
import { showDataIntegrityPanel, validateDataIntegrity } from './data-integrity-ui.js';
import { generateDestinationId, normalizeId } from './destination-id-manager.js';
import {
  showDestinationDeletionDialog,
  handleDestinationDeletion,
  populateReassignDropdown
} from './destination-deletion-handler.js';

const DATA_PATH = './itinerary_structured.json';

const idsEqual = (a, b) => {
  if (a == null || b == null) return a == null && b == null;
  return normalizeId(a) === normalizeId(b);
};

async function loadData() {
  // First try to load from static file (fallback for local dev or if Firestore is unavailable)
  try {
    const res = await fetch(DATA_PATH);
    if (res.ok) {
      const data = await res.json();
      console.log(`📊 Loaded itinerary with ${data.costs?.length || 0} cost items from ${DATA_PATH}`);
      return data;
    }
  } catch (error) {
    console.warn('Static itinerary file not found, will use Firestore fallback:', error);
  }

  // Return minimal empty data structure if file not found
  // The app will load the latest scenario from Firestore in initMapApp
  console.log('📊 Using empty initial data - will load from Firestore');
  return {
    locations: [],
    legs: [],
    costs: []
  };
}

function toLatLng(location) {
  if (location.coordinates && typeof location.coordinates.lat === 'number' && typeof location.coordinates.lng === 'number') {
    return { lat: location.coordinates.lat, lng: location.coordinates.lng };
  }
  return null;
}

function computeBounds(map, locations) {
  const bounds = new google.maps.LatLngBounds();
  for (const loc of locations) {
    const ll = toLatLng(loc);
    if (ll) bounds.extend(ll);
  }
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds);
  }
}

function formatDateRange(a, b) {
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const f = (d) => d ? fmt.format(new Date(d + 'T00:00:00Z')) : '';
  if (a && b && a !== b) return `${f(a)} – ${f(b)}`;
  if (a) return f(a);
  if (b) return f(b);
  return '';
}

function formatDateCompact(a, b) {
  if (!a || !b) return '';
  const start = new Date(a + 'T00:00:00Z');
  const end = new Date(b + 'T00:00:00Z');
  const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
  const startMonth = monthFmt.format(start);
  const endMonth = monthFmt.format(end);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const year = start.getUTCFullYear();

  // Same month: "Jul 22 – Aug 13, 2026"
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}, ${year}`;
  }
  // Different months: "Jul 22 – Aug 13, 2026"
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function groupLegs(data) {
  if (data.legs && Array.isArray(data.legs)) {
    return data.legs.map(leg => leg.name);
  }
  const set = new Set();
  for (const l of data.locations || []) if (l.region) set.add(l.region);
  return Array.from(set);
}

function getSubLegsForLeg(data, legName) {
  const leg = data.legs?.find(l => l.name === legName);
  return leg?.sub_legs || [];
}

function filterByLeg(data, legName) {
  if (!legName || legName === 'all') return data.locations || [];

  const leg = data.legs?.find(l => l.name === legName);
  if (!leg) return data.locations || [];

  // Filter by regions, not by static date ranges
  const legRegions = leg.regions || [];
  if (legRegions.length === 0) return data.locations || [];

  return (data.locations || []).filter(location => {
    return legRegions.includes(location.region);
  });
}

function filterBySubLeg(data, legName, subLegName) {
  if (!subLegName) return filterByLeg(data, legName);

  const leg = data.legs?.find(l => l.name === legName);
  if (!leg) return [];

  const subLeg = leg.sub_legs?.find(sl => sl.name === subLegName);
  if (!subLeg) return [];

  // Filter locations by country (geographic relationship)
  const subLegCountries = subLeg.countries || [];
  return (data.locations || []).filter(location =>
    location.country && subLegCountries.includes(location.country)
  );
}

function getActivityColor(activityType) {
  const colors = {
    'diving': '#0077be',
    'cultural exploration': '#8e44ad',
    'trekking': '#27ae60',
    'safari': '#f39c12',
    'mountain climbing': '#e74c3c',
    'gorilla trekking': '#2ecc71',
    'city exploration': '#3498db',
    'wildlife': '#16a085',
    'northern lights': '#9b59b6',
    'nature exploration': '#27ae60',
    'river cruise': '#2980b9',
    'wildlife exploration': '#f39c12',
    'polar expedition': '#34495e',
    'transit': '#95a5a6',
    'buffer days': '#bdc3c7',
    'departure': '#e67e22',
    'arrival': '#e67e22'
  };
  return colors[activityType] || '#7f8c8d';
}

// Helper functions for cost display (fallbacks if not loaded from cost-utils-standalone.js)
function getCategoryIcon(category) {
  const icons = {
    accommodation: '🏨',
    flight: '✈️',
    activity: '🎯',
    food: '🍽️',
    transport: '🚗',
    other: '📦'
  };
  return icons[category] || '📦';
}

function getCategoryDisplayName(category) {
  const names = {
    accommodation: 'Accommodation',
    flight: 'Flights',
    activity: 'Activities',
    food: 'Food & Dining',
    transport: 'Local Transport',
    other: 'Other'
  };
  return names[category] || 'Other';
}

function getTransportationIcon(transportMode) {
  const icons = {
    'plane': '✈️',
    'train': '🚂', 
    'car': '🚗',
    'bus': '🚌',
    'ferry': '🚢',
    'walking': '🚶'
  };
  return icons[transportMode] || '✈️'; // Default to plane for international travel
}

// Known flight costs from the itinerary (per person)
const knownFlightCosts = {
  'SFO-DPS': 1500,
  'DPS-SOQ': 400,
  'SOQ-ROR': 700,
  'ROR-MNL': 400,
  'MNL-SIN': 200,
  'SIN-KUL': 100,
  'KUL-BKI': 200,
  'BKI-KUL': 200,
  'KUL-TPE': 250,
  'TPE-NRT': 300,
  'NRT-ICN': 200,
  'ICN-PEK': 250,
  'PEK-KTM': 300,
  'KTM-PBH': 400,
  'KTM-CPH': 600,
  'CPH-ARN': 100,
  'ARN-TOS': 250,
  'TOS-KEF': 300,
  'KEF-AMS': 400,
  'AMS-JRO': 700,
  'JRO-KGL': 300,
  'KGL-GIG': 1000,
  'GIG-MAO': 200,
  'MAO-UIO': 300,
  'UIO-GPS': 400,
  'GPS-EZE': 600,
  'EZE-SFO': 1800
};

function getTransportationCost(fromLocation, toLocation, transportMode, distance) {
  // Check for known flight costs first
  const fromCode = getAirportCode(fromLocation);
  const toCode = getAirportCode(toLocation);
  const routeKey = `${fromCode}-${toCode}`;
  
  if (knownFlightCosts[routeKey]) {
    return knownFlightCosts[routeKey] * 3; // Times 3 for 3 people
  }
  
  // Estimate based on transport mode and distance
  const distanceKm = distance / 1000;
  let costPerPerson = 0;
  
  switch (transportMode) {
    case 'plane':
      if (distanceKm > 8000) costPerPerson = 1200; // Long haul international
      else if (distanceKm > 3000) costPerPerson = 600; // Medium haul
      else if (distanceKm > 1000) costPerPerson = 300; // Regional
      else costPerPerson = 150; // Domestic short
      break;
    case 'train':
      costPerPerson = Math.max(50, distanceKm * 0.15); // ~$0.15 per km
      break;
    case 'bus':
      costPerPerson = Math.max(20, distanceKm * 0.08); // ~$0.08 per km
      break;
    case 'car':
      costPerPerson = Math.max(30, distanceKm * 0.12); // ~$0.12 per km (rental + gas)
      break;
    case 'ferry':
      costPerPerson = Math.max(25, distanceKm * 0.20); // ~$0.20 per km
      break;
    case 'walking':
      costPerPerson = 0;
      break;
    default:
      costPerPerson = 100; // Default estimate
  }
  
  return Math.round(costPerPerson * 3); // Times 3 for 3 people
}

function getAirportCode(location) {
  // Map cities to airport codes based on the itinerary
  const airportCodes = {
    'San Francisco': 'SFO',
    'Denpasar': 'DPS',
    'Bali': 'DPS',
    'Sorong': 'SOQ',
    'Raja Ampat': 'SOQ',
    'Koror': 'ROR',
    'Palau': 'ROR',
    'Manila': 'MNL',
    'Singapore': 'SIN',
    'Kuala Lumpur': 'KUL',
    'Kota Kinabalu': 'BKI',
    'Taipei': 'TPE',
    'Tokyo': 'NRT',
    'Seoul': 'ICN',
    'Beijing': 'PEK',
    'Kathmandu': 'KTM',
    'Paro': 'PBH',
    'Copenhagen': 'CPH',
    'Stockholm': 'ARN',
    'Tromsø': 'TOS',
    'Reykjavik': 'KEF',
    'Amsterdam': 'AMS',
    'Kilimanjaro': 'JRO',
    'Kigali': 'KGL',
    'Rio de Janeiro': 'GIG',
    'Manaus': 'MAO',
    'Quito': 'UIO',
    'Galápagos': 'GPS',
    'Buenos Aires': 'EZE'
  };
  
  return airportCodes[location.city] || airportCodes[location.name] || 'XXX';
}

function getTransportationMode(fromLocation, toLocation, index) {
  // Logic to determine transport mode based on distance and location types
  const distance = google.maps.geometry.spherical.computeDistanceBetween(
    new google.maps.LatLng(fromLocation.coordinates.lat, fromLocation.coordinates.lng),
    new google.maps.LatLng(toLocation.coordinates.lat, toLocation.coordinates.lng)
  );
  
  // If locations have explicit transport mode, use it
  if (toLocation.transport_from_previous) {
    return toLocation.transport_from_previous;
  }
  
  // Auto-detect based on distance and geography
  if (distance > 1000000) { // >1000km = likely flight
    return 'plane';
  } else if (distance > 500000) { // 500-1000km = could be train/bus/plane
    return fromLocation.country === toLocation.country ? 'train' : 'plane';
  } else if (distance > 100000) { // 100-500km = likely train/bus
    return 'train';
  } else if (distance > 20000) { // 20-100km = likely car/bus
    return 'car';
  } else {
    return 'walking';
  }
}

function addMarkersAndPath(map, locations, workingData, showRouting = false) {
  const info = new google.maps.InfoWindow();
  const markers = [];
  const pathCoords = [];
  const coordIndex = [];
  let activeMarker = null;
  let routingElements = [];

  locations.forEach((loc, idx) => {
    const ll = toLatLng(loc);
    if (!ll) return;
    pathCoords.push(ll);
    coordIndex.push(idx);

    const marker = new google.maps.Marker({
      position: ll,
      map,
      label: {
        text: String(idx + 1),
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold'
      },
      title: `${loc.name}${loc.city ? ', ' + loc.city : ''}${loc.country ? ', ' + loc.country : ''}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: getActivityColor(loc.activity_type),
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      }
    });
    
    const clickHandler = () => {
      highlightLocation(idx, marker, loc);
    };
    
    marker.addListener('click', clickHandler);
    marker.clickHandler = clickHandler;
    markers.push(marker);
  });

  // Add path with transportation icons
  if (pathCoords.length >= 2) {
    if (showRouting) {
      // Show path with transportation mode icons
      for (let i = 0; i < pathCoords.length - 1; i++) {
        const fromLocation = locations[coordIndex[i]];
        const toLocation = locations[coordIndex[i + 1]];
        
        // Create polyline segment
        const polyline = new google.maps.Polyline({
          path: [pathCoords[i], pathCoords[i + 1]],
          geodesic: true,
          strokeColor: '#1e88e5',
          strokeOpacity: 0.8,
          strokeWeight: 2
        });
        polyline.setMap(map);
        routingElements.push(polyline);
        
        // Add transportation icon at midpoint with cost information
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
          pathCoords[i], 
          pathCoords[i + 1]
        );
        const transportMode = getTransportationMode(fromLocation, toLocation, i);
        const cost = getTransportationCost(fromLocation, toLocation, transportMode, distance);
        const costText = cost > 0 ? `$${cost.toLocaleString()}` : 'Free';
        
        const midpoint = google.maps.geometry.spherical.interpolate(
          pathCoords[i], 
          pathCoords[i + 1], 
          0.5
        );
        
        const transportMarker = new google.maps.Marker({
          position: midpoint,
          map: map,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="14" fill="white" stroke="#1e88e5" stroke-width="2"/>
                <text x="16" y="14" text-anchor="middle" font-size="12">${getTransportationIcon(transportMode)}</text>
                <text x="16" y="26" text-anchor="middle" font-size="8" fill="#1e88e5" font-weight="bold">${costText}</text>
              </svg>
            `)}`,
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
          },
          title: `${fromLocation.name} → ${toLocation.name}\nTravel by ${transportMode}\nCost: ${costText} (3 people)\nDistance: ${Math.round(distance/1000)}km`,
          zIndex: 1000
        });
        
        // Add click handler to show detailed cost breakdown
        transportMarker.addListener('click', () => {
          const fromCode = getAirportCode(fromLocation);
          const toCode = getAirportCode(toLocation);
          const routeKey = `${fromCode}-${toCode}`;
          const isKnownCost = knownFlightCosts[routeKey];
          
          const infoContent = `
            <div style="max-width: 250px;">
              <h4 style="margin: 0 0 8px 0;">${getTransportationIcon(transportMode)} ${fromLocation.name} → ${toLocation.name}</h4>
              <p style="margin: 4px 0;"><strong>Transport:</strong> ${transportMode.charAt(0).toUpperCase() + transportMode.slice(1)}</p>
              <p style="margin: 4px 0;"><strong>Distance:</strong> ${Math.round(distance/1000)}km</p>
              <p style="margin: 4px 0;"><strong>Total Cost:</strong> ${costText} (3 people)</p>
              <p style="margin: 4px 0;"><strong>Per Person:</strong> $${Math.round(cost/3).toLocaleString()}</p>
              ${isKnownCost ? '<p style="margin: 4px 0; font-size: 12px; color: #1e88e5;">✓ From original itinerary</p>' : '<p style="margin: 4px 0; font-size: 12px; color: #888;">~ Estimated cost</p>'}
            </div>
          `;
          
          info.setContent(infoContent);
          info.setPosition(midpoint);
          info.open(map);
        });
        
        routingElements.push(transportMarker);
      }
    } else {
      // Simple path without transportation icons
      const polyline = new google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: '#1e88e5',
        strokeOpacity: 0.7,
        strokeWeight: 2
      });
      polyline.setMap(map);
      routingElements.push(polyline);
    }
  }

  function highlightLocation(index, marker, location) {
    if (activeMarker && activeMarker !== marker) {
      activeMarker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: getActivityColor(activeMarker.activityType),
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      });
    }
    
    marker.setIcon({
      path: google.maps.SymbolPath.CIRCLE,
      scale: 14,
      fillColor: getActivityColor(location.activity_type),
      fillOpacity: 1,
      strokeColor: '#ff4444',
      strokeWeight: 3
    });
    
    activeMarker = marker;
    activeMarker.activityType = location.activity_type;
    
    const name = location.name || '';
    const subtitle = [location.city, location.country].filter(Boolean).join(', ');
    const dr = formatDateRange(location.arrival_date, location.departure_date);
    const duration = location.duration_days ? `${location.duration_days} days` : '';
    const meta = [dr, duration].filter(Boolean).join(' • ');
    const activity = location.activity_type || '';
    const activityColor = getActivityColor(location.activity_type);
    const highlights = Array.isArray(location.highlights) ? location.highlights : [];
    const notes = location.notes || '';

    // Calculate costs for this location
    const costs = workingData.costs || [];
    const destinationCosts = window.calculateDestinationCosts(location.id, costs, location, workingData.locations);
    const costSummaryHTML = destinationCosts.total > 0 ? `
      <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin: 8px 0; border: 1px solid #e0e0e0;">
        <div style="font-weight: 600; color: #2563eb; margin-bottom: 4px;">${window.formatCurrency(destinationCosts.total)}</div>
        ${duration ? `<div style="font-size: 12px; color: #666;">${window.formatCurrency(destinationCosts.total / location.duration_days)}/day</div>` : ''}
        ${destinationCosts.count > 0 ? `<div style="font-size: 11px; color: #999;">${destinationCosts.count} cost items</div>` : ''}
      </div>
    ` : '';

    // Simple cost breakdown for marker popup (summary only)
    const costBreakdownHTML = destinationCosts.total > 0 ? `
      <div style="margin-top: 8px;">
        <div style="font-size: 12px; font-weight: 600; color: #333; margin-bottom: 4px;">Cost Breakdown:</div>
        ${Object.entries(destinationCosts.byCategory)
          .filter(([_, amount]) => amount > 0)
          .sort(([_, a], [__, b]) => b - a)
          .map(([category, amount]) => {
            const percentage = (amount / destinationCosts.total * 100).toFixed(1);
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0; font-size: 11px;">
                <span style="color: #666;">${window.getCategoryIcon(category)} ${window.getCategoryDisplayName(category)}</span>
                <span style="font-weight: 600; color: #333;">${window.formatCurrency(amount)} (${percentage}%)</span>
              </div>
            `;
          }).join('')}
      </div>
    ` : '';

    
    const content = `
      <div style="min-width: 260px; padding: 12px 14px;">
        <div style="font-weight: 700; font-size: 16px; margin-bottom: 6px;">${name}</div>
        ${subtitle ? `<div style="color: #666; margin-bottom: 4px;">${subtitle}</div>` : ''}
        ${meta ? `<div style="color: #444; margin-bottom: 8px;">${meta}</div>` : ''}
        ${activity ? `<div style="display: inline-block; color: #fff; padding: 2px 8px; border-radius: 999px; font-size: 12px; margin-bottom: 8px; background: ${activityColor}">${activity}</div>` : ''}
        ${costSummaryHTML}
        ${costBreakdownHTML}
        ${notes ? `<div style="background: #f8f9fa; padding: 8px; border-radius: 4px; margin: 8px 0; border-left: 3px solid ${activityColor}; font-size: 13px; color: #555;"><strong style="color: #333;">Notes:</strong><br>${notes.replace(/\n/g, '<br>')}</div>` : ''}
        ${highlights.length ? `<ul style="margin: 8px 0 0 18px; padding: 0;">${highlights.map(h => `<li style="margin: 2px 0;">${h}</li>`).join('')}</ul>` : ''}
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
          <a href="#" class="view-json-link" data-location-index="${index}" style="font-size: 12px; color: #1e88e5; text-decoration: none;">View JSON</a>
        </div>
      </div>
    `;

    info.setOptions({ maxWidth: 360 });
    info.setContent(content);
    info.open({ anchor: marker, map });

    // Add click handler for View JSON link
    // Capture location in closure
    const locationData = location;
    setTimeout(() => {
      const jsonLink = document.querySelector('.view-json-link');
      if (jsonLink) {
        jsonLink.addEventListener('click', (e) => {
          e.preventDefault();
          alert(JSON.stringify(locationData, null, 2));
        });
      }
    }, 0);
    
    map.panTo(marker.getPosition());
    
    if (window.updateSidebarHighlight) {
      window.updateSidebarHighlight(index);
    }
  }

  return { markers, highlightLocation, routingElements };
}

async function initMapApp() {
  const originalData = await loadData();
  let workingData = JSON.parse(JSON.stringify(originalData));
  console.log(`💰 Initial workingData has ${workingData.costs?.length || 0} cost items`);
  let currentScenarioId = null; // Track the currently loaded scenario ID
  // Expose to other modules (e.g., chat.js)
  window.currentScenarioId = currentScenarioId;
  let currentScenarioName = null; // Track the currently loaded scenario name
  const scenarioManager = new FirestoreScenarioManager();
  const statePersistence = new StatePersistence();
  const tripTitle = document.getElementById('trip-title');

  // Expose workingData globally for debugging and tools
  window.appWorkingData = workingData;

  // Helper to update workingData and keep global reference synced
  function updateWorkingData(newData) {
    workingData = newData;
    window.appWorkingData = workingData;
  }

  // Initialize cost tracking
  const costTracker = new CostTracker();
  const costUI = new CostUI(costTracker);
  const costComparison = new CostComparison();
  window.costTracker = costTracker;
  window.costUI = costUI;
  window.costComparison = costComparison;

  // Helper function to merge sub_legs and costs from template into loaded data
  function mergeSubLegsFromTemplate(data) {
    if (originalData.legs && data.legs) {
      data.legs = data.legs.map(leg => {
        const originalLeg = originalData.legs.find(ol => ol.name === leg.name);
        if (originalLeg?.sub_legs) {
          return { ...leg, sub_legs: originalLeg.sub_legs };
        }
        return leg;
      });
      console.log(`✅ Merged sub_legs from template (${originalData.legs.filter(l => l.sub_legs).length} legs with sub_legs)`);
    }
    // Preserve costs from original data if not present in loaded data
    if (originalData.costs && (!data.costs || data.costs.length === 0)) {
      data.costs = originalData.costs;
      console.log(`✅ Merged costs from template (${originalData.costs.length} cost items)`);
    }
    return data;
  }

  // Try to restore state from localStorage first
  const savedState = statePersistence.getState();
  console.log('📂 Restoring from saved state:', savedState);

  try {
    let scenarioLoaded = false;

    // If we have a saved scenario ID, try to load it
    if (savedState.scenarioId) {
      console.log(`🔄 Attempting to restore scenario: ${savedState.scenarioId}`);
      const scenario = await scenarioManager.getScenario(savedState.scenarioId);

      if (scenario) {
        const latestVersion = await scenarioManager.getLatestVersion(savedState.scenarioId);
        if (latestVersion && latestVersion.itineraryData) {
          console.log(`📥 Loaded from Firestore with ${latestVersion.itineraryData.costs?.length || 0} costs`);
          workingData = mergeSubLegsFromTemplate(latestVersion.itineraryData);
          console.log(`💰 After merge, workingData has ${workingData.costs?.length || 0} costs`);
          currentScenarioId = savedState.scenarioId;
          window.currentScenarioId = currentScenarioId;
          currentScenarioName = scenario.name;
          console.log(`✅ Restored scenario: ${scenario.name}`);
          scenarioLoaded = true;
        }
      } else {
        console.warn('⚠️ Saved scenario not found, clearing state');
        statePersistence.clearState();
      }
    }

    // If no scenario loaded yet (no saved state or saved scenario not found), load most recent one
    if (!scenarioLoaded) {
      const scenarios = await scenarioManager.listScenarios();
      if (scenarios.length > 0) {
        const lastScenario = scenarios[0];
        console.log(`📥 Loading most recent scenario: ${lastScenario.name}`);
        const latestVersion = await scenarioManager.getLatestVersion(lastScenario.id);
        if (latestVersion && latestVersion.itineraryData) {
          workingData = mergeSubLegsFromTemplate(latestVersion.itineraryData);
          currentScenarioId = lastScenario.id;
          window.currentScenarioId = currentScenarioId;
          currentScenarioName = lastScenario.name;
          console.log(`✅ Loaded most recent scenario: ${lastScenario.name} with ${workingData.locations?.length || 0} locations`);
          scenarioLoaded = true;
        }
      }
    }

    // If still no data loaded (no Firestore scenarios or static file), show helpful message
    if (!scenarioLoaded && (!workingData.locations || workingData.locations.length === 0)) {
      console.warn('⚠️ No scenarios found in Firestore and no static data file. App will start empty.');
    }

    // Ensure workingData has required properties
    if (!workingData.locations) workingData.locations = [];
    if (!workingData.legs) workingData.legs = [];
    if (!workingData.costs) workingData.costs = [];
  } catch (error) {
    console.warn('Could not load from Firestore, using default data:', error);
    // Fall back to original data if Firestore fails
  }

  tripTitle.textContent = workingData.trip?.title || 'Round The World Trip';

  const map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 0, lng: 0 },
    zoom: 2,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  const locations = workingData.locations || [];
  computeBounds(map, locations);

  const legFilter = document.getElementById('leg-filter');
  const subLegFilter = document.getElementById('sub-leg-filter');

  console.log('🔧 Sub-leg UI elements:', {
    legFilter: !!legFilter,
    subLegFilter: !!subLegFilter
  });

  function handleDataUpdate(newData, options = {}) {
    if (!newData) return;
    const { skipRecalc = false } = options;
    updateWorkingData(newData);
    if (!skipRecalc) {
      recalculateTripMetadata();
    }
    const showRouting = routingToggle ? routingToggle.checked : false;
    render(legFilter.value, subLegFilter.value, showRouting);
  }

  function refreshDataIntegrityButton() {
    // Update the badge in the dropdown instead of adding a separate button
    const badge = document.getElementById('data-integrity-badge');
    if (!badge) return;

    const validation = validateDataIntegrity(workingData);
    if (validation.valid && validation.warnings.length === 0) {
      badge.innerHTML = '<span style="color: #28a745; font-size: 12px;">✓ All OK</span>';
    } else {
      const issueCount = validation.errors.length + validation.warnings.length;
      badge.innerHTML = `<span style="background: #dc3545; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px;">${issueCount}</span>`;
    }
  }

  const legs = groupLegs(workingData);
  legs.forEach(legName => {
    const opt = document.createElement('option');
    opt.value = legName;
    opt.textContent = legName;
    legFilter.appendChild(opt);
  });

  function populateSubLegs(legName) {
    console.log(`🔍 populateSubLegs called with: ${legName}`);
    console.log(`  workingData.legs:`, workingData.legs);

    // Clear existing sub-leg options
    subLegFilter.innerHTML = '<option value="">All Destinations</option>';

    if (!legName || legName === 'all') {
      console.log('  ⚠️ Hiding sub-leg filter (no leg or "all" selected)');
      subLegFilter.style.display = 'none';
      return;
    }

    const leg = workingData.legs?.find(l => l.name === legName);
    console.log(`  🔎 Found leg:`, leg);
    console.log(`  🔎 Leg has sub_legs:`, leg?.sub_legs);

    const subLegs = getSubLegsForLeg(workingData, legName);
    console.log(`  📊 Found ${subLegs.length} sub-legs:`, subLegs.map(sl => sl?.name));

    if (subLegs.length > 0) {
      subLegs.forEach(subLeg => {
        const opt = document.createElement('option');
        opt.value = subLeg.name;
        opt.textContent = subLeg.name;
        subLegFilter.appendChild(opt);
      });
      console.log('  ✅ Showing sub-leg filter');
      subLegFilter.style.display = 'block';
    } else {
      console.log('  ⚠️ No sub-legs found, hiding filter');
      subLegFilter.style.display = 'none';
    }
  }

  let currentMarkers = [];
  let currentRoutingElements = [];
  let highlightLocationFn = null;
  let currentLocations = [];
  
  // Places API variables
  let pendingInsertIndex = null;
  let autocomplete = null;
  
  // Auto-save timer
  let autosaveTimer = null;

  async function triggerAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      try {
        // If we don't have a scenario yet, create a default one
        if (!currentScenarioId) {
          const defaultScenario = await scenarioManager.getOrCreateScenario(
            'My Trip',
            'Auto-saved trip planning'
          );
          currentScenarioId = defaultScenario.id;
          window.currentScenarioId = currentScenarioId;
          currentScenarioName = defaultScenario.name;
        }

        // Save as new version (skips if unchanged)
        const res = await scenarioManager.saveVersion(currentScenarioId, workingData, false);
        if (res && res.skipped) {
          console.debug('⏭️ Auto-save skipped (no changes)');
        } else {
          console.log('Auto-saved to Firestore');
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 2000); // Auto-save after 2 seconds of inactivity
  }

  function recalculateTripMetadata() {
    const locations = workingData.locations || [];
    if (!locations.length) return;

    const msPerDay = 24 * 60 * 60 * 1000;
    const toDate = (value) => (value ? new Date(value + 'T00:00:00Z') : null);

    const first = locations[0];
    const last = locations[locations.length - 1];

    const firstDate = toDate(first.arrival_date) || toDate(first.departure_date);
    const lastDate = toDate(last.departure_date) || toDate(last.arrival_date);

    if (firstDate) {
      workingData.trip = workingData.trip || {};
      workingData.trip.start_date = formatDate(firstDate);
    }
    if (lastDate) {
      workingData.trip = workingData.trip || {};
      workingData.trip.end_date = formatDate(lastDate);
      // Note: total_days is calculated dynamically from location durations, not stored statically
    }

    // Note: Leg start_date, end_date, and duration_days are calculated dynamically
    // from location data when needed, not stored as static metadata
  }

  function recalculateDates(locations, startDate) {
    if (!startDate) startDate = workingData.trip?.start_date || '2026-06-12';

    let currentDate = new Date(startDate + 'T00:00:00Z');

    locations.forEach((loc, idx) => {
      if (idx === 0) {
        loc.arrival_date = formatDate(currentDate);
        loc.departure_date = formatDate(addDays(currentDate, (loc.duration_days || 1) - 1));
      } else {
        const previousDeparture = locations[idx - 1].departure_date;
        if (previousDeparture) {
          currentDate = addDays(new Date(previousDeparture + 'T00:00:00Z'), 1);
        }
        loc.arrival_date = formatDate(currentDate);
        loc.departure_date = formatDate(addDays(currentDate, (loc.duration_days || 1) - 1));
      }
      currentDate = new Date(loc.departure_date + 'T00:00:00Z');
    });

    recalculateTripMetadata();
    triggerAutosave();
  }
  
  function render(legName, subLegName = null, useRouting = false, triggerAutoSave = true) {
    refreshDataIntegrityButton();

    currentMarkers.forEach(m => m.setMap(null));
    currentMarkers = [];

    currentRoutingElements.forEach(element => {
      if (element && element.setMap) {
        element.setMap(null);
      }
    });
    currentRoutingElements = [];

    const filtered = (subLegName && subLegName !== '')
      ? filterBySubLeg(workingData, legName, subLegName)
      : filterByLeg(workingData, legName);
    currentLocations = filtered;
    const { markers, highlightLocation, routingElements } = addMarkersAndPath(map, filtered, workingData, useRouting);
    currentMarkers = markers;
    currentRoutingElements = routingElements || [];
    highlightLocationFn = highlightLocation;
    computeBounds(map, filtered);

    updateSidebar(filtered);
    updateScenarioNameDisplay();

    // Trigger auto-save if scenario is loaded
    if (triggerAutoSave) {
      autoSaveScenario();
    }

    const summary = document.getElementById('summary');
    const sidebarSummary = document.getElementById('sidebar-summary');
    let summaryText = '';

    // Helper function to calculate total cost for filtered destinations
    const calculateTotalCost = (destinations) => {
      return destinations.reduce((sum, loc) => {
        // Use the same cost calculation function used elsewhere for consistency
        const allCosts = workingData.costs || [];
        const locationCosts = window.calculateDestinationCosts
          ? window.calculateDestinationCosts(loc.id, allCosts, loc, workingData.locations)
          : { total: allCosts.filter(c => c.destination_id === loc.id).reduce((s, cost) => s + (parseFloat(cost.amount_usd) || 0), 0) };
        return sum + locationCosts.total;
      }, 0);
    };

    // Helper function to calculate total duration for filtered destinations
    const calculateTotalDuration = (destinations) => {
      return destinations.reduce((sum, loc) => {
        return sum + (loc.duration_days || 1);
      }, 0);
    };

    if (legName === 'all') {
      const totalCost = calculateTotalCost(filtered);
      const totalDays = calculateTotalDuration(filtered);
      const formattedCost = window.formatCurrency ? window.formatCurrency(totalCost) : `$${Math.round(totalCost).toLocaleString()}`;
      summaryText = `${filtered.length} stops • ${totalDays} days • ${formattedCost}`;
    } else if (subLegName) {
      const leg = workingData.legs?.find(l => l.name === legName);
      const subLeg = leg?.sub_legs?.find(sl => sl.name === subLegName);
      if (subLeg) {
        const totalCost = calculateTotalCost(filtered);
        const formattedCost = window.formatCurrency ? window.formatCurrency(totalCost) : `$${Math.round(totalCost).toLocaleString()}`;

        // Calculate date range from actual filtered locations, not static subLeg metadata
        let dateRange = '';
        if (filtered.length > 0) {
          // Sort locations by date to find chronological first and last
          const sortedLocations = [...filtered].sort((a, b) => {
            const dateA = a.arrival_date || a.departure_date || '';
            const dateB = b.arrival_date || b.departure_date || '';
            return dateA.localeCompare(dateB);
          });

          const firstLocation = sortedLocations[0];
          const lastLocation = sortedLocations[sortedLocations.length - 1];
          const startDate = firstLocation.arrival_date || firstLocation.departure_date;
          const endDate = lastLocation.departure_date || lastLocation.arrival_date;

          if (startDate && endDate) {
            dateRange = formatDateCompact(startDate, endDate);
          }
        }

        summaryText = dateRange
          ? `${filtered.length} stops • ${subLegName} • ${dateRange} • ${formattedCost}`
          : `${filtered.length} stops • ${subLegName} • ${formattedCost}`;
      } else {
        summaryText = `${filtered.length} stops`;
      }
    } else {
      const leg = workingData.legs?.find(l => l.name === legName);
      if (leg) {
        const totalCost = calculateTotalCost(filtered);
        const totalDays = calculateTotalDuration(filtered);
        const formattedCost = window.formatCurrency ? window.formatCurrency(totalCost) : `$${Math.round(totalCost).toLocaleString()}`;

        // Calculate date range from actual filtered locations, not static leg metadata
        let dateRange = '';
        if (filtered.length > 0) {
          // Sort locations by date to find chronological first and last
          const sortedLocations = [...filtered].sort((a, b) => {
            const dateA = a.arrival_date || a.departure_date || '';
            const dateB = b.arrival_date || b.departure_date || '';
            return dateA.localeCompare(dateB);
          });

          const firstLocation = sortedLocations[0];
          const lastLocation = sortedLocations[sortedLocations.length - 1];
          const startDate = firstLocation.arrival_date || firstLocation.departure_date;
          const endDate = lastLocation.departure_date || lastLocation.arrival_date;

          if (startDate && endDate) {
            dateRange = formatDateCompact(startDate, endDate);
          }
        }

        summaryText = dateRange
          ? `${filtered.length} stops • ${legName} • ${dateRange} • ${formattedCost}`
          : `${filtered.length} stops • ${legName} • ${totalDays} days • ${formattedCost}`;
      } else {
        summaryText = `${filtered.length} stops`;
      }
    }

    if (summary) {
      summary.textContent = summaryText;
    }
    if (sidebarSummary) {
      sidebarSummary.textContent = summaryText;
    }
  }
  
  async function updateScenarioSelector() {
    const selector = document.getElementById('scenario-selector');
    const currentValue = selector.value;

    // Reset to default options
    selector.innerHTML = `
      <option value="">Unsaved Changes</option>
      <option value="__new__">+ New Scenario</option>
      <option disabled>──────────</option>
    `;

    try {
      // Load scenarios from Firestore
      const scenarios = await scenarioManager.listScenarios();
      scenarios.forEach(scenario => {
        const option = document.createElement('option');
        option.value = scenario.id;
        option.textContent = scenario.name;
        selector.appendChild(option);
      });

      // Restore selection if it still exists
      if (currentValue && currentValue !== '__new__' && scenarios.some(s => s.id === currentValue)) {
        selector.value = currentValue;
      } else if (currentScenarioId) {
        selector.value = currentScenarioId;
      }
    } catch (error) {
      console.error('Error loading scenarios:', error);
    }
  }

  async function updateViewSummaryButtonState() {
    const viewSummaryBtn = document.getElementById('view-summary-btn');
    if (!currentScenarioId) {
      // No scenario selected, disable button
      viewSummaryBtn.disabled = true;
      return;
    }

    try {
      // Check if current scenario has a saved summary
      const hasSummary = await scenarioManager.hasSummary(currentScenarioId);
      viewSummaryBtn.disabled = !hasSummary;
    } catch (error) {
      console.error('Error checking summary status:', error);
      viewSummaryBtn.disabled = true;
    }
  }

  // Display current scenario name in the Scenario section
  function updateScenarioNameDisplay() {
    const el = document.getElementById('scenario-name-display');
    if (!el) return;
    el.textContent = currentScenarioName || 'Unsaved Changes';
  }

  // Auto-save functionality
  let autoSaveTimeout = null;

  function showSaveIndicator() {
    const indicator = document.getElementById('save-indicator');
    indicator.classList.add('show');
    setTimeout(() => {
      indicator.classList.remove('show');
    }, 2000);
  }

  async function autoSaveScenario() {
    if (!currentScenarioId || !currentScenarioName) return;

    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
      try {
        console.log(`💾 Auto-saving scenario with ${workingData.costs?.length || 0} costs`);
        // Save as a new auto-version (skips if unchanged)
        const res = await scenarioManager.saveVersion(currentScenarioId, workingData, false);
        if (res && res.skipped) {
          console.debug('⏭️ Auto-save skipped (no changes)');
        } else {
          showSaveIndicator();
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 1000); // Debounce by 1 second
  }
  
  function buildCostAgentPrompt(destination, legName = '', subLegName = '') {
    if (!destination) return '';

    const locationBits = [];
    if (destination.name) locationBits.push(destination.name);
    if (destination.city && destination.city !== destination.name) locationBits.push(destination.city);
    if (destination.country) locationBits.push(destination.country);
    const locationLabel = locationBits.length ? locationBits.join(', ') : 'this destination';

    const segments = [`Please research and add updated cost estimates for ${locationLabel}.`];

    const scheduleBits = [];
    if (destination.duration_days) scheduleBits.push(`${destination.duration_days} day stay`);
    if (destination.arrival_date) scheduleBits.push(`arrival ${destination.arrival_date}`);
    if (destination.departure_date) scheduleBits.push(`departure ${destination.departure_date}`);
    if (scheduleBits.length) {
      segments.push(`Schedule: ${scheduleBits.join(' • ')}.`);
    }

    if (destination.activity_type) {
      segments.push(`Primary focus: ${destination.activity_type}.`);
    }

    const highlights = Array.isArray(destination.highlights)
      ? destination.highlights.filter(Boolean).slice(0, 3)
      : [];
    if (!highlights.length && typeof destination.notes === 'string') {
      const trimmedNotes = destination.notes.trim();
      if (trimmedNotes) {
        highlights.push(trimmedNotes);
      }
    }
    if (highlights.length) {
      segments.push(`Highlights or notes: ${highlights.join('; ')}.`);
    }

    if (legName && legName !== 'all') {
      const legContext = subLegName ? `${legName} › ${subLegName}` : legName;
      segments.push(`Leg context: ${legContext}.`);
    }

    const idSource = destination.id ?? destination.destination_id ?? destination.destinationId ?? destination.normalizedId ?? '';
    const destinationId = idSource ? normalizeId(idSource) : normalizeId(destination.name || locationLabel || 'unknown-destination');
    segments.push(`Destination ID: ${destinationId}.`);

    segments.push('Return 4-6 cost line items covering accommodation, transport, food, activities, and other key costs for the whole party.');
    segments.push('Respond with a JSON array where each item follows our schema: category, description, amount, currency, amount_usd, date, booking_status, source="ai_estimate", notes.');

    return segments.join('\n');
  }

  function requestCostUpdateFromAgent(destination, buttonEl, legName = '', subLegName = '') {
    const prompt = buildCostAgentPrompt(destination, legName, subLegName);
    if (!prompt) {
      console.warn('⚠️ Skipping cost update request - no prompt generated.');
      return;
    }

    if (!chatInstance) {
      alert('The AI Travel Concierge chat is not ready yet. Please open the AI panel and try again.');
      return;
    }

    const targetForm = chatInstance.chatColumnForm || chatInstance.chatForm || chatInstance.floatingChatForm;
    const targetInput = chatInstance.chatColumnInput || chatInstance.chatInput || chatInstance.floatingChatInput;

    if (!targetForm || !targetInput) {
      console.warn('⚠️ Unable to send cost request - chat form elements not found.');
      return;
    }

    if (typeof chatInstance.moveToColumn === 'function') {
      chatInstance.moveToColumn();
    }
    if (typeof chatInstance.openChat === 'function') {
      chatInstance.openChat();
    }

    targetInput.value = prompt;
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    targetForm.dispatchEvent(submitEvent);

    if (buttonEl) {
      const originalLabel = buttonEl.dataset.originalLabel || buttonEl.innerHTML;
      buttonEl.dataset.originalLabel = originalLabel;
      buttonEl.disabled = true;
      buttonEl.textContent = 'Request sent to cost agent';
      buttonEl.classList.add('update-costs-btn--sent');

      let restored = false;
      const restoreButton = () => {
        if (restored) return;
        restored = true;
        buttonEl.disabled = false;
        buttonEl.classList.remove('update-costs-btn--sent');
        buttonEl.innerHTML = buttonEl.dataset.originalLabel || originalLabel;
      };

      setTimeout(restoreButton, 6000);
      window.addEventListener('costs-updated', restoreButton, { once: true });
    }
  }

  function updateSidebar(locations) {
    const destinationList = document.getElementById('destination-list');
    const destinationCount = document.querySelector('.destination-count');

    const isFiltered = legFilter.value !== 'all';
    const countText = isFiltered
      ? `${locations.length} destinations (${legFilter.value} leg)`
      : `${locations.length} destinations`;
    if (destinationCount) {
      destinationCount.textContent = countText;
    }

    // Get costs data
    const costs = workingData.costs || [];
    console.log(`🎨 Rendering sidebar with ${costs.length} total costs for ${locations.length} locations`);
    console.log(`📍 Location IDs being displayed:`, locations.map(l => `${l.name}(${l.id})`));
    console.log(`💰 Cost destination IDs:`, [...new Set(costs.map(c => c.destination_id))].sort());
    console.log(`💵 Full cost data:`, costs.map(c => ({
      id: c.id,
      dest_id: c.destination_id,
      amount: c.amount_usd,
      category: c.category,
      desc: c.description?.substring(0, 30)
    })));

    
    // Build sidebar with add buttons between destinations
    const sidebarItems = [];

    locations.forEach((loc, idx) => {
      const dateRange = formatDateRange(loc.arrival_date, loc.departure_date);
      const duration = loc.duration_days || 1;
      const notes = loc.notes || '';

      // Calculate costs for this destination
      let destinationCosts, costSummaryHTML, costBreakdownHTML, costDetailsHTML;

      // Check if cost functions are available
      if (typeof window.calculateDestinationCosts === 'function') {
        // Pass location object for name-based matching
        destinationCosts = window.calculateDestinationCosts(loc.id, costs, loc, workingData.locations);
        console.log(`💵 ${loc.name}: ${destinationCosts.count} costs, $${destinationCosts.total}`);
        costSummaryHTML = window.generateSidebarCostSummary(destinationCosts, duration, loc.name);
        costBreakdownHTML = window.generateCostBreakdownHTML(destinationCosts, false, loc.name);
        costDetailsHTML = window.generateCostSummaryHTML(destinationCosts, duration);
      } else {
        // Fallback: simple cost calculation without external functions
        const destinationCostsManual = costs.filter(cost =>
          idsEqual(cost.destination_id ?? cost.destinationId, loc.id)
        );
        const totalCost = destinationCostsManual.reduce((sum, cost) => sum + (parseFloat(cost.amount_usd) || 0), 0);

        destinationCosts = {
          total: totalCost,
          count: destinationCostsManual.length,
          byCategory: { accommodation: 0, flight: 0, activity: 0, food: 0, transport: 0, other: 0 }
        };

        // Simple category breakdown
        destinationCostsManual.forEach(cost => {
          const category = cost.category || 'other';
          if (destinationCosts.byCategory.hasOwnProperty(category)) {
            destinationCosts.byCategory[category] += parseFloat(cost.amount_usd) || 0;
          }
        });

        // Simple HTML generation without external dependencies
        if (totalCost > 0) {
          costSummaryHTML = `
            <div class="destination-cost-summary">
              <div class="cost-total">
                <span class="cost-amount">$${totalCost.toLocaleString()}</span>
                ${duration > 0 ? `<span class="cost-per-day">$${Math.round(totalCost/duration)}/day</span>` : ''}
              </div>
              <div class="cost-breakdown-toggle">
                <span class="toggle-icon">▼</span>
                <span class="toggle-text">Details</span>
              </div>
            </div>
          `;
        } else {
          costSummaryHTML = `
            <div class="destination-cost-missing">
              <button
                class="update-costs-btn"
                data-destination-name="${loc.name}"
                title="Ask AI to research costs"
              >
                💰 Update costs for ${loc.name}
              </button>
            </div>
          `;
        }

        costBreakdownHTML = totalCost > 0 ? `
          <div class="cost-breakdown">
            ${Object.entries(destinationCosts.byCategory)
              .filter(([_, amount]) => amount > 0)
              .map(([category, amount]) => {
                const percentage = (amount / totalCost * 100).toFixed(1);
                return `
                  <div class="cost-breakdown-item">
                    <div class="cost-category">
                      <span class="cost-icon">${getCategoryIcon(category)}</span>
                      <span class="cost-name">${getCategoryDisplayName(category)}</span>
                    </div>
                    <div class="cost-amount">
                      <span class="cost-value">$${amount.toLocaleString()}</span>
                      <span class="cost-percentage">${percentage}%</span>
                    </div>
                  </div>
                `;
              }).join('')}
          </div>
        ` : '';

        costDetailsHTML = totalCost > 0 ? `
          <div class="cost-summary">
            <div class="cost-summary-row">
              <span class="cost-label">Total Cost:</span>
              <span class="cost-value total">$${totalCost.toLocaleString()}</span>
            </div>
            ${duration > 0 ? `
              <div class="cost-summary-row">
                <span class="cost-label">Per Day:</span>
                <span class="cost-value">$${Math.round(totalCost/duration).toLocaleString()}</span>
              </div>
            ` : ''}
            <div class="cost-summary-row">
              <span class="cost-label">Per Person:</span>
              <span class="cost-value">$${Math.round(totalCost/3).toLocaleString()}</span>
            </div>
            <div class="cost-summary-row">
              <span class="cost-label">Items:</span>
              <span class="cost-value">${destinationCosts.count}</span>
            </div>
          </div>
        ` : '';
      }

      
      // Add the destination item
      sidebarItems.push(`
        <div class="destination-item" data-index="${idx}" data-location-id="${loc.id}" draggable="true" style="display: flex; align-items: flex-start;">
          <div class="drag-handle">⋮⋮</div>
          <div class="destination-number" style="background: ${getActivityColor(loc.activity_type)}">${idx + 1}</div>
          <div class="destination-info">
            <div class="destination-name">${loc.name}</div>
            <div class="destination-location">
              <span>${[loc.city, loc.country].filter(Boolean).join(', ')}</span>
              ${loc.activity_type ? `<div class="destination-activity" style="background: ${getActivityColor(loc.activity_type)}">${loc.activity_type}</div>` : ''}
            </div>
            <div class="destination-dates">
              ${dateRange ? `${dateRange} • ` : ''}
              <input type="number" class="editable-duration" value="${duration}" min="1" max="365" data-location-id="${loc.id}"> days
            </div>
            ${costSummaryHTML}
            <div class="destination-cost-details" id="cost-details-${loc.id}">
              ${costBreakdownHTML}
              ${costDetailsHTML}
            </div>
            <div class="destination-notes">
              <textarea class="editable-notes" placeholder="Add notes..." data-location-id="${loc.id}">${notes}</textarea>
            </div>
          </div>
          <button class="delete-destination-btn" data-location-id="${loc.id}" title="Delete destination">×</button>
        </div>
      `);
    });
    
    destinationList.innerHTML = sidebarItems.join('');

    destinationList.querySelectorAll('.update-costs-btn').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;

        const container = button.closest('.destination-item');
        const destinationId = container?.dataset.locationId;
        const destinationName = button.dataset.destinationName;

        const destination = (workingData.locations || []).find(candidate => {
          if (destinationId) {
            return idsEqual(candidate.id, destinationId);
          }
          return candidate.name === destinationName || candidate.city === destinationName;
        });

        if (!destination) {
          console.warn('⚠️ Unable to find destination for cost update request:', destinationName, destinationId);
          return;
        }

        const legName = legFilter ? legFilter.value : '';
        const subLegName = subLegFilter ? subLegFilter.value : '';

        requestCostUpdateFromAgent(destination, button, legName, subLegName);
      });
    });
    
    // Add click handlers for destinations
    destinationList.querySelectorAll('.destination-item').forEach((item, idx) => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('editable-duration') || 
            e.target.classList.contains('editable-notes') || 
            e.target.classList.contains('drag-handle') ||
            e.target.classList.contains('delete-destination-btn')) return;
        if (highlightLocationFn) {
          const marker = currentMarkers[idx];
          const location = locations[idx];
          highlightLocationFn(idx, marker, location);
        }
      });
    });

    // Add click handlers for delete buttons
    destinationList.querySelectorAll('.delete-destination-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const locationId = e.currentTarget.dataset.locationId;
        deleteDestination(locationId);
      });
    });

    // Add click handlers for cost breakdown toggles
    destinationList.querySelectorAll('.cost-breakdown-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const toggleElement = e.currentTarget;
        const destinationItem = toggleElement.closest('.destination-item');

        if (destinationItem) {
          const costDetails = destinationItem.querySelector('.destination-cost-details');
          if (costDetails) {
            costDetails.classList.toggle('visible');
            toggleElement.classList.toggle('expanded');
          }
        }
      });
    });

    setupDragAndDrop(destinationList, locations);
    setupDurationEditing(destinationList, locations);
    setupNotesEditing(destinationList, locations);
  }
  
  function setupDragAndDrop(container, filteredLocations) {
    let draggedElement = null;
    let draggedIndex = null;
    
    container.querySelectorAll('.destination-item').forEach((item, idx) => {
      item.addEventListener('dragstart', (e) => {
        draggedElement = item;
        draggedIndex = idx;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        container.querySelectorAll('.destination-item').forEach(el => {
          el.classList.remove('drag-over');
        });
      });
      
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      
      item.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (item !== draggedElement) {
          item.classList.add('drag-over');
        }
      });
      
      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });
      
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const dropIndex = idx;
        
        if (draggedIndex !== null && draggedIndex !== dropIndex) {
          const draggedLocation = filteredLocations[draggedIndex];
          const targetLocation = filteredLocations[dropIndex];
          
          const globalDraggedIndex = workingData.locations.findIndex(loc => loc.id === draggedLocation.id);
          const globalTargetIndex = workingData.locations.findIndex(loc => loc.id === targetLocation.id);
          
          if (globalDraggedIndex !== -1 && globalTargetIndex !== -1) {
            const movedLocation = workingData.locations.splice(globalDraggedIndex, 1)[0];
            let newInsertIndex = globalTargetIndex;
            if (globalDraggedIndex < globalTargetIndex) {
              newInsertIndex--;
            }
            workingData.locations.splice(newInsertIndex, 0, movedLocation);
            
            recalculateDates(workingData.locations);
            render(legFilter.value, subLegFilter.value, routingToggle.checked);
          }
        }
      });
    });
  }
  
  function setupDurationEditing(container, filteredLocations) {
    container.querySelectorAll('.editable-duration').forEach(input => {
      input.addEventListener('change', (e) => {
        const locationId = e.target.dataset.locationId;
        const newDuration = parseInt(e.target.value, 10) || 1;
        
        const globalLocation = workingData.locations.find(loc => idsEqual(loc.id, locationId));
        if (globalLocation) {
          globalLocation.duration_days = newDuration;
          recalculateDates(workingData.locations);
          render(legFilter.value, subLegFilter.value, routingToggle.checked);
        }
      });
      
      input.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
  }
  
  function setupNotesEditing(container, filteredLocations) {
    container.querySelectorAll('.editable-notes').forEach(textarea => {
      // Auto-resize function
      const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      };

      // Initial resize
      autoResize();

      // Auto-save notes on change with debouncing
      let notesTimer = null;

      textarea.addEventListener('input', (e) => {
        autoResize();

        const locationId = e.target.dataset.locationId;
        const newNotes = e.target.value;

        // Clear previous timer
        if (notesTimer) clearTimeout(notesTimer);

        // Set new timer to save after 1 second of no typing
        notesTimer = setTimeout(() => {
          const globalLocation = workingData.locations.find(loc => idsEqual(loc.id, locationId));
          if (globalLocation) {
            globalLocation.notes = newNotes;
            triggerAutosave();
          }
        }, 1000);
      });

      textarea.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      textarea.addEventListener('focus', (e) => {
        e.stopPropagation();
      });
    });
  }
  
  function updateSidebarHighlight(activeIndex) {
    const items = document.querySelectorAll('.destination-item');
    items.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add('active');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }
  
  // Add destination functionality
  function initializePlacesAPI() {
    if (!window.google || !window.google.maps.places) {
      setTimeout(initializePlacesAPI, 100);
      return;
    }
    
    const searchInput = document.getElementById('location-search');
    autocomplete = new google.maps.places.Autocomplete(searchInput, {
      types: ['(cities)'],
      fields: ['place_id', 'name', 'geometry', 'formatted_address', 'address_components']
    });
    
    autocomplete.bindTo('bounds', map);
    
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        document.getElementById('selected-place').value = JSON.stringify({
          place_id: place.place_id,
          name: place.name,
          formatted_address: place.formatted_address,
          location: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          },
          address_components: place.address_components
        });
      }
    });
  }
  
  // Calculate best insertion point based on geographic proximity
  function findBestInsertionIndex(newLocation) {
    if (!workingData.locations || workingData.locations.length === 0) {
      return 0;
    }

    if (!newLocation || !newLocation.lat || !newLocation.lng) {
      console.warn('Invalid location data, appending to end');
      return workingData.locations.length;
    }

    const newLat = newLocation.lat;
    const newLng = newLocation.lng;

    // Calculate distance to each existing location
    let minDistance = Infinity;
    let bestIndex = workingData.locations.length; // Default to end

    workingData.locations.forEach((loc, idx) => {
      // Skip locations without valid coordinates
      if (!loc.coordinates || !loc.coordinates.lat || !loc.coordinates.lng) {
        console.warn('Skipping location without coordinates:', loc.name);
        return;
      }

      const distance = Math.sqrt(
        Math.pow(loc.coordinates.lat - newLat, 2) +
        Math.pow(loc.coordinates.lng - newLng, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        // Insert after the nearest neighbor
        bestIndex = idx + 1;
      }
    });

    console.log('Best insertion index:', bestIndex, 'nearest distance:', minDistance);
    return bestIndex;
  }

  function openAddDestinationModal(insertIndex = null) {
    // If no index specified, we'll calculate it after place selection
    pendingInsertIndex = insertIndex;
    const modal = document.getElementById('add-destination-modal');
    const searchInput = document.getElementById('location-search');
    const durationInput = document.getElementById('duration-input');

    console.log('Opening modal:', { modal, searchInput, durationInput, insertIndex });

    searchInput.value = '';
    durationInput.value = '3';

    if (!document.getElementById('selected-place')) {
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.id = 'selected-place';
      document.getElementById('add-destination-form').appendChild(hiddenInput);
    }
    document.getElementById('selected-place').value = '';

    modal.style.display = 'flex';
    console.log('Modal display set to flex, computed style:', window.getComputedStyle(modal).display);
    searchInput.focus();

    if (autocomplete) {
      autocomplete.setBounds(map.getBounds());
    }
  }
  
  function closeAddDestinationModal() {
    document.getElementById('add-destination-modal').style.display = 'none';
    pendingInsertIndex = null;
  }
  
  function generateNewLocationId() {
    const existingIds = new Set((workingData.locations || []).map(loc => normalizeId(loc.id)));
    let newId = generateDestinationId();
    while (existingIds.has(normalizeId(newId))) {
      newId = generateDestinationId();
    }
    return newId;
  }
  
  function parseAddressComponents(components) {
    const result = { city: '', country: '', region: '' };
    
    components.forEach(component => {
      const types = component.types;
      if (types.includes('locality')) {
        result.city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        result.region = component.long_name;
      } else if (types.includes('country')) {
        result.country = component.long_name;
      }
    });
    
    return result;
  }
  
  function addNewDestination(insertIndex, placeData, duration) {
    const addressInfo = parseAddressComponents(placeData.address_components || []);

    // Determine leg and sub_leg from neighbor
    let leg = null;
    let sub_leg = null;
    if (workingData.locations && workingData.locations.length > 0) {
      // Use the neighbor before the insertion point, or after if inserting at start
      const neighborIndex = insertIndex > 0 ? insertIndex - 1 : 0;
      const neighbor = workingData.locations[neighborIndex];
      if (neighbor) {
        leg = neighbor.leg || null;
        sub_leg = neighbor.sub_leg || null;
      }
    }

    const newLocation = {
      id: generateNewLocationId(),
      name: placeData.name,
      city: addressInfo.city,
      country: addressInfo.country,
      region: addressInfo.region || 'Custom',
      coordinates: {  // Use 'coordinates' to match data structure
        lat: placeData.location.lat,
        lng: placeData.location.lng
      },
      duration_days: duration,
      activity_type: 'city exploration',
      highlights: [],
      notes: '',
      arrival_date: null,
      departure_date: null,
      leg: leg,
      sub_leg: sub_leg
    };

    workingData.locations.splice(insertIndex, 0, newLocation);
    recalculateDates(workingData.locations);
    recalculateTripMetadata();
    render(legFilter.value, subLegFilter.value, routingToggle.checked);
    closeAddDestinationModal();
  }

  function deleteDestination(destinationId) {
    if (!destinationId) return;

    const totalLocations = workingData.locations?.length || 0;
    if (totalLocations <= 1) {
      alert('Cannot delete the last destination. Your trip must have at least one destination.');
      return;
    }

    const location = workingData.locations.find(loc => idsEqual(loc.id, destinationId));
    if (!location) {
      console.warn('Destination not found for deletion:', destinationId);
      return;
    }

    const associatedCosts = (workingData.costs || []).filter(cost =>
      idsEqual(cost.destination_id ?? cost.destinationId, destinationId)
    );

    showDestinationDeletionDialog(location, associatedCosts, (options = {}) => {
      const updatedData = handleDestinationDeletion(workingData, destinationId, options);
      updateWorkingData(updatedData);

      if (options.recalculateDates) {
        recalculateDates(workingData.locations);
      } else {
        recalculateTripMetadata();
      }

      const showRouting = routingToggle ? routingToggle.checked : false;
      render(legFilter.value, subLegFilter.value, showRouting);
    });

    const modal = document.getElementById('delete-destination-modal');
    if (modal) {
      const dropdown = modal.querySelector('#reassign-dest-dropdown');
      if (dropdown) {
        populateReassignDropdown(dropdown, workingData.locations, destinationId);
      }
    }
  }

  // Scenario management functions
  async function openSaveScenarioModal() {
    const modal = document.getElementById('save-scenario-modal');
    const nameInput = document.getElementById('scenario-name');
    const descriptionInput = document.getElementById('scenario-description');

    // If we're updating an existing scenario, pre-populate the form
    if (currentScenarioId) {
      try {
        const scenario = await scenarioManager.getScenario(currentScenarioId);
        if (scenario) {
          nameInput.value = scenario.name;
          descriptionInput.value = scenario.description || '';
        }
      } catch (error) {
        console.error('Error loading scenario:', error);
      }
    } else {
      // Clear the form for new scenarios
      nameInput.value = '';
      descriptionInput.value = '';
    }

    modal.style.display = 'flex';
    nameInput.focus();
  }
  
  function closeSaveScenarioModal() {
    document.getElementById('save-scenario-modal').style.display = 'none';
    document.getElementById('scenario-name').value = '';
    document.getElementById('scenario-description').value = '';
  }
  
  function openManageScenariosModal() {
    updateScenarioList();
    document.getElementById('manage-scenarios-modal').style.display = 'flex';
  }
  
  function closeManageScenariosModal() {
    document.getElementById('manage-scenarios-modal').style.display = 'none';
  }
  
  async function updateScenarioList() {
    const scenarioList = document.getElementById('scenario-list');

    try {
      const scenarios = await scenarioManager.listScenarios();

      if (scenarios.length === 0) {
        scenarioList.innerHTML = '<div class="empty-scenarios">No saved scenarios yet.</div>';
        return;
      }

      const scenarioItems = await Promise.all(
        scenarios.map(async (scenario) => {
          const createdDate = scenario.createdAt?.toDate ? scenario.createdAt.toDate().toLocaleDateString() : 'Unknown';
          const latestVersion = await scenarioManager.getLatestVersion(scenario.id);
          const locationCount = latestVersion?.itineraryData?.locations?.length || 0;

          return `
            <div class="scenario-item">
              <div class="scenario-info">
                <div class="scenario-name">${scenario.name}</div>
                <div class="scenario-meta">${locationCount} destinations • v${scenario.currentVersion || 1} • Created ${createdDate}</div>
                ${scenario.description ? `<div class="scenario-description">${scenario.description}</div>` : ''}
              </div>
              <div class="scenario-actions-btn">
                <button class="btn-load" onclick="loadScenarioById('${scenario.id}')">Load</button>
                <button class="btn-versions" onclick="showVersionHistory('${scenario.id}')">History</button>
                <button class="btn-rename" onclick="renameScenarioById('${scenario.id}', '${scenario.name.replace(/'/g, "\\'")}')">Rename</button>
                <button class="btn-delete" onclick="deleteScenarioById('${scenario.id}')">Delete</button>
              </div>
            </div>
          `;
        })
      );

      scenarioList.innerHTML = scenarioItems.join('');
    } catch (error) {
      console.error('Error loading scenarios:', error);
      scenarioList.innerHTML = '<div class="empty-scenarios">Error loading scenarios.</div>';
    }
  }

  window.loadScenarioById = async function(scenarioId) {
    try {
      const scenario = await scenarioManager.getScenario(scenarioId);
      const latestVersion = await scenarioManager.getLatestVersion(scenarioId);

      if (scenario && latestVersion) {
        workingData = mergeSubLegsFromTemplate(JSON.parse(JSON.stringify(latestVersion.itineraryData)));
        currentScenarioId = scenarioId;
        window.currentScenarioId = currentScenarioId;
        currentScenarioName = scenario.name;
        render(legFilter.value, subLegFilter.value, routingToggle.checked);
        updateChatContext(legFilter.value, subLegFilter.value);
        closeManageScenariosModal();
        updateScenarioNameDisplay();

        // Save scenario selection to state
        statePersistence.saveScenarioSelection(scenarioId);

        // Update view summary button state
        await updateViewSummaryButtonState();
      }
    } catch (error) {
      console.error('Error loading scenario:', error);
      alert('Failed to load scenario');
    }
  };

  window.deleteScenarioById = async function(scenarioId) {
    if (confirm('Delete this scenario and all its versions?')) {
      try {
        await scenarioManager.deleteScenario(scenarioId);
        await updateScenarioList();

        // If we deleted the current scenario, reset
        if (currentScenarioId === scenarioId) {
          currentScenarioId = null;
          window.currentScenarioId = currentScenarioId;
          currentScenarioName = null;
        }
      } catch (error) {
        console.error('Error deleting scenario:', error);
        alert('Failed to delete scenario');
      }
    }
  };

  window.renameScenarioById = async function(scenarioId, currentName, isDynamicModal = false) {
    const newName = prompt('Enter new name for scenario:', currentName);

    if (newName === null) {
      // User cancelled
      return;
    }

    if (!newName.trim()) {
      alert('Scenario name cannot be empty');
      return;
    }

    try {
      await scenarioManager.renameScenario(scenarioId, newName);

      // Refresh the appropriate modal
      if (isDynamicModal) {
        await window.showManageScenarios();
      } else {
        await updateScenarioList();
      }

      // If we renamed the current scenario, update the display
      if (currentScenarioId === scenarioId) {
        currentScenarioName = newName.trim();
        updateScenarioNameDisplay();
      }
    } catch (error) {
      console.error('Error renaming scenario:', error);
      alert('Failed to rename scenario: ' + error.message);
    }
  };

  window.duplicateScenario = async function(scenarioId) {
    try {
      const scenario = await scenarioManager.getScenario(scenarioId);
      const latest = await scenarioManager.getLatestVersion(scenarioId);
      const baseName = scenario?.name || 'Itinerary';
      const defaultName = `Copy of ${baseName}`;
      const newName = prompt('Enter name for duplicated scenario:', defaultName);

      if (!newName || !newName.trim()) return;

      const scenarioData = {
        name: newName.trim(),
        description: `Duplicated from ${baseName}`,
        data: JSON.parse(JSON.stringify(latest?.itineraryData || {})),
      };
      const newScenarioId = await scenarioManager.saveScenario(scenarioData);

      // Load the duplicated scenario
      await window.loadScenarioById(newScenarioId);
      // Refresh list
      await window.showManageScenarios();
      alert(`Scenario "${newName.trim()}" has been created.`);
    } catch (err) {
      console.error('Error duplicating scenario:', err);
      alert('Failed to duplicate scenario');
    }
  };

  window.showVersionHistory = async function(scenarioId) {
    try {
      const scenario = await scenarioManager.getScenario(scenarioId);
      const versions = await scenarioManager.getVersionHistory(scenarioId);

      if (!versions || versions.length === 0) {
        alert('No version history available for this scenario.');
        return;
      }

      // Create version history display
      const versionItems = versions.map(version => {
        const createdDate = version.createdAt?.toDate ? version.createdAt.toDate().toLocaleString() : 'Unknown';
        const versionLabel = version.isNamed ? `📌 v${version.versionNumber} - ${version.versionName}` : `v${version.versionNumber}`;
        const locationCount = version.itineraryData?.locations?.length || 0;

        return `
          <div class="version-item" style="padding: 12px; border-bottom: 1px solid #eee;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight: bold; margin-bottom: 4px;">${versionLabel}</div>
                <div style="font-size: 12px; color: #666;">${locationCount} destinations • ${createdDate}</div>
              </div>
              <div style="display:flex; gap:8px;">
                <button onclick="revertToVersion('${scenarioId}', ${version.versionNumber})" style="padding:6px 10px; background:#0070f3; color:#fff; border:none; border-radius:4px; cursor:pointer;">Revert</button>
                <button onclick="nameVersionPrompt('${scenarioId}', ${version.versionNumber})" style="padding:6px 10px; background:#666; color:#fff; border:none; border-radius:4px; cursor:pointer;">Label</button>
                <button onclick="deleteVersionPrompt('${scenarioId}', ${version.versionNumber})" style="padding:6px 10px; background:#fff; color:#d32f2f; border:1px solid #eee; border-radius:4px; cursor:pointer;">Delete</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Show in a simple dialog
      const message = `Version History for "${scenario.name}"\n\nClick a version to revert to it:\n\n${versionItems}`;

      // Create custom modal for version history
      const existingModal = document.getElementById('version-history-modal');
      if (existingModal) {
        existingModal.remove();
      }

      const modal = document.createElement('div');
      modal.id = 'version-history-modal';
      modal.className = 'modal-overlay';
      modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100001; align-items: center; justify-content: center;';
      modal.innerHTML = `
        <div class="modal-content" style="background: white; padding: 24px; border-radius: 8px; max-width: 600px; max-height: 80vh; overflow-y: auto; width: 90%;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin-top: 0;">Version History: ${scenario.name}</h3>
            <button onclick="deleteUnlabeledPrompt('${scenarioId}')" style="padding:6px 10px; background:#fff; color:#333; border:1px solid #eee; border-radius:4px; cursor:pointer;">Delete Unlabeled</button>
          </div>
          <p style="color: #666; font-size: 14px;">Manage versions: revert, label, or delete</p>
          <div class="version-list">
            ${versionItems}
          </div>
          <div style="margin-top: 20px; text-align: right;">
            <button onclick="document.getElementById('version-history-modal').remove()" style="padding: 8px 16px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Close on outside click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
      
      // Delete single version
      window.deleteVersionPrompt = async function(sId, vNum) {
        if (!confirm(`Delete version v${vNum}? This cannot be undone.`)) return;
        try {
          await scenarioManager.deleteVersion(sId, vNum);
          await window.showVersionHistory(sId);
        } catch (err) {
          console.error('Error deleting version:', err);
          alert('Failed to delete version');
        }
      };

      // Delete unlabeled versions (keep latest by default)
      window.deleteUnlabeledPrompt = async function(sId) {
        const keepLatest = confirm('Delete all unlabeled versions except the latest? Click Cancel to delete ALL unlabeled.');
        try {
          const res = await scenarioManager.deleteUnlabeledVersions(sId, keepLatest);
          await window.showVersionHistory(sId);
          alert(`Deleted ${res.deleted || 0} unlabeled version(s).`);
        } catch (err) {
          console.error('Error deleting unlabeled versions:', err);
          alert('Failed to delete unlabeled versions');
        }
      };
    } catch (error) {
      console.error('Error showing version history:', error);
      alert('Failed to load version history');
    }
  };

  window.nameVersionPrompt = async function(scenarioId, versionNumber) {
    const name = prompt(`Enter a label for version ${versionNumber}:`);
    if (!name || !name.trim()) return;
    try {
      await scenarioManager.nameVersion(scenarioId, versionNumber, name.trim());
      // Refresh the version history modal
      await window.showVersionHistory(scenarioId);
    } catch (error) {
      console.error('Error naming version:', error);
      alert('Failed to label version');
    }
  };

  window.revertToVersion = async function(scenarioId, versionNumber) {
    if (!confirm(`Revert to version ${versionNumber}? This will create a new version with the old data.`)) {
      return;
    }

    try {
      const newVersion = await scenarioManager.revertToVersion(scenarioId, versionNumber);

      // Close version history modal
      const modal = document.getElementById('version-history-modal');
      if (modal) modal.remove();

      // Reload the scenario to show reverted state
      if (currentScenarioId === scenarioId) {
        await window.loadScenarioById(scenarioId);
      }

      alert(`Reverted to version ${versionNumber}. New version ${newVersion.versionNumber} created.`);
    } catch (error) {
      console.error('Error reverting version:', error);
      alert('Failed to revert to version');
    }
  };
  
  function openImportScenariosModal() {
    document.getElementById('import-scenarios-modal').style.display = 'flex';
  }
  
  function closeImportScenariosModal() {
    document.getElementById('import-scenarios-modal').style.display = 'none';
    document.getElementById('scenario-file').value = '';
    document.getElementById('overwrite-scenarios').checked = false;
  }
  
  window.updateSidebarHighlight = updateSidebarHighlight;

  const routingToggle = document.getElementById('routing-toggle');
  
  function updateMap() {
    const legName = legFilter.value;
    const subLegName = subLegFilter.value || null;
    render(legName, subLegName, routingToggle.checked);
  }

  legFilter.addEventListener('change', function(e) {
    populateSubLegs(e.target.value);
    subLegFilter.value = ''; // Reset sub-leg selection
    updateMap();
    updateChatContext(e.target.value, null);

    // Save leg selection to state
    statePersistence.saveLegSelection(e.target.value, null);
  });

  subLegFilter.addEventListener('change', function(e) {
    updateMap();
    // Save sub-leg selection to state
    statePersistence.saveLegSelection(legFilter.value, e.target.value || null);
  });
  routingToggle.addEventListener('change', updateMap);
  
  // Export scenario button
  document.getElementById('export-scenario-btn').addEventListener('click', () => {
    const dataStr = JSON.stringify(workingData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    const scenarioName = currentScenarioName || 'itinerary';
    link.download = `${scenarioName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
  
  // Scenario actions dropdown toggle
  console.log('Setting up scenario actions button...');
  const scenarioActionsBtn = document.getElementById('scenario-actions-btn');
  const scenarioActionsDropdown = document.getElementById('scenario-actions-dropdown');
  console.log('Found elements:', { btn: scenarioActionsBtn, dropdown: scenarioActionsDropdown });

  if (scenarioActionsBtn && scenarioActionsDropdown) {
    console.log('Adding click listener to scenario actions button');
    scenarioActionsBtn.addEventListener('click', (e) => {
      console.log('Scenario actions button clicked!');
      e.stopPropagation();
      const isVisible = scenarioActionsDropdown.style.display !== 'none';
      console.log('Is visible?', isVisible, 'Current display:', scenarioActionsDropdown.style.display);

      if (isVisible) {
        scenarioActionsDropdown.style.display = 'none';
        scenarioActionsBtn.classList.remove('active');
      } else {
        // Position the dropdown below the button using fixed positioning
        const rect = scenarioActionsBtn.getBoundingClientRect();
        scenarioActionsDropdown.style.top = (rect.bottom + 2) + 'px';
        // Align dropdown to the right edge of the button
        scenarioActionsDropdown.style.right = (window.innerWidth - rect.right) + 'px';
        scenarioActionsDropdown.style.left = 'auto';
        scenarioActionsDropdown.style.display = 'block';
        scenarioActionsBtn.classList.add('active');
      }
      console.log('New display:', scenarioActionsDropdown.style.display);
    });
  } else {
    console.error('Scenario actions button or dropdown not found!', {
      btn: scenarioActionsBtn,
      dropdown: scenarioActionsDropdown
    });
  }

  // Close dropdown when clicking outside
  if (scenarioActionsBtn && scenarioActionsDropdown) {
    document.addEventListener('click', (e) => {
      if (!scenarioActionsDropdown.contains(e.target) &&
          !scenarioActionsBtn.contains(e.target)) {
        scenarioActionsDropdown.style.display = 'none';
        scenarioActionsBtn.classList.remove('active');
      }
    });
  }


  // Dynamic Manage Scenarios modal (same pattern as Version History)
  window.showManageScenarios = async function() {
    try {
      // Fetch scenarios and latest metadata
      const scenarios = await scenarioManager.listScenarios();

      // Build list items similar to updateScenarioList()
      const scenarioItems = await Promise.all(
        scenarios.map(async (scenario) => {
          const createdDate = scenario.createdAt?.toDate ? scenario.createdAt.toDate().toLocaleDateString() : 'Unknown';
          const latestVersion = await scenarioManager.getLatestVersion(scenario.id);
          const locationCount = latestVersion?.itineraryData?.locations?.length || 0;

          return `
            <div class="scenario-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee;">
              <div class="scenario-info">
                <div class="scenario-name" style="font-weight:600;">${scenario.name}</div>
                <div class="scenario-meta" style="font-size:12px; color:#666;">${locationCount} destinations • v${scenario.currentVersion || 1} • Created ${createdDate}</div>
                ${scenario.description ? `<div class="scenario-description" style="margin-top:4px; color:#555; font-size:12px;">${scenario.description}</div>` : ''}
              </div>
              <div class="scenario-actions-btn" style="display:flex; gap:8px;">
                <button onclick="loadScenarioById('${scenario.id}')" style="padding:6px 10px; background:#0070f3; color:#fff; border:none; border-radius:4px; cursor:pointer;">Load</button>
                <button onclick="showVersionHistory('${scenario.id}')" style="padding:6px 10px; background:#666; color:#fff; border:none; border-radius:4px; cursor:pointer;">History</button>
                <button onclick="duplicateScenario('${scenario.id}')" style="padding:6px 10px; background:#fff; color:#333; border:1px solid #eee; border-radius:4px; cursor:pointer;">Duplicate</button>
                <button onclick="renameScenarioById('${scenario.id}', '${scenario.name.replace(/'/g, "\\'")}', true)" style="padding:6px 10px; background:#ff9800; color:#fff; border:none; border-radius:4px; cursor:pointer;">Rename</button>
                <button onclick="deleteScenarioById('${scenario.id}')" style="padding:6px 10px; background:#fff; color:#d32f2f; border:1px solid #eee; border-radius:4px; cursor:pointer;">Delete</button>
              </div>
            </div>
          `;
        })
      );

      const listHtml = scenarioItems.join('') || '<div class="empty-scenarios">No saved scenarios yet.</div>';

      // Remove existing modal if any
      const existing = document.getElementById('manage-scenarios-modal-dyn');
      if (existing) existing.remove();

      // Create dynamic modal like version history
      const modal = document.createElement('div');
      modal.id = 'manage-scenarios-modal-dyn';
      modal.className = 'modal-overlay';
      modal.style.cssText = 'display:flex; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:100000; align-items:center; justify-content:center;';
      modal.innerHTML = `
        <div class="modal-content" style="background:white; padding:24px; border-radius:8px; max-width:700px; max-height:80vh; overflow-y:auto; width:90%;">
          <h3 style="margin-top:0;">Manage Scenarios</h3>
          <div style="margin-bottom:12px; display:flex; justify-content:flex-end;">
            <button onclick="createNewScenarioFromModal()" style="padding:6px 10px; background:#0070f3; color:#fff; border:none; border-radius:4px; cursor:pointer;">+ New Scenario</button>
          </div>
          <div class="scenario-list">
            ${listHtml}
          </div>
          <div style="margin-top:20px; text-align:right;">
            <button onclick="document.getElementById('manage-scenarios-modal-dyn').remove()" style="padding:8px 16px; background:#666; color:white; border:none; border-radius:4px; cursor:pointer;">Close</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Close on outside click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });

      // New Scenario helper
      window.createNewScenarioFromModal = async function() {
        try {
          const scenarioName = prompt('Enter name for new scenario:');
          if (!scenarioName || !scenarioName.trim()) return;
          const emptyData = {
            trip: {
              title: 'New Trip',
              start_date: new Date().toISOString().split('T')[0],
              duration: '0 days',
              total_cost: '$0'
            },
            locations: [],
            legs: []
          };
          const scenarioData = {
            name: scenarioName.trim(),
            description: 'New empty scenario',
            data: emptyData
          };
          const newScenarioId = await scenarioManager.saveScenario(scenarioData);
          // Load the new scenario
          workingData = JSON.parse(JSON.stringify(emptyData));
          currentScenarioId = newScenarioId;
          window.currentScenarioId = currentScenarioId;
          currentScenarioName = scenarioName.trim();
          updateScenarioNameDisplay();
          render(legFilter.value, routingToggle.checked, false);
          await window.showManageScenarios();
        } catch (err) {
          console.error('Error creating scenario:', err);
          alert('Failed to create scenario');
        }
      };
    } catch (error) {
      console.error('Error opening Manage Scenarios:', error);
      alert('Failed to open Manage Scenarios');
    }
  };

  // Scenario controls
  document.getElementById('manage-scenarios-btn').addEventListener('click', async (e) => {
    try {
      const dropdown = document.getElementById('scenario-actions-dropdown');
      if (dropdown) dropdown.style.display = 'none';
    } catch {}
    await window.showManageScenarios();
  });
  const versionHistoryBtn = document.getElementById('version-history-btn');
  if (versionHistoryBtn) {
    versionHistoryBtn.addEventListener('click', async () => {
      try {
        const dropdown = document.getElementById('scenario-actions-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        if (!currentScenarioId) {
          alert('Please select or save a scenario first.');
          return;
        }
        await window.showVersionHistory(currentScenarioId);
      } catch (err) {
        console.error('Error opening version history:', err);
      }
    });
  }

  // Save Named Version action
  const saveNamedVersionBtn = document.getElementById('save-named-version-btn');
  if (saveNamedVersionBtn) {
    saveNamedVersionBtn.addEventListener('click', async () => {
      try {
        const dropdown = document.getElementById('scenario-actions-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        if (!currentScenarioId) {
          alert('Please select or save a scenario first.');
          return;
        }
        const name = prompt('Enter a label for this version:');
        if (!name || !name.trim()) return;
        const res = await scenarioManager.saveVersion(currentScenarioId, workingData, true, name.trim());
        console.log(`📌 Saved named version v${res.versionNumber || 'n/a'}: ${name.trim()}`);
        alert(`Saved version: ${name.trim()}`);
      } catch (err) {
        console.error('Error saving named version:', err);
        alert('Failed to save named version');
      }
    });
  }

  // Add destination from menu
  document.getElementById('add-destination-menu-btn').addEventListener('click', () => {
    const scenarioActionsDropdown = document.getElementById('scenario-actions-dropdown');
    const scenarioActionsBtn = document.getElementById('scenario-actions-btn');
    scenarioActionsDropdown.style.display = 'none';
    scenarioActionsBtn.classList.remove('active');

    openAddDestinationModal(null); // null means auto-calculate insertion point
  });

  // Add destination from bar button
  document.getElementById('add-destination-bar-btn').addEventListener('click', () => {
    openAddDestinationModal(null); // null means auto-calculate insertion point
  });

  // Cost tracking buttons
  document.getElementById('add-cost-btn').addEventListener('click', () => {
    const scenarioActionsDropdown = document.getElementById('scenario-actions-dropdown');
    const scenarioActionsBtn = document.getElementById('scenario-actions-btn');
    scenarioActionsDropdown.style.display = 'none';
    scenarioActionsBtn.classList.remove('active');

    costUI.setSessionId(currentScenarioId || 'default');
    costUI.setDestinations(workingData.locations || []);
    costUI.showAddCostModal();
  });

  document.getElementById('view-costs-btn').addEventListener('click', async () => {
    const scenarioActionsDropdown = document.getElementById('scenario-actions-dropdown');
    const scenarioActionsBtn = document.getElementById('scenario-actions-btn');
    scenarioActionsDropdown.style.display = 'none';
    scenarioActionsBtn.classList.remove('active');

    costUI.setSessionId(currentScenarioId || 'default');
    costUI.setDestinations(workingData.locations || []);
    await costUI.showCostDetails();
  });

  document.getElementById('data-integrity-btn').addEventListener('click', () => {
    const scenarioActionsDropdown = document.getElementById('scenario-actions-dropdown');
    const scenarioActionsBtn = document.getElementById('scenario-actions-btn');
    if (scenarioActionsDropdown) scenarioActionsDropdown.style.display = 'none';
    if (scenarioActionsBtn) scenarioActionsBtn.classList.remove('active');

    showDataIntegrityPanel(workingData, handleDataUpdate);
  });

  document.getElementById('compare-costs-btn').addEventListener('click', async () => {
    const scenarioActionsDropdown = document.getElementById('scenario-actions-dropdown');
    const scenarioActionsBtn = document.getElementById('scenario-actions-btn');
    scenarioActionsDropdown.style.display = 'none';
    scenarioActionsBtn.classList.remove('active');

    try {
      const scenarios = await scenarioManager.listScenarios();
      if (scenarios.length < 2) {
        alert('You need at least 2 scenarios to compare costs. Create more scenarios first.');
        return;
      }

      // Load scenario data with itineraries
      const scenariosWithData = await Promise.all(
        scenarios.map(async (scenario) => {
          const latestVersion = await scenarioManager.getLatestVersion(scenario.id);
          return {
            id: scenario.id,
            name: scenario.name,
            itinerary: latestVersion?.itineraryData || null
          };
        })
      );

      await costComparison.showComparisonModal(scenariosWithData.filter(s => s.itinerary));
    } catch (error) {
      console.error('Error loading scenarios for comparison:', error);
      alert('Failed to load scenarios for comparison.');
    }
  });

  // Update itinerary data and cost summary when costs change
  window.addEventListener('costs-updated', async () => {
    console.log('🔄 costs-updated event received, refreshing costs...');
    try {
      // Always use scenario ID (costs are stored per scenario, not per chat session)
      if (currentScenarioId) {
        console.log(`📡 Fetching costs for scenario: ${currentScenarioId}`);
        const freshCosts = await costUI.fetchCosts({ session_id: currentScenarioId });
        console.log(`📦 Received ${freshCosts?.length || 0} costs from backend`);

        if (freshCosts && Array.isArray(freshCosts)) {
          workingData.costs = freshCosts;
          console.log(`✅ Updated workingData.costs with ${freshCosts.length} costs`);
          console.log(`💰 Cost IDs:`, freshCosts.map(c => `${c.id}: ${c.amount_usd} for ${c.destination_id}`));

          // Re-render only the sidebar with fresh data
          const filtered = (subLegFilter.value && subLegFilter.value !== '')
            ? filterBySubLeg(workingData, legFilter.value, subLegFilter.value)
            : filterByLeg(workingData, legFilter.value);
          updateSidebar(filtered);

          await updateCostSummary();
        } else {
          console.warn('⚠️ No costs returned or invalid format');
        }
      } else {
        console.warn('⚠️ No currentScenarioId, skipping cost refresh');
      }
    } catch (error) {
      console.error('❌ Error refreshing costs after update:', error);
    }
  });

  async function updateCostSummary() {
    const summarySection = document.getElementById('cost-summary-section');
    if (!summarySection) return;

    try {
      costUI.setSessionId(currentScenarioId || 'default');
      const summary = await costUI.fetchSummary({
        destinations: workingData.locations || [],
        traveler_count: workingData.trip?.travelers?.length || 1,
        total_days: calculateTotalDays()
      });

      if (summary && summary.totalUSD > 0) {
        summarySection.innerHTML = '';
        summarySection.appendChild(costUI.createSummaryWidget(summary));
        summarySection.style.display = 'block';
      } else {
        summarySection.style.display = 'none';
      }
    } catch (error) {
      console.error('Error updating cost summary:', error);
    }
  }

  function calculateTotalDays() {
    // Calculate total days from sum of location durations, not date ranges
    // This ensures consistency with how durations are displayed elsewhere
    const locations = workingData.locations || [];
    return locations.reduce((sum, loc) => sum + (loc.duration_days || 1), 0);
  }

  // Initial cost summary update
  updateCostSummary();

  // Duplicate scenario now lives in Manage Scenarios modal (dynamic handler below)

  document.getElementById('import-scenarios-btn').addEventListener('click', openImportScenariosModal);

  // Summary generation button
  document.getElementById('generate-summary-btn').addEventListener('click', async () => {
    try {
      // Build itinerary data from current state
      const itineraryData = {
        trip: workingData.trip || {},
        locations: workingData.locations || [],
        legs: workingData.legs || [],
        costs: workingData.costs || []
      };

      if (!itineraryData.locations || itineraryData.locations.length === 0) {
        alert('No locations in itinerary to generate summary');
        return;
      }

      // Generate and view summary
      await summaryManager.generateAndView(itineraryData, currentScenarioId);

      // Update view summary button state after generation
      await updateViewSummaryButtonState();
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Failed to generate summary: ' + error.message);
    }
  });

  // View saved summary button (in scenario actions dropdown)
  document.getElementById('view-summary-btn').addEventListener('click', async () => {
    if (!currentScenarioId) {
      alert('Please save your scenario first before viewing summary');
      return;
    }

    try {
      // Check if scenario has a saved summary
      const hasSummary = await scenarioManager.hasSummary(currentScenarioId);

      if (hasSummary) {
        // View the saved summary
        const summary = await scenarioManager.getSummary(currentScenarioId);

        // Store summary data for viewer
        sessionStorage.setItem('summaryItineraryData', JSON.stringify({
          trip: workingData.trip || {},
          locations: workingData.locations || [],
          legs: workingData.legs || [],
          costs: workingData.costs || []
        }));
        sessionStorage.setItem('summaryScenarioId', currentScenarioId);

        // Open with saved summary
        const params = new URLSearchParams({
          scenario: currentScenarioId,
          id: 'saved'
        });
        window.open(`summary-viewer.html?${params.toString()}`, '_blank');
      } else {
        // No saved summary, offer to generate
        const generate = confirm('This scenario does not have a saved summary yet. Generate one now?');
        if (generate) {
          document.getElementById('generate-summary-btn').click();
        }
      }
    } catch (error) {
      console.error('Error viewing summary:', error);
      alert('Failed to view summary: ' + error.message);
    }
  });

  // Removed standalone scenario-selector; use Manage Scenarios for switching/creating
  
  // Initialize Places API
  initializePlacesAPI();
  
  // Modal event handlers
  document.getElementById('cancel-add-btn').addEventListener('click', closeAddDestinationModal);
  document.getElementById('cancel-save-scenario-btn').addEventListener('click', closeSaveScenarioModal);
  document.getElementById('close-manage-scenarios-btn').addEventListener('click', closeManageScenariosModal);
  document.getElementById('cancel-import-btn').addEventListener('click', closeImportScenariosModal);
  
  // Form submissions
  document.getElementById('add-destination-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedPlaceData = document.getElementById('selected-place').value;
    const duration = parseInt(document.getElementById('duration-input').value) || 3;

    if (!selectedPlaceData) {
      alert('Please select a location from the suggestions.');
      return;
    }

    try {
      const placeData = JSON.parse(selectedPlaceData);

      // If no insert index specified, calculate based on geography
      let insertIndex = pendingInsertIndex;
      if (insertIndex === null) {
        insertIndex = findBestInsertionIndex(placeData.location);
        console.log('Auto-calculated insertion index:', insertIndex);
      }

      addNewDestination(insertIndex, placeData, duration);
    } catch (error) {
      console.error('Error parsing place data:', error);
      alert('Error adding destination. Please try again.');
    }
  });
  
  document.getElementById('save-scenario-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('scenario-name').value.trim();
    const description = document.getElementById('scenario-description').value.trim();

    if (!name) {
      alert('Please enter a scenario name.');
      return;
    }

    try {
      let scenario;

      if (currentScenarioId) {
        // Update existing scenario - save as new named version
        scenario = await scenarioManager.getScenario(currentScenarioId);
        if (scenario) {
          // Save as named version
          await scenarioManager.saveVersion(
            currentScenarioId,
            workingData,
            true,
            `Named: ${name}`
          );
        }
      } else {
        // Create new scenario
        scenario = await scenarioManager.getOrCreateScenario(name, description);
        currentScenarioId = scenario.id;
        currentScenarioName = name;

        // Save initial version
        await scenarioManager.saveVersion(currentScenarioId, workingData, true, 'Initial version');
      }

      closeSaveScenarioModal();
      updateScenarioNameDisplay();

      alert(`Scenario "${name}" has been saved successfully.`);
    } catch (error) {
      console.error('Error saving scenario:', error);
      alert('Failed to save scenario. Please try again.');
    }
  });
  
      document.getElementById('confirm-import-btn').addEventListener('click', () => {
        const fileInput = document.getElementById('scenario-file');
        const overwrite = document.getElementById('overwrite-scenarios').checked;
    
    if (!fileInput.files.length) {
      alert('Please select a file to import.');
      return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const success = scenarioManager.importScenarios(e.target.result, overwrite);
        if (success) {
          closeImportScenariosModal();
          updateScenarioNameDisplay();
          alert('Scenarios imported successfully!');
        } else {
          alert('Failed to import scenarios. Please check the file format.');
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Error importing scenarios. Please check the file format.');
      }
    };
    
    reader.readAsText(file);
  });
  
  // Close modals when clicking outside
  document.getElementById('add-destination-modal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeAddDestinationModal();
    }
  });
  
  document.getElementById('save-scenario-modal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeSaveScenarioModal();
    }
  });
  
  document.getElementById('manage-scenarios-modal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeManageScenariosModal();
    }
  });
  
  document.getElementById('import-scenarios-modal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeImportScenariosModal();
    }
  });

  // Handler for when the agent modifies the itinerary
  function ensureLocationDefaults(destination) {
    const clone = JSON.parse(JSON.stringify(destination || {}));
    if (!clone.id) {
      clone.id = generateNewLocationId();
    }

    if (!clone.coordinates || typeof clone.coordinates.lat !== 'number' || typeof clone.coordinates.lng !== 'number') {
      clone.coordinates = {
        lat: Number(clone.coordinates?.lat) || 0,
        lng: Number(clone.coordinates?.lng) || 0,
      };
    }

    if (!Array.isArray(clone.highlights)) {
      clone.highlights = [];
    }

    if (clone.notes == null) {
      clone.notes = '';
    }

    if (!clone.region) {
      const match = (workingData.locations || []).find(loc => loc.country && loc.country === clone.country && loc.region);
      clone.region = match?.region || 'Custom';
    }

    if (!clone.activity_type) {
      clone.activity_type = 'custom exploration';
    }

    return clone;
  }

  function handleItineraryChanges(changes) {
    // ⚠️ CRITICAL NOTE: This function is called as a workaround for non-deterministic AI behavior.
    // Even when the AI chat claims it cannot access the itinerary, the backend may still
    // process and apply changes that are detected via polling. This function ensures those
    // changes are applied to the UI regardless of the AI's response message.
    console.log('🚨 !!! ITINERARY CHANGES DETECTED !!!');
    console.log('🚨 !!! This might be causing the app reset !!!');
    console.log('🔧 handleItineraryChanges called with:', changes);
    console.log('📍 Current workingData.locations count:', workingData.locations?.length || 0);
    console.trace('🚨 Stack trace for handleItineraryChanges call:');

    changes.forEach(change => {
      console.log(`🎯 Processing change type: ${change.type}`, change);
      switch (change.type) {
        case 'add':
          addDestinationToItinerary(change.destination, change.insert_after);
          break;
        case 'remove':
          removeDestinationFromItinerary(change.destination_name);
          break;
        case 'update_duration':
          updateDestinationDuration(change.destination_name, change.new_duration_days);
          break;
        case 'update':
          updateDestinationDetails(change.destination_name, change.updates);
          break;
        default:
          console.warn('⚠️ Unknown change type:', change.type);
          break;
      }
    });

    console.log('📍 After changes, workingData.locations count:', workingData.locations?.length || 0);
    console.log('🔄 Recalculating dates and re-rendering...');
    recalculateDates(workingData.locations);
    render(legFilter.value, subLegFilter.value, routingToggle.checked);
    updateChatContext(legFilter.value, subLegFilter.value);
    console.log('✅ Re-render complete');
  }

  function addDestinationToItinerary(destination, insertAfter) {
    const locations = workingData.locations || [];
    console.log('➕ addDestinationToItinerary - Before:', {
      destinationRaw: destination,
      insertAfter,
      currentCount: locations.length
    });

    const hydratedDestination = ensureLocationDefaults(destination);
    console.log('💧 Hydrated destination:', hydratedDestination);

    // Find insert position
    let insertIndex = locations.length;
    if (insertAfter) {
      const afterIndex = locations.findIndex(loc =>
        loc.name === insertAfter || loc.city === insertAfter
      );
      if (afterIndex !== -1) {
        insertIndex = afterIndex + 1;
      }
      console.log(`🔍 Insert after "${insertAfter}" -> index ${insertIndex}`);
    }

    locations.splice(insertIndex, 0, hydratedDestination);
    console.log(`✅ Added ${hydratedDestination.name} at position ${insertIndex}, new count: ${locations.length}`);
  }

  function removeDestinationFromItinerary(destinationName) {
    const locations = workingData.locations || [];
    const index = locations.findIndex(loc =>
      loc.name === destinationName || loc.city === destinationName
    );

    if (index !== -1) {
      locations.splice(index, 1);
      console.log(`Removed ${destinationName}`);
    }
  }

  function updateDestinationDuration(destinationName, newDuration) {
    const locations = workingData.locations || [];
    const location = locations.find(loc =>
      loc.name === destinationName || loc.city === destinationName
    );

    if (location) {
      location.duration_days = newDuration;
      console.log(`Updated ${destinationName} duration to ${newDuration} days`);
    }
  }

  function updateDestinationDetails(destinationName, updates) {
    const locations = workingData.locations || [];
    const location = locations.find(loc =>
      loc.name === destinationName || loc.city === destinationName
    );

    if (location) {
      Object.assign(location, updates);
      console.log(`Updated ${destinationName}:`, updates);
    }
  }

  // Initialize AI Travel Concierge Chat
  let chatInstance = null;
  if (window.TravelConciergeChat) {
    chatInstance = new window.TravelConciergeChat(handleItineraryChanges);
  }

  // Function to update chat context
  function updateChatContext(legName, subLegName = null) {
    if (!chatInstance) {
      console.log('⚠️ updateChatContext called but chatInstance is null');
      return;
    }

    console.log('🔧 updateChatContext called with:', { legName, subLegName });
    console.log('🔧 workingData has locations:', workingData.locations?.length || 0);
    console.log('🔧 workingData has legs:', workingData.legs?.length || 0);

    const legData = workingData.legs?.find(l => l.name === legName);
    console.log('🔧 legData found:', !!legData, legData?.name || 'null');

    const filtered = (subLegName && subLegName !== '')
      ? filterBySubLeg(workingData, legName, subLegName)
      : filterByLeg(workingData, legName);

    console.log('🔧 filtered destinations count:', filtered.length);
    console.log('🔧 filtered destinations sample:', filtered.slice(0, 2));

    const subLegData = subLegName ? legData?.sub_legs?.find(sl => sl.name === subLegName) : null;

    console.log(`🔧 Updating chat context for leg: ${legName}${subLegName ? ` / ${subLegName}` : ''}, destinations: ${filtered.length}`);

    // Pass full location objects instead of just names
    chatInstance.updateContext(
      legName,
      filtered, // Pass the full location objects
      subLegData?.start_date || legData?.start_date,
      subLegData?.end_date || legData?.end_date,
      subLegName // Pass sub-leg name
    );
  }

  // Update chat context when leg filter changes - now handled in leg filter change event above
  // Update chat context when sub-leg filter changes
  subLegFilter.addEventListener('change', function() {
    updateChatContext(legFilter.value, subLegFilter.value || null);
  });

  // Restore leg/sub-leg selections from saved state
  const initialLeg = savedState.selectedLeg || 'all';
  const initialSubLeg = savedState.selectedSubLeg || null;

  // Set the filter values
  legFilter.value = initialLeg;
  if (initialLeg !== 'all') {
    populateSubLegs(initialLeg);
    if (initialSubLeg) {
      subLegFilter.value = initialSubLeg;
    }
  }

  // Initial render with restored state
  render(initialLeg, initialSubLeg, routingToggle.checked);
  if (chatInstance) {
    // Give it a moment for render to complete
    setTimeout(() => updateChatContext(initialLeg, initialSubLeg), 100);
  }

  // Initialize view summary button state
  updateViewSummaryButtonState();

  console.log('✅ App initialized with state:', {
    scenarioId: currentScenarioId,
    scenarioName: currentScenarioName,
    leg: initialLeg,
    subLeg: initialSubLeg
  });
}

window.addEventListener('load', () => {
  const wait = () => {
    if (!window.google || !window.google.maps) return setTimeout(wait, 50);
    initMapApp().catch(err => {
      console.error(err);
      alert('Failed to initialize map: ' + err.message);
    });
  };
  wait();
});
