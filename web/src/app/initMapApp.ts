// @ts-nocheck
import { FirestoreScenarioManager } from '../firestore/scenarioManager';
import { StatePersistence } from '../statePersistence';
import { summaryManager } from '../summaryManager';
import { showDataIntegrityPanel, validateDataIntegrity } from '../dataIntegrityUi';
import { showGeographicValidationPanel, showValidationWarningBanner, hasGeographicDataIssues } from '../dataValidationUi';
import { generateDestinationId, normalizeId } from '../destinationIdManager';
import { getRegionForCountry } from '../data/regionMappings';
import {
  showDestinationDeletionDialog,
  handleDestinationDeletion,
  populateReassignDropdown
} from '../destinationDeletionHandler';
import { getRuntimeConfig } from '../config';
import { getLegsForData, generateDynamicLegs, getLegSummary } from '../utils/dynamicLegManager';
import { aggregateByCountry, groupByContinent, groupByRegion, calculateCountryStats, CountryStay, RegionStay } from '../utils/countryAggregator';
import { loadEducationSection, initializeEducationUI } from '../education/educationUI';

const { apiBaseUrl } = getRuntimeConfig();

const idsEqual = (a, b) => {
  if (a == null || b == null) return a == null && b == null;
  return normalizeId(a) === normalizeId(b);
};

async function loadData() {
  // Return empty data structure - the app loads all data from Firestore in initMapApp
  console.log('📊 Using empty initial data - will load from Firestore');
  return {
    locations: [],
    legs: [],
    costs: []
  };
}

function toLatLng(location) {
  // Prefer display_coordinates if present (for special cases like Antarctica)
  // This allows destinations to have logical coordinates (e.g., Ushuaia for departure port)
  // while displaying at the correct location on the map (e.g., Antarctic Peninsula)
  const coords = location.display_coordinates || location.coordinates;

  if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    return { lat: coords.lat, lng: coords.lng };
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
  // Use dynamic leg generation from destinations
  const legs = getLegsForData(data, { useDynamic: true });
  return legs.map(leg => leg.name);
}

function getSubLegsForLeg(data, legName) {
  // Get dynamic legs
  const legs = getLegsForData(data, { useDynamic: true });
  const leg = legs.find(l => l.name === legName);
  return leg?.sub_legs || [];
}

function filterByLeg(data, legName) {
  if (!legName || legName === 'all') return data.locations || [];

  // Get dynamic legs
  const legs = getLegsForData(data, { useDynamic: true });
  const leg = legs.find(l => l.name === legName);

  if (!leg) {
    console.warn(`⚠️ Leg "${legName}" not found in dynamic legs`);
    return data.locations || [];
  }

  // Filter by regions (continent-based)
  const legRegions = leg.regions || [];
  if (legRegions.length === 0) {
    console.warn(`⚠️ Leg "${legName}" has no regions defined`);
    return data.locations || [];
  }

  return (data.locations || []).filter(location => {
    // VALIDATION: Warn about missing region field
    if (!location.region) {
      console.warn(`⚠️ Location "${location.name}" (ID: ${location.id}) is missing region field - will not appear in leg view`);
      return false;
    }

    return legRegions.includes(location.region);
  });
}

function filterBySubLeg(data, legName, subLegName) {
  console.log(`🔍 filterBySubLeg called: leg="${legName}", subLeg="${subLegName}"`);

  if (!subLegName) return filterByLeg(data, legName);

  // Get dynamic legs
  const legs = getLegsForData(data, { useDynamic: true });
  const leg = legs.find(l => l.name === legName);

  if (!leg) {
    console.warn(`⚠️ Leg "${legName}" not found in dynamic legs`);
    return [];
  }

  const subLeg = leg.sub_legs?.find(sl => sl.name === subLegName);
  if (!subLeg) {
    console.warn(`⚠️ Sub-leg "${subLegName}" not found in leg "${legName}"`);
    return [];
  }

  // Filter locations by country (geographic relationship)
  const subLegCountries = subLeg.countries || [];
  console.log(`📋 Sub-leg "${subLegName}" has ${subLegCountries.length} countries:`, subLegCountries);

  // SPECIAL CASE: If sub-leg has no countries defined OR has an empty array,
  // treat it as "All Destinations" for this leg - filter by region only
  if (subLegCountries.length === 0) {
    console.log(`ℹ️ Sub-leg "${subLegName}" has no countries defined - showing all destinations for leg "${legName}"`);
    return filterByLeg(data, legName);
  }

  // Enhanced filtering with validation
  const filtered = (data.locations || []).filter(location => {
    // VALIDATION: Warn about missing country field
    if (!location.country) {
      console.warn(`⚠️ Location "${location.name}" (ID: ${location.id}) is missing country field - will not appear in sub-leg view`);
      return false;
    }

    // Filter by country match
    const matches = subLegCountries.includes(location.country);

    // DEBUG: Log why a location is filtered out
    if (!matches && location.region && leg.regions?.includes(location.region)) {
      console.warn(`❌ Location "${location.name}" has region "${location.region}" but country "${location.country}" NOT in sub-leg countries:`, subLegCountries);
    }

    return matches;
  });

  console.log(`✅ Filtered to ${filtered.length} locations for sub-leg "${subLegName}"`);
  return filtered;
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

    // Determine if destination is locked
    const isLocked = loc.is_date_locked || false;

    const marker = new google.maps.Marker({
      position: ll,
      map,
      label: {
        text: String(idx + 1),
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold'
      },
      title: `${loc.name}${loc.city ? ', ' + loc.city : ''}${loc.country ? ', ' + loc.country : ''}${isLocked ? ' 🔒 (Dates Locked)' : ''}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: getActivityColor(loc.activity_type),
        fillOpacity: 1,
        strokeColor: isLocked ? '#ffc107' : '#ffffff',
        strokeWeight: isLocked ? 4 : 2
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

        // Get transport segment if available, otherwise calculate
        let segment = null;
        let transportMode, cost, costText, transportIcon;

        if (window.transportSegmentManager) {
          segment = window.transportSegmentManager.getSegment(fromLocation.id, toLocation.id);
        }

        if (segment) {
          // Use data from transport segment
          transportMode = segment.transport_mode;
          transportIcon = segment.transport_mode_icon;
          cost = window.transportSegmentManager.getActiveCost(segment);
          costText = cost > 0 ? `$${cost.toLocaleString()}` : 'Free';
        } else {
          // Fall back to old calculation
          transportMode = getTransportationMode(fromLocation, toLocation, i);
          transportIcon = getTransportationIcon(transportMode);
          cost = getTransportationCost(fromLocation, toLocation, transportMode, distance);
          costText = cost > 0 ? `$${cost.toLocaleString()}` : 'Free';
        }

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
                <text x="16" y="14" text-anchor="middle" font-size="12">${transportIcon}</text>
                <text x="16" y="26" text-anchor="middle" font-size="8" fill="#1e88e5" font-weight="bold">${costText}</text>
              </svg>
            `)}`,
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
          },
          title: `${fromLocation.name} → ${toLocation.name}\nTravel by ${transportMode}\nCost: ${costText}\nDistance: ${Math.round(distance/1000)}km`,
          zIndex: 1000
        });

        // Add click handler to show detailed cost breakdown
        transportMarker.addListener('click', () => {
          let statusBadge = '';
          let confidenceInfo = '';

          if (segment) {
            // Show segment-specific information
            const statusColors = {
              'estimated': '#999',
              'researched': '#3498db',
              'booked': '#27ae60',
              'paid': '#27ae60',
              'completed': '#27ae60'
            };
            const statusColor = statusColors[segment.booking_status] || '#999';
            statusBadge = `<span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; text-transform: uppercase;">${segment.booking_status}</span>`;

            if (segment.confidence_level) {
              const confidenceEmoji = segment.confidence_level === 'high' ? '✓✓' : segment.confidence_level === 'medium' ? '✓' : '~';
              confidenceInfo = `<p style="margin: 4px 0; font-size: 12px; color: #888;">${confidenceEmoji} Confidence: ${segment.confidence_level}</p>`;
            }
          } else {
            statusBadge = '<span style="background: #999; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; text-transform: uppercase;">estimated</span>';
          }

          const infoContent = `
            <div style="max-width: 280px; padding: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">
                ${transportIcon} ${fromLocation.name} → ${toLocation.name}
              </h4>
              <div style="display: grid; gap: 8px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #34495e;">Transport:</strong> ${transportMode.charAt(0).toUpperCase() + transportMode.slice(1)} ${statusBadge}
                </p>
                <p style="margin: 0; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #34495e;">Distance:</strong> ${Math.round(distance/1000)}km
                </p>
                ${segment && segment.duration_hours ? `
                  <p style="margin: 0; font-size: 13px; line-height: 1.5;">
                    <strong style="color: #34495e;">Duration:</strong> ~${Math.round(segment.duration_hours)}h
                  </p>` : ''}
                <p style="margin: 0; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #34495e;">Total Cost:</strong> ${costText} <span style="color: #7f8c8d; font-size: 12px;">(${segment ? segment.num_travelers : 3} people)</span>
                </p>
                <p style="margin: 0; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #34495e;">Per Person:</strong> <span style="color: #27ae60; font-weight: 600;">$${Math.round(cost/(segment ? segment.num_travelers : 3)).toLocaleString()}</span>
                </p>
                ${confidenceInfo ? `<p style="margin: 0; font-size: 12px; color: #7f8c8d; line-height: 1.5;">${confidenceInfo}</p>` : ''}
                ${segment && segment.notes ? `
                  <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 12px; font-style: italic; color: #555; line-height: 1.4;">
                      💡 ${segment.notes}
                    </p>
                  </div>` : ''}
                ${segment && segment.booking_reference ? `
                  <p style="margin: 0; font-size: 12px; color: #3498db; font-weight: 500;">
                    <strong>Ref:</strong> ${segment.booking_reference}
                  </p>` : ''}
              </div>
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

    // Check if destination is locked
    const isLocked = location.is_date_locked || false;
    const lockBadge = isLocked ? `<div style="display: inline-block; background: #ffc107; color: #333; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-bottom: 8px;">🔒 DATES LOCKED</div>` : '';

    const content = `
      <div style="min-width: 260px; padding: 12px 14px;">
        <div style="font-weight: 700; font-size: 16px; margin-bottom: 6px;">${name}</div>
        ${lockBadge}
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

export async function initMapApp() {
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

  function ensureLocationCostBaseline(location) {
    if (!location || typeof location !== 'object') return;

    const hasBaseline = Object.prototype.hasOwnProperty.call(location, '__costDurationBaseline');
    if (hasBaseline) return;

    const rawDuration =
      Number(location.duration_days ?? location.durationDays ?? location.duration);
    const baseline = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 1;

    Object.defineProperty(location, '__costDurationBaseline', {
      value: baseline,
      writable: true,
      configurable: true,
      enumerable: false
    });
  }

  function ensureAllLocationBaselines(data) {
    if (!data || !Array.isArray(data.locations)) return;
    data.locations.forEach(ensureLocationCostBaseline);
  }

  // Helper to update workingData and keep global reference synced
  function updateWorkingData(newData) {
    workingData = newData;
    ensureAllLocationBaselines(workingData);
    window.appWorkingData = workingData;
  }

  ensureAllLocationBaselines(workingData);

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
          const loadedData = mergeSubLegsFromTemplate(latestVersion.itineraryData);
          updateWorkingData(loadedData);
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
          const loadedData = mergeSubLegsFromTemplate(latestVersion.itineraryData);
          updateWorkingData(loadedData);
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

    // Initialize transport segments with timeout to prevent hanging
    if (currentScenarioId && window.transportSegmentManager) {
      console.log('🚗 Initializing transport segments...');
      try {
        // Add 10-second timeout to prevent hanging on network issues
        const loadPromise = window.transportSegmentManager.loadSegments(currentScenarioId);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transport segment loading timed out after 10s')), 10000)
        );

        await Promise.race([loadPromise, timeoutPromise]);
        console.log(`✅ Loaded ${window.transportSegmentManager.getAllSegments().length} transport segments`);

        // Sync segments with current destinations
        if (workingData.locations && workingData.locations.length > 1) {
          const syncPromise = window.transportSegmentManager.syncSegments(currentScenarioId, workingData.locations);
          const syncTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Transport segment sync timed out after 10s')), 10000)
          );

          await Promise.race([syncPromise, syncTimeoutPromise]);
          console.log('✅ Synced transport segments with destinations');
        }
      } catch (error) {
        console.error('Error initializing transport segments:', error);
        console.log('⚠️ Continuing without transport segments...');
      }
    }
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

  function refreshGeographicValidationBadge() {
    const badge = document.getElementById('geo-validation-badge');
    if (!badge) return;

    if (hasGeographicDataIssues(workingData)) {
      badge.textContent = '⚠️';
      badge.title = 'Geographic data issues detected';
      badge.style.color = '#ff9800';
    } else {
      badge.textContent = '✓';
      badge.title = 'All destinations have valid geographic data';
      badge.style.color = '#4caf50';
    }
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

  function detectDateConflicts(locations) {
    const conflicts = [];

    // Check for overlapping or gap issues between consecutive destinations
    for (let i = 0; i < locations.length - 1; i++) {
      const current = locations[i];
      const next = locations[i + 1];

      if (current.departure_date && next.arrival_date) {
        const currentDep = new Date(current.departure_date + 'T00:00:00Z');
        const nextArr = new Date(next.arrival_date + 'T00:00:00Z');
        const daysDiff = Math.round((nextArr - currentDep) / (24 * 60 * 60 * 1000));

        if (daysDiff < 1) {
          conflicts.push({
            type: 'overlap',
            fromLocation: current.name,
            toLocation: next.name,
            days: Math.abs(daysDiff - 1),
            message: `${current.name} → ${next.name}: ${Math.abs(daysDiff - 1)} day(s) overlap`
          });
        } else if (daysDiff > 1) {
          conflicts.push({
            type: 'gap',
            fromLocation: current.name,
            toLocation: next.name,
            days: daysDiff - 1,
            message: `${current.name} → ${next.name}: ${daysDiff - 1} day(s) gap`
          });
        }
      }
    }

    // Check if total duration exceeds available time between locked boundaries
    const firstLocked = locations.find(loc => loc.is_date_locked);
    const lastLocked = [...locations].reverse().find(loc => loc.is_date_locked);

    if (firstLocked && lastLocked && firstLocked !== lastLocked) {
      const startDate = new Date(firstLocked.arrival_date + 'T00:00:00Z');
      const endDate = new Date(lastLocked.departure_date + 'T00:00:00Z');
      const availableDays = Math.round((endDate - startDate) / (24 * 60 * 60 * 1000)) + 1;

      const firstIdx = locations.indexOf(firstLocked);
      const lastIdx = locations.indexOf(lastLocked);
      const totalDuration = locations.slice(firstIdx, lastIdx + 1)
        .reduce((sum, loc) => sum + (loc.duration_days || 1), 0);

      if (totalDuration > availableDays) {
        conflicts.push({
          type: 'duration_exceeded',
          days: totalDuration - availableDays,
          message: `Total itinerary exceeds available time by ${totalDuration - availableDays} day(s)`
        });
      }
    }

    return conflicts;
  }

  function recalculateDates(locations, startDate) {
    if (!locations || locations.length === 0) return { conflicts: [] };

    if (!startDate) startDate = workingData.trip?.start_date || '2026-06-12';

    // Identify locked destinations and trip boundaries
    const isStartLocked = workingData.trip?.start_date_locked || false;
    const isEndLocked = workingData.trip?.end_date_locked || false;

    // Find all locked destinations (those with is_date_locked = true)
    const lockedIndices = locations
      .map((loc, idx) => (loc.is_date_locked ? idx : -1))
      .filter(idx => idx !== -1);

    // If no locked destinations, use simple forward calculation
    if (lockedIndices.length === 0 && !isStartLocked) {
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
      return { conflicts: detectDateConflicts(locations) };
    }

    // Process segments between locked points
    // Segment boundaries: start of trip, locked destinations, end of trip
    const boundaries = [
      { index: -1, date: startDate, locked: isStartLocked }
    ];

    lockedIndices.forEach(idx => {
      const loc = locations[idx];
      boundaries.push({
        index: idx,
        arrivalDate: loc.locked_arrival_date || loc.arrival_date,
        departureDate: loc.locked_departure_date || loc.departure_date,
        locked: true
      });
    });

    // Process each segment between boundaries
    for (let i = 0; i < boundaries.length; i++) {
      const segmentStart = boundaries[i];
      const segmentEnd = boundaries[i + 1];

      // Determine the range of unlocked destinations in this segment
      const startIdx = segmentStart.index + 1;
      const endIdx = segmentEnd ? segmentEnd.index : locations.length;

      if (startIdx >= endIdx) continue; // No unlocked destinations in this segment

      // Calculate dates for unlocked destinations
      let currentDate;

      if (segmentStart.index === -1) {
        // Start of trip
        currentDate = new Date(segmentStart.date + 'T00:00:00Z');
      } else {
        // After a locked destination
        const prevLoc = locations[segmentStart.index];
        const prevDeparture = prevLoc.locked_departure_date || prevLoc.departure_date;
        currentDate = addDays(new Date(prevDeparture + 'T00:00:00Z'), 1);
      }

      // Forward-calculate dates for unlocked destinations in this segment
      for (let j = startIdx; j < endIdx; j++) {
        const loc = locations[j];

        if (loc.is_date_locked) {
          // This is a locked destination - use its locked dates
          loc.arrival_date = loc.locked_arrival_date || loc.arrival_date;
          loc.departure_date = loc.locked_departure_date || loc.departure_date;
          currentDate = new Date(loc.departure_date + 'T00:00:00Z');
        } else {
          // Unlocked destination - calculate normally
          loc.arrival_date = formatDate(currentDate);
          loc.departure_date = formatDate(addDays(currentDate, (loc.duration_days || 1) - 1));
          currentDate = addDays(new Date(loc.departure_date + 'T00:00:00Z'), 1);
        }
      }
    }

    recalculateTripMetadata();
    triggerAutosave();

    // Detect and return conflicts
    const conflicts = detectDateConflicts(locations);
    return { conflicts };
  }
  
  function render(legName, subLegName = null, useRouting = false, triggerAutoSave = true) {
    refreshDataIntegrityButton();
    refreshGeographicValidationBadge();

    // Check if country view is enabled
    const countryViewToggle = document.getElementById('country-view-toggle');
    if (countryViewToggle && countryViewToggle.checked) {
      // In country view mode, just render the country rollup without updating map
      renderCountryRollupView(workingData);
      updateScenarioNameDisplay();
      return;
    }

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

    // Setup compact mode toggle (only needs to be called once)
    setupCompactModeToggle();

    // Check for date conflicts and display warnings
    const conflicts = detectDateConflicts(workingData.locations || []);
    displayConflictWarnings(conflicts);

    // Trigger auto-save if scenario is loaded
    if (triggerAutoSave) {
      autoSaveScenario();
    }

    const summary = document.getElementById('summary');
    const sidebarSummary = document.getElementById('sidebar-summary');
    let summaryText = '';

    // Helper function to calculate total cost for filtered destinations
    const calculateTotalCost = (destinations, includeTransport = true) => {
      // Calculate destination costs
      let total = destinations.reduce((sum, loc) => {
        // Use the same cost calculation function used elsewhere for consistency
        const allCosts = workingData.costs || [];
        const locationCosts = window.calculateDestinationCosts
          ? window.calculateDestinationCosts(loc.id, allCosts, loc, workingData.locations)
          : { total: allCosts.filter(c => c.destination_id === loc.id).reduce((s, cost) => s + (parseFloat(cost.amount_usd) || 0), 0) };
        return sum + locationCosts.total;
      }, 0);

      // Add inter-destination travel costs only if includeTransport is true
      if (includeTransport) {
        // Use transport segments if available, otherwise fall back to calculation
        if (window.transportSegmentManager && window.transportSegmentManager.getAllSegments().length > 0) {
          // Add costs from transport segments
          for (let i = 0; i < destinations.length - 1; i++) {
            const fromLocation = destinations[i];
            const toLocation = destinations[i + 1];
            const segment = window.transportSegmentManager.getSegment(fromLocation.id, toLocation.id);

            if (segment) {
              total += window.transportSegmentManager.getActiveCost(segment);
            }
          }
        } else {
          // Fall back to old calculation method
          for (let i = 0; i < destinations.length - 1; i++) {
            const fromLocation = destinations[i];
            const toLocation = destinations[i + 1];

            // Calculate distance between destinations
            const fromLL = toLatLng(fromLocation);
            const toLL = toLatLng(toLocation);

            if (fromLL && toLL) {
              const distance = google.maps.geometry.spherical.computeDistanceBetween(
                new google.maps.LatLng(fromLL.lat, fromLL.lng),
                new google.maps.LatLng(toLL.lat, toLL.lng)
              );

              const transportMode = getTransportationMode(fromLocation, toLocation, i);
              const travelCost = getTransportationCost(fromLocation, toLocation, transportMode, distance);
              total += travelCost;
            }
          }
        }
      }

      return total;
    };

    // Helper function to calculate total duration for filtered destinations
    const calculateTotalDuration = (destinations) => {
      return destinations.reduce((sum, loc) => {
        return sum + (loc.duration_days || 1);
      }, 0);
    };

    // Helper function to count unique continents
    const countUniqueContinents = (destinations) => {
      try {
        if (!destinations || !Array.isArray(destinations)) return 0;
        const continents = new Set(destinations
          .map(loc => loc?.continent)
          .filter(Boolean));
        return continents.size;
      } catch (e) {
        console.warn('Error counting continents:', e);
        return 0;
      }
    };

    // Helper function to count unique countries
    const countUniqueCountries = (destinations) => {
      try {
        if (!destinations || !Array.isArray(destinations)) return 0;
        const countries = new Set(destinations
          .map(loc => loc?.country)
          .filter(Boolean));
        return countries.size;
      } catch (e) {
        console.warn('Error counting countries:', e);
        return 0;
      }
    };

    // Helper function to calculate date range from filtered locations
    const calculateDateRange = (destinations) => {
      if (destinations.length === 0) return '';

      // Sort locations by date to find chronological first and last
      const sortedLocations = [...destinations].sort((a, b) => {
        const dateA = a.arrival_date || a.departure_date || '';
        const dateB = b.arrival_date || b.departure_date || '';
        return dateA.localeCompare(dateB);
      });

      const firstLocation = sortedLocations[0];
      const lastLocation = sortedLocations[sortedLocations.length - 1];
      const startDate = firstLocation.arrival_date || firstLocation.departure_date;
      const endDate = lastLocation.departure_date || lastLocation.arrival_date;

      if (startDate && endDate) {
        return formatDateCompact(startDate, endDate);
      }
      return '';
    };

    // Get the state of the "Show Transport" checkbox
    const includeTransport = routingToggle ? routingToggle.checked : true;

    if (legName === 'all') {
      const totalCost = calculateTotalCost(filtered, includeTransport);
      const totalDays = calculateTotalDuration(filtered);
      const dateRange = calculateDateRange(filtered);
      const continentCount = countUniqueContinents(filtered);
      const countryCount = countUniqueCountries(filtered);
      const formattedCost = window.formatCurrency ? window.formatCurrency(totalCost) : `$${Math.round(totalCost).toLocaleString()}`;

      // Format: stops • continents • countries • duration • dates • cost
      summaryText = dateRange
        ? `${filtered.length} stops • ${continentCount} continents • ${countryCount} countries • ${totalDays} days • ${dateRange} • ${formattedCost}${!includeTransport ? ' (excludes transport)' : ''}`
        : `${filtered.length} stops • ${continentCount} continents • ${countryCount} countries • ${totalDays} days • ${formattedCost}${!includeTransport ? ' (excludes transport)' : ''}`;
    } else if (subLegName) {
      const leg = workingData.legs?.find(l => l.name === legName);
      const subLeg = leg?.sub_legs?.find(sl => sl.name === subLegName);
      if (subLeg) {
        const totalCost = calculateTotalCost(filtered, includeTransport);
        const totalDays = calculateTotalDuration(filtered);
        const dateRange = calculateDateRange(filtered);
        const continentCount = countUniqueContinents(filtered);
        const countryCount = countUniqueCountries(filtered);
        const formattedCost = window.formatCurrency ? window.formatCurrency(totalCost) : `$${Math.round(totalCost).toLocaleString()}`;

        // Format: leg name • stops • continents • countries • duration • dates • cost
        summaryText = dateRange
          ? `${subLegName} • ${filtered.length} stops • ${continentCount} continents • ${countryCount} countries • ${totalDays} days • ${dateRange} • ${formattedCost}${!includeTransport ? ' (excludes transport)' : ''}`
          : `${subLegName} • ${filtered.length} stops • ${continentCount} continents • ${countryCount} countries • ${totalDays} days • ${formattedCost}${!includeTransport ? ' (excludes transport)' : ''}`;
      } else {
        summaryText = `${filtered.length} stops`;
      }
    } else {
      const leg = workingData.legs?.find(l => l.name === legName);
      if (leg) {
        const totalCost = calculateTotalCost(filtered, includeTransport);
        const totalDays = calculateTotalDuration(filtered);
        const dateRange = calculateDateRange(filtered);
        const continentCount = countUniqueContinents(filtered);
        const countryCount = countUniqueCountries(filtered);
        const formattedCost = window.formatCurrency ? window.formatCurrency(totalCost) : `$${Math.round(totalCost).toLocaleString()}`;

        // Format: leg name • stops • continents • countries • duration • dates • cost
        summaryText = dateRange
          ? `${legName} • ${filtered.length} stops • ${continentCount} continents • ${countryCount} countries • ${totalDays} days • ${dateRange} • ${formattedCost}${!includeTransport ? ' (excludes transport)' : ''}`
          : `${legName} • ${filtered.length} stops • ${continentCount} continents • ${countryCount} countries • ${totalDays} days • ${formattedCost}${!includeTransport ? ' (excludes transport)' : ''}`;
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
  
  async function requestCostUpdateFromAgent(destination, buttonEl, legName = '', subLegName = '', options = {}) {
    if (!destination) {
      console.warn('⚠️ Skipping cost update request - destination missing.');
      return false;
    }

    if (!currentScenarioId) {
      alert('Please save or load a scenario before updating costs.');
      return false;
    }

    const destinationLabel = destination.name || destination.city || destination.id || 'Selected destination';

    const normalizeDate = (value) => {
      if (!value) return null;
      const str = String(value).trim();
      return str.length ? str : null;
    };

    const arrivalDate = normalizeDate(
      destination.arrival_date ||
      destination.arrivalDate ||
      destination.start_date ||
      destination.startDate
    );
    const departureDate = normalizeDate(
      destination.departure_date ||
      destination.departureDate ||
      destination.end_date ||
      destination.endDate
    );

    let durationDays = Number(destination.duration_days ?? destination.durationDays);
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      if (arrivalDate && departureDate) {
        const start = new Date(`${arrivalDate}T00:00:00Z`);
        const end = new Date(`${departureDate}T00:00:00Z`);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          const diff = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
          durationDays = Math.max(1, diff || 0) || 1;
        }
      }
    }
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      durationDays = 3;
    }

    const travelerCountCandidates = [
      Array.isArray(workingData?.trip?.travelers) ? workingData.trip.travelers.length : null,
      workingData?.trip?.num_travelers,
      workingData?.trip?.traveler_count,
      workingData?.trip?.travelers_count,
      workingData?.trip?.party_size,
      workingData?.trip?.partySize,
      workingData?.trip?.guests,
      workingData?.trip?.crew_size,
    ];
    const numTravelers = travelerCountCandidates.find((value) => Number.isFinite(value) && value > 0) || 2;

    const normalizedId = (() => {
      const idSource = destination.id
        ?? destination.destination_id
        ?? destination.destinationId
        ?? destination.normalizedId
        ?? destination.place_id
        ?? destination.placeId;
      if (idSource) {
        return normalizeId(idSource);
      }
      const slugBase = destination.name || destination.city || destinationLabel;
      return normalizeId(slugBase || 'destination');
    })();

    const lookupNeighborName = (offset) => {
      const locations = workingData.locations || [];
      const currentIndex = locations.findIndex((candidate) => idsEqual(candidate.id, destination.id));
      if (currentIndex === -1) return null;
      const neighbor = locations[currentIndex + offset];
      if (!neighbor) return null;
      return neighbor.name || neighbor.city || neighbor.place_name || null;
    };

    const previousDestination = lookupNeighborName(-1);
    const nextDestination = lookupNeighborName(1);

    const travelStyle =
      destination.travel_style ||
      destination.activity_type ||
      workingData?.trip?.travel_style ||
      workingData?.trip?.style ||
      'mid-range';

    const sessionId =
      chatInstance?.sessionId ||
      statePersistence?.state?.sessionId ||
      `session_cost_${Date.now()}`;

    const payload = {
      session_id: sessionId,
      scenario_id: currentScenarioId,
      destination_name: destinationLabel,
      destination_id: normalizedId,
      duration_days: Math.max(1, Math.round(durationDays)),
      arrival_date: arrivalDate,
      departure_date: departureDate,
      num_travelers: Math.max(1, Math.round(numTravelers)),
      travel_style: String(travelStyle || 'mid-range'),
      previous_destination: previousDestination || undefined,
      next_destination: nextDestination || undefined,
    };

    const externalWaitEntry = options?.waitEntry || null;
    const buttonState = buttonEl
      ? {
          text: buttonEl.textContent,
          disabled: buttonEl.disabled,
        }
      : null;
    const waitEntry = externalWaitEntry || (buttonEl ? waitForNextCostUpdate(destinationLabel) : null);
    const manageWaiterInternally = Boolean(waitEntry) && !externalWaitEntry && Boolean(buttonEl);

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.classList.add('update-costs-btn--sent');
      buttonEl.textContent = 'Researching...';
    }

    if (chatInstance) {
      chatInstance.addMessage(
        `Researching updated costs for ${destinationLabel}...`,
        'bot',
        false,
        false,
        false,
        false
      );
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/costs/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error('Received an invalid response from the cost research endpoint.');
      }

      if (!response.ok) {
        const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      if (data?.status === 'partial') {
        const partialMessage = data?.message || 'The research run did not include structured pricing data.';
        console.warn(`⚠️ Cost research returned partial result for ${destinationLabel}:`, data);

        // Resolve the waiter with partial status - not an error, just no structured data
        if (waitEntry) {
          waitEntry.resolve({
            costRefreshSucceeded: false,
            summarySucceeded: false,
            partial: true,
            partialMessage,
          });
        }

        if (buttonEl && buttonState) {
          buttonEl.classList.remove('update-costs-btn--sent');
          buttonEl.disabled = buttonState.disabled;
          buttonEl.textContent = buttonState.text || 'Update Costs';
        }

        const supplementalNotes = data?.response_text ? `\n\nAgent notes:\n${data.response_text}` : '';
        const userFacingMessage = `I researched costs for ${destinationLabel}, but the results came back without structured pricing to save.${supplementalNotes ? ` ${supplementalNotes}` : ''}\n\n${partialMessage} Try again in a bit or refine the request.`;

        if (chatInstance) {
          chatInstance.addMessage(
            userFacingMessage,
            'bot',
            false,
            false,
            false,
            false
          );
        } else {
          alert(`Cost research for ${destinationLabel} returned narrative results but no structured pricing.\n\n${partialMessage}`);
        }

        return { ok: true, status: 'partial', message: partialMessage };
      }

      if (data?.status !== 'success') {
        const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      const storageMode = data.storage || (data.saved_to_firestore ? 'firestore' : 'local');
      console.log(`✅ Cost research completed for ${destinationLabel} (storage: ${storageMode})`);

      if (chatInstance && data.response_text) {
        chatInstance.addMessage(
          data.response_text,
          'bot',
          false,
          false,
          false,
          false
        );
      }

      window.dispatchEvent(
        new CustomEvent('costs-updated', {
          detail: {
            reason: 'cost-research',
            destinationId: normalizedId,
            storage: storageMode,
            costsSaved: data.costs_saved ?? (Array.isArray(data.research) ? data.research.length : undefined),
          },
        })
      );

      if (manageWaiterInternally) {
        try {
          await waitEntry.promise;
        } catch (waitError) {
          console.warn('⚠️ Cost refresh wait ended with warning:', waitError);
        }
      }

      if (buttonEl && buttonState) {
        buttonEl.classList.remove('update-costs-btn--sent');
        buttonEl.classList.add('update-costs-btn--complete');
        buttonEl.textContent = 'Updated!';
        setTimeout(() => {
          buttonEl.classList.remove('update-costs-btn--complete');
          buttonEl.disabled = buttonState.disabled;
          buttonEl.textContent = buttonState.text || 'Update Costs';
        }, 2500);
      }

      return { ok: true, status: 'success', storageMode };
    } catch (error) {
      console.error('❌ Cost research failed:', error);

      if (waitEntry) {
        waitEntry.cancel(error);
      }

      if (buttonEl && buttonState) {
        buttonEl.classList.remove('update-costs-btn--sent');
        buttonEl.disabled = buttonState.disabled;
        buttonEl.textContent = buttonState.text || 'Update Costs';
      }

      if (chatInstance) {
        chatInstance.addMessage(
          `Sorry, I couldn't update the costs for ${destinationLabel}: ${error.message}`,
          'bot',
          false,
          false,
          false,
          false
        );
      } else {
        alert(`Failed to update costs for ${destinationLabel}: ${error.message}`);
      }

      return { ok: false, status: 'error', error };
    }
  }

  // Country rollup view rendering
  function renderCountryRollupView(tripData, showCosts = false) {
    const countryStays = aggregateByCountry(tripData);
    const continentGroups = groupByContinent(countryStays);
    const regionGroups = groupByRegion(countryStays);
    const stats = calculateCountryStats(countryStays);

    const destinationList = document.getElementById('destination-list');
    const sidebarItems = [];

    sidebarItems.push(`
      <div class="country-rollup-controls" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; gap: 8px;">
          <button id="expand-all-btn" style="padding: 6px 12px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
            ▼ Expand All
          </button>
          <button id="collapse-all-btn" style="padding: 6px 12px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
            ▶ Collapse All
          </button>
        </div>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; user-select: none;">
          <input type="checkbox" id="show-costs-toggle" ${showCosts ? 'checked' : ''} style="cursor: pointer;">
          <span>Show Costs</span>
        </label>
      </div>
      <div class="country-rollup-stats" style="padding: 12px; background: #f5f5f5; border-radius: 8px; margin-bottom: 12px;">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 14px;">
          <div>
            <div style="color: #666; font-size: 12px;">Total Countries</div>
            <div style="font-size: 20px; font-weight: bold; color: #333;">${stats.totalCountries}</div>
          </div>
          <div>
            <div style="color: #666; font-size: 12px;">Total Days</div>
            <div style="font-size: 20px; font-weight: bold; color: #333;">${stats.totalDays}</div>
          </div>
          <div>
            <div style="color: #666; font-size: 12px;">Avg Days/Country</div>
            <div style="font-size: 20px; font-weight: bold; color: #333;">${stats.averageDaysPerCountry}</div>
          </div>
          ${showCosts ? `
          <div>
            <div style="color: #666; font-size: 12px;">Total Costs</div>
            <div style="font-size: 20px; font-weight: bold; color: #333;">$${stats.totalCosts.toLocaleString()}</div>
          </div>
          ` : '<div></div>'}
        </div>
      </div>
    `);

    // Render countries grouped by continent with region summaries
    for (const [continent, countries] of continentGroups) {
      // Get all regions for this continent
      const continentRegions = Array.from(regionGroups.values())
        .filter(r => r.continent === continent)
        .sort((a, b) => {
          if (!a.startDate) return 1;
          if (!b.startDate) return -1;
          return a.startDate.localeCompare(b.startDate);
        });

      // Calculate continent totals
      const continentTotalDays = countries.reduce((sum, c) => sum + c.totalDays, 0);
      const continentTotalWeeks = Math.round((continentTotalDays / 7) * 10) / 10;
      const continentWeeksText = continentTotalWeeks === 1 ? '1 week' : `${continentTotalWeeks} weeks`;

      const continentId = continent.replace(/\s+/g, '-').toLowerCase();

      sidebarItems.push(`
        <div class="continent-group" style="margin-bottom: 24px;" data-continent="${continentId}">
          <div class="continent-header" style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 12px; padding: 8px; background: #e8f4f8; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;" data-continent-id="${continentId}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="collapse-icon" style="font-size: 14px; transition: transform 0.2s;">▼</span>
              <span>${continent}</span>
            </div>
            <span style="font-size: 14px; font-weight: 600; color: #555;">${continentTotalDays} days (${continentWeeksText})</span>
          </div>
          <div class="continent-content" data-continent-content="${continentId}">
      `);

      // Render region summaries for this continent
      continentRegions.forEach(regionStay => {
        const weeksText = regionStay.totalWeeks === 1 ? '1 week' : `${regionStay.totalWeeks} weeks`;
        const countriesText = regionStay.countries.length === 1
          ? regionStay.countries[0]
          : `${regionStay.countries.length} countries`;

        const regionId = `${continentId}-${regionStay.region.replace(/\s+/g, '-').toLowerCase()}`;

        sidebarItems.push(`
          <div class="region-group" style="margin-bottom: 16px;" data-region="${regionId}">
            <div class="region-summary" style="padding: 10px; background: #f9f9f9; border-left: 4px solid #4a90e2; border-radius: 4px; cursor: pointer; user-select: none;" data-region-id="${regionId}">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                  <span class="collapse-icon" style="font-size: 12px; transition: transform 0.2s;">▼</span>
                  <div>
                    <div style="font-size: 14px; font-weight: 600; color: #4a90e2; margin-bottom: 4px;">
                      ${regionStay.region}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                      ${countriesText}
                    </div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 16px; font-weight: bold; color: #333;">
                    ${regionStay.totalDays} days
                  </div>
                  <div style="font-size: 11px; color: #888;">
                    (${weeksText})
                  </div>
                </div>
              </div>
            </div>
            <div class="region-content" data-region-content="${regionId}">
        `);

        // Render countries within this region
        regionStay.countryStays.forEach((countryStay, idx) => {
          const dateRange = formatDateCompact(countryStay.startDate, countryStay.endDate);
          const costPerDay = countryStay.totalDays > 0
            ? Math.round(countryStay.totalCosts / countryStay.totalDays)
            : 0;

          sidebarItems.push(`
            <div class="country-item" style="margin-bottom: 12px; margin-left: 12px; padding: 12px; background: white; border: 1px solid #e0e0e0; border-radius: 6px; cursor: pointer;" data-country="${countryStay.country}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                  <div style="font-size: 15px; font-weight: 600; color: #333; margin-bottom: 4px;">
                    ${countryStay.country}
                  </div>
                  <div style="font-size: 13px; color: #888;">
                    ${dateRange || 'Dates TBD'}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 20px; font-weight: bold; color: #2c3e50;">
                    ${countryStay.totalDays}
                  </div>
                  <div style="font-size: 11px; color: #888; text-transform: uppercase;">
                    ${countryStay.totalDays === 1 ? 'day' : 'days'}
                  </div>
                </div>
              </div>

              ${showCosts && countryStay.totalCosts > 0 ? `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0;">
                  <div style="display: flex; justify-content: space-between; font-size: 13px;">
                    <span style="color: #666;">Total Cost:</span>
                    <span style="font-weight: 600; color: #333;">$${countryStay.totalCosts.toLocaleString()}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                    <span style="color: #666;">Per Day:</span>
                    <span style="font-weight: 600; color: #333;">$${costPerDay.toLocaleString()}</span>
                  </div>
                </div>
              ` : ''}

              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0;">
                <div style="font-size: 12px; color: #666;">
                  ${countryStay.destinations.length} ${countryStay.destinations.length === 1 ? 'destination' : 'destinations'}:
                  <span style="color: #888; margin-left: 4px;">
                    ${countryStay.destinations.map(d => d.name).join(', ')}
                  </span>
                </div>
              </div>

              <div style="margin-top: 8px;">
                <textarea class="editable-country-notes" placeholder="Add notes for ${countryStay.country}..." data-country="${countryStay.country}">${countryStay.notes || ''}</textarea>
              </div>
            </div>
          `);
        });

        sidebarItems.push(`
            </div>
          </div>
        `);
      });

      sidebarItems.push(`
          </div>
        </div>
      `);
    }

    destinationList.innerHTML = sidebarItems.join('');

    // Add collapse/expand handlers for continents
    destinationList.querySelectorAll('.continent-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const continentId = header.dataset.continentId;
        const content = destinationList.querySelector(`[data-continent-content="${continentId}"]`);
        const icon = header.querySelector('.collapse-icon');

        if (content.style.display === 'none') {
          content.style.display = 'block';
          icon.style.transform = 'rotate(0deg)';
        } else {
          content.style.display = 'none';
          icon.style.transform = 'rotate(-90deg)';
        }
      });
    });

    // Add collapse/expand handlers for regions
    destinationList.querySelectorAll('.region-summary').forEach(summary => {
      summary.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent continent collapse when clicking region
        const regionId = summary.dataset.regionId;
        const content = destinationList.querySelector(`[data-region-content="${regionId}"]`);
        const icon = summary.querySelector('.collapse-icon');

        if (content.style.display === 'none') {
          content.style.display = 'block';
          icon.style.transform = 'rotate(0deg)';
        } else {
          content.style.display = 'none';
          icon.style.transform = 'rotate(-90deg)';
        }
      });
    });

    // Add expand all button handler
    const expandAllBtn = document.getElementById('expand-all-btn');
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => {
        // Expand all continents
        destinationList.querySelectorAll('[data-continent-content]').forEach(content => {
          content.style.display = 'block';
        });
        destinationList.querySelectorAll('.continent-header .collapse-icon').forEach(icon => {
          icon.style.transform = 'rotate(0deg)';
        });

        // Expand all regions
        destinationList.querySelectorAll('[data-region-content]').forEach(content => {
          content.style.display = 'block';
        });
        destinationList.querySelectorAll('.region-summary .collapse-icon').forEach(icon => {
          icon.style.transform = 'rotate(0deg)';
        });
      });
    }

    // Add collapse all button handler
    const collapseAllBtn = document.getElementById('collapse-all-btn');
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => {
        // Collapse all continents
        destinationList.querySelectorAll('[data-continent-content]').forEach(content => {
          content.style.display = 'none';
        });
        destinationList.querySelectorAll('.continent-header .collapse-icon').forEach(icon => {
          icon.style.transform = 'rotate(-90deg)';
        });

        // Note: regions are inside continents, so they'll be hidden when continents collapse
        // But we'll reset their icons to collapsed state for consistency
        destinationList.querySelectorAll('.region-summary .collapse-icon').forEach(icon => {
          icon.style.transform = 'rotate(-90deg)';
        });
        destinationList.querySelectorAll('[data-region-content]').forEach(content => {
          content.style.display = 'none';
        });
      });
    }

    // Add show costs toggle handler
    const showCostsToggle = document.getElementById('show-costs-toggle');
    if (showCostsToggle) {
      showCostsToggle.addEventListener('change', (e) => {
        // Re-render the country view with the new showCosts setting
        renderCountryRollupView(tripData, e.target.checked);
      });
    }

    // Add click handlers to expand to show individual destinations
    destinationList.querySelectorAll('.country-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const country = item.dataset.country;
        // Switch back to destination view and filter to that country's destinations
        const viewToggle = document.getElementById('country-view-toggle');
        if (viewToggle) {
          viewToggle.checked = false;
          // Trigger update to show destinations
          updateDestinationView();
        }
      });
    });

    // Setup country notes editing
    setupCountryNotesEditing(destinationList);
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


      // Determine if dates are locked
    const isDateLocked = loc.is_date_locked || false;
    const lockedClass = isDateLocked ? 'destination-locked' : '';
    const lockIcon = isDateLocked ? '🔒' : '🔓';

    // Add duration editing state indicator for visual feedback
    const isDurationUpdating = loc._is_duration_updating || false;
    const durationUpdateClass = isDurationUpdating ? 'duration-updating' : '';

    // Show visual feedback during duration update
    if (isDurationUpdating) {
      // Add updating class to duration input for visual feedback
      const durationInput = container.querySelector(`.editable-duration[data-location-id="${loc.id}"]`);
      if (durationInput) {
        durationInput.classList.add('duration-updating');
      }
    }

      // Date picker HTML for locked destinations
      const datePickerHTML = isDateLocked ? `
        <div class="locked-date-pickers" style="margin-top: 8px; display: flex; gap: 8px; font-size: 12px;">
          <label style="display: flex; flex-direction: column;">
            <span style="color: #666;">Arrival:</span>
            <input type="date" class="locked-arrival-date" value="${loc.locked_arrival_date || loc.arrival_date || ''}" data-location-id="${loc.id}" style="padding: 4px; border: 1px solid #ddd; border-radius: 4px;">
          </label>
          <label style="display: flex; flex-direction: column;">
            <span style="color: #666;">Departure:</span>
            <input type="date" class="locked-departure-date" value="${loc.locked_departure_date || loc.departure_date || ''}" data-location-id="${loc.id}" style="padding: 4px; border: 1px solid #ddd; border-radius: 4px;">
          </label>
        </div>
      ` : '';

      // Add the destination item
      sidebarItems.push(`
        <div class="destination-item ${lockedClass}" data-index="${idx}" data-location-id="${loc.id}" draggable="true" style="display: flex; align-items: flex-start;">
          <div class="drag-handle">⋮⋮</div>
          <div class="destination-number" style="background: ${getActivityColor(loc.activity_type)}">${idx + 1}</div>
          <div class="destination-info">
            <div class="destination-name">
              ${loc.name}
              <button class="date-lock-toggle" data-location-id="${loc.id}" title="${isDateLocked ? 'Unlock dates' : 'Lock dates'}" style="margin-left: 8px; background: none; border: none; cursor: pointer; font-size: 16px; padding: 0;">${lockIcon}</button>
            </div>
            <div class="destination-location">
              <span>${[loc.city, loc.country].filter(Boolean).join(', ')}</span>
              ${loc.activity_type ? `<div class="destination-activity" style="background: ${getActivityColor(loc.activity_type)}">${loc.activity_type}</div>` : ''}
            </div>
              <div class="destination-dates">
                ${dateRange ? `${dateRange} • ` : ''}
                <input type="number" class="editable-duration" value="${duration}" min="1" max="365" data-location-id="${loc.id}" ${isDateLocked ? 'disabled' : ''}> days
              </div>
            ${datePickerHTML}
            ${costSummaryHTML}
            <div class="destination-cost-details" id="cost-details-${loc.id}">
              ${costBreakdownHTML}
              ${costDetailsHTML}
            </div>
            <div class="destination-notes">
              <textarea class="editable-notes" placeholder="Add notes..." data-location-id="${loc.id}">${notes}</textarea>
            </div>
            <div class="education-section-placeholder" data-location-id="${loc.id}">
              <div class="education-loading">Loading education...</div>
            </div>
          </div>
          <button class="delete-destination-btn" data-location-id="${loc.id}" title="Delete destination">×</button>
        </div>
      `);

      // Add transport segment if not the last destination AND routing toggle is checked
      const routingToggle = document.getElementById('routing-toggle');
      const showTransport = routingToggle ? routingToggle.checked : true;

      console.log(`[Transport Debug] idx=${idx}, showTransport=${showTransport}, hasManager=${!!window.transportSegmentManager}, isLastDest=${idx >= locations.length - 1}`);

      if (showTransport && idx < locations.length - 1 && window.transportSegmentManager) {
        const nextLoc = locations[idx + 1];
        const segment = window.transportSegmentManager.getSegment(loc.id, nextLoc.id);
        console.log(`[Transport Debug] Looking for segment from ${loc.id} to ${nextLoc.id}, found:`, segment);

        if (segment) {
          try {
            const activeCost = window.transportSegmentManager.getActiveCost(segment);
            const formattedCost = window.transportSegmentManager.formatCurrency(activeCost);
            const confidenceBadge = window.transportSegmentManager.getConfidenceBadge(segment);

          // Add auto-update indicator and research status
          const autoUpdatedIndicator = segment.auto_updated ? '<span class="auto-updated-badge" title="Costs auto-updated from research">✨</span>' : '';
          const researchStatus = segment.booking_status === 'researched' ? 'RES' : (segment.booking_status === 'estimated' ? 'EST' : '');
          const statusBadge = researchStatus ? `<span class="status-badge status-${segment.booking_status}">${researchStatus}</span>` : '';

          // Show airlines if researched
          const airlinesInfo = segment.researched_airlines && segment.researched_airlines.length > 0
            ? `<div class="transport-airlines">${segment.researched_airlines.slice(0, 2).join(', ')}</div>`
            : '';

          // Show alternatives indicator if available (click edit to view)
          const alternativesInfo = segment.researched_alternatives && segment.researched_alternatives.length > 0
            ? `<span class="alternatives-indicator" title="${segment.researched_alternatives.length} alternative routes found - click ✏️ to view">🔀 ${segment.researched_alternatives.length}</span>`
            : '';

          sidebarItems.push(`
            <div class="transport-segment ${segment.auto_updated ? 'auto-updated' : ''}" data-segment-id="${segment.id}" data-from-id="${loc.id}" data-to-id="${nextLoc.id}">
              <div class="transport-segment-line"></div>
              <div class="transport-segment-content">
                <div class="transport-segment-icon">${segment.transport_mode_icon}</div>
                <div class="transport-segment-info">
                  <div class="transport-segment-route">${loc.name} → ${nextLoc.name}</div>
                  <div class="transport-segment-details">
                    <span class="transport-mode">${segment.transport_mode}</span>
                    ${segment.distance_km ? `<span class="transport-distance">${Math.round(segment.distance_km)}km</span>` : ''}
                    ${segment.duration_hours ? `<span class="transport-duration">${Math.round(segment.duration_hours)}h</span>` : ''}
                  </div>
                  <div class="transport-segment-cost">
                    <span class="cost-amount">${formattedCost}</span>
                    ${statusBadge}
                    ${confidenceBadge}
                    ${autoUpdatedIndicator}
                  </div>
                  ${airlinesInfo}
                  ${segment.notes ? `<div class="transport-segment-notes">${segment.notes}</div>` : ''}
                </div>
                <div class="transport-segment-actions">
                  ${alternativesInfo}
                  <button class="transport-edit-btn" data-segment-id="${segment.id}" title="Edit transport">✏️</button>
                  <button class="transport-research-btn" data-segment-id="${segment.id}" title="AI Research costs">🤖</button>
                </div>
              </div>
            </div>
          `);
          } catch (error) {
            console.error('Error rendering transport segment:', error);
            console.error('Segment:', segment);
          }
        }
      }
    });
    
    destinationList.innerHTML = sidebarItems.join('');

    destinationList.querySelectorAll('.update-costs-btn').forEach((button) => {
      button.addEventListener('click', async (event) => {
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

        await requestCostUpdateFromAgent(destination, button, legName, subLegName);
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

    // Add click handlers for transport segment edit buttons
    destinationList.querySelectorAll('.transport-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const segmentId = e.currentTarget.dataset.segmentId;
        openTransportEditModal(segmentId);
      });
    });

    // Add click handlers for transport segment research buttons
    destinationList.querySelectorAll('.transport-research-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const segmentId = e.currentTarget.dataset.segmentId;
        researchTransportCost(segmentId);
      });
    });

    setupDragAndDrop(destinationList, locations);
    setupDurationEditing(destinationList, locations);
    setupNotesEditing(destinationList, locations);
    setupDateLocking(destinationList);

    // Load education sections asynchronously
    loadEducationSections(locations);
  }

  async function loadEducationSections(locations) {
    // Load education data for each location
    for (const location of locations) {
      try {
        const placeholder = document.querySelector(`.education-section-placeholder[data-location-id="${location.id}"]`);
        if (placeholder) {
          const educationHTML = await loadEducationSection(location);
          placeholder.outerHTML = educationHTML;
        }
      } catch (error) {
        console.error(`Failed to load education for ${location.name}:`, error);
        // Keep the placeholder with error message
        const placeholder = document.querySelector(`.education-section-placeholder[data-location-id="${location.id}"]`);
        if (placeholder) {
          placeholder.innerHTML = '<div class="education-error">Unable to load education</div>';
        }
      }
    }
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
          // Only allow duration editing for unlocked destinations
          if (globalLocation.is_date_locked) {
            console.warn('⚠️ Duration change blocked: destination is locked', globalLocation.name);
            // Reset input to original value
            e.target.value = globalLocation.duration_days || 1;
            return;
          }

          ensureLocationCostBaseline(globalLocation);
          globalLocation.duration_days = newDuration;
          
          // Recalculate dates and update UI
          const result = recalculateDates(workingData.locations);
          displayConflictWarnings(result.conflicts);
          render(legFilter.value, subLegFilter.value, routingToggle.checked);
          
          console.log(`✅ Updated duration for unlocked destination "${globalLocation.name}" to ${newDuration} days`);
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

  function setupCountryNotesEditing(container) {
    container.querySelectorAll('.editable-country-notes').forEach(textarea => {
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

        const country = e.target.dataset.country;
        const newNotes = e.target.value;

        // Clear previous timer
        if (notesTimer) clearTimeout(notesTimer);

        // Set new timer to save after 1 second of no typing
        notesTimer = setTimeout(() => {
          // Initialize countryNotes if not exists
          if (!workingData.countryNotes) {
            workingData.countryNotes = {};
          }

          workingData.countryNotes[country] = newNotes;
          triggerAutosave();
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

  function setupDateLocking(container) {
    // Lock toggle buttons
    container.querySelectorAll('.date-lock-toggle').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const locationId = button.dataset.locationId;
        const globalLocation = workingData.locations.find(loc => idsEqual(loc.id, locationId));

        if (globalLocation) {
          // Toggle the lock state
          globalLocation.is_date_locked = !globalLocation.is_date_locked;

          // If locking, capture current dates as locked dates
          if (globalLocation.is_date_locked) {
            globalLocation.locked_arrival_date = globalLocation.arrival_date;
            globalLocation.locked_departure_date = globalLocation.departure_date;
          } else {
            // If unlocking, clear locked dates (keep them for reference but recalculate)
            globalLocation.locked_arrival_date = null;
            globalLocation.locked_departure_date = null;
          }

          // Recalculate dates and check for conflicts
          const result = recalculateDates(workingData.locations);
          displayConflictWarnings(result.conflicts);

          // Re-render to show updated UI
          render(legFilter.value, subLegFilter.value, routingToggle.checked);
        }
      });
    });

    // Locked arrival date inputs
    container.querySelectorAll('.locked-arrival-date').forEach(input => {
      input.addEventListener('change', (e) => {
        e.stopPropagation();
        const locationId = input.dataset.locationId;
        const newDate = e.target.value;
        const globalLocation = workingData.locations.find(loc => idsEqual(loc.id, locationId));

        if (globalLocation && globalLocation.is_date_locked) {
          globalLocation.locked_arrival_date = newDate;
          globalLocation.arrival_date = newDate; // Update the main arrival date too

          // Recalculate duration based on new arrival and existing departure
          if (globalLocation.locked_departure_date) {
            const arrDate = new Date(newDate + 'T00:00:00Z');
            const depDate = new Date(globalLocation.locked_departure_date + 'T00:00:00Z');
            const durationDays = Math.round((depDate - arrDate) / (24 * 60 * 60 * 1000)) + 1;
            globalLocation.duration_days = Math.max(1, durationDays);
          }

          const result = recalculateDates(workingData.locations);
          displayConflictWarnings(result.conflicts);
          render(legFilter.value, subLegFilter.value, routingToggle.checked);
        }
      });

      input.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });

    // Locked departure date inputs
    container.querySelectorAll('.locked-departure-date').forEach(input => {
      input.addEventListener('change', (e) => {
        e.stopPropagation();
        const locationId = input.dataset.locationId;
        const newDate = e.target.value;
        const globalLocation = workingData.locations.find(loc => idsEqual(loc.id, locationId));

        if (globalLocation && globalLocation.is_date_locked) {
          globalLocation.locked_departure_date = newDate;
          globalLocation.departure_date = newDate; // Update the main departure date too

          // Recalculate duration based on existing arrival and new departure
          if (globalLocation.locked_arrival_date) {
            const arrDate = new Date(globalLocation.locked_arrival_date + 'T00:00:00Z');
            const depDate = new Date(newDate + 'T00:00:00Z');
            const durationDays = Math.round((depDate - arrDate) / (24 * 60 * 60 * 1000)) + 1;
            globalLocation.duration_days = Math.max(1, durationDays);
          }

          const result = recalculateDates(workingData.locations);
          displayConflictWarnings(result.conflicts);
          render(legFilter.value, subLegFilter.value, routingToggle.checked);
        }
      });

      input.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
  }

  function displayConflictWarnings(conflicts) {
    // Find or create conflict warning container
    let warningContainer = document.getElementById('date-conflict-warnings');

    if (!warningContainer) {
      // Create the warning container if it doesn't exist - place it in the sidebar
      const destinationList = document.getElementById('destination-list');
      if (destinationList) {
        warningContainer = document.createElement('div');
        warningContainer.id = 'date-conflict-warnings';
        warningContainer.style.cssText = `
          background: #fff3cd;
          border: 2px solid #ffc107;
          border-radius: 8px;
          padding: 12px 16px;
          margin: 0 12px 12px 12px;
          font-size: 13px;
        `;
        destinationList.parentNode.insertBefore(warningContainer, destinationList);
      }
    }

    if (!conflicts || conflicts.length === 0) {
      if (warningContainer) {
        warningContainer.style.display = 'none';
      }
      return;
    }

    // Display conflicts
    warningContainer.style.display = 'block';
    warningContainer.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
        <strong style="color: #856404; font-size: 13px;">Date Conflicts</strong>
      </div>
      <ul style="margin: 0; padding-left: 20px; color: #856404; font-size: 12px;">
        ${conflicts.map(conflict => `<li style="margin: 4px 0;">${conflict.message}</li>`).join('')}
      </ul>
      <div style="margin-top: 8px; font-size: 11px; color: #666;">
        Adjust destination durations or locked dates to resolve.
      </div>
    `;
  }

  // Compact Mode Toggle
  let compactModeInitialized = false;
  function setupCompactModeToggle() {
    const toggle = document.getElementById('compact-mode-toggle');
    const destinationList = document.getElementById('destination-list');

    if (!toggle || !destinationList) return;

    // Load saved compact mode state from localStorage (default to true)
    const savedCompactMode = localStorage.getItem('rtw-compact-mode');
    const isCompactMode = savedCompactMode !== null ? savedCompactMode === 'true' : true;

    // Apply initial state (always sync state with localStorage)
    if (isCompactMode) {
      destinationList.classList.add('compact-mode');
      toggle.checked = true;
    } else {
      destinationList.classList.remove('compact-mode');
      toggle.checked = false;
    }

    // Save default if not set
    if (savedCompactMode === null) {
      localStorage.setItem('rtw-compact-mode', 'true');
    }

    // Only add event listener once
    if (!compactModeInitialized) {
      compactModeInitialized = true;
      toggle.addEventListener('change', (e) => {
        const isCurrentlyCompact = e.target.checked;

        if (isCurrentlyCompact) {
          destinationList.classList.add('compact-mode');
        } else {
          destinationList.classList.remove('compact-mode');
        }

        // Save to localStorage
        localStorage.setItem('rtw-compact-mode', isCurrentlyCompact.toString());
      });
    }
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

    // Clear search source indicator
    const indicator = document.getElementById('search-source-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }

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

  async function fetchPlaceDetails(placeId) {
    if (!placeId) return null;
    const baseUrl = apiBaseUrl;
    try {
      const response = await fetch(`${baseUrl}/api/places/details/${encodeURIComponent(placeId)}`);
      if (!response.ok) {
        console.warn(`⚠️ Failed to load place details for ${placeId}: ${response.status}`);
        return null;
      }
      const data = await response.json();
      if (data.status === 'success') {
        return data;
      }
      console.warn(`⚠️ Place details lookup returned status=${data.status} for ${placeId}`);
    } catch (error) {
      console.error(`❌ Error fetching place details for ${placeId}:`, error);
    }
    return null;
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

  /**
   * Enhanced Google search functions for special locations
   * Uses Text Search and Geocoding as fallbacks to find places not in Autocomplete
   */

  // Places API Text Search - broader than Autocomplete, finds natural features
  async function searchPlacesTextSearch(query) {
    return new Promise((resolve) => {
      const request = {
        query: query,
        fields: ['place_id', 'name', 'geometry', 'formatted_address', 'types']
      };

      const service = new google.maps.places.PlacesService(map);
      service.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          console.log(`✅ Text Search found: ${results[0].name}`);
          resolve({
            place_id: results[0].place_id,
            name: results[0].name,
            location: {
              lat: results[0].geometry.location.lat(),
              lng: results[0].geometry.location.lng()
            },
            formatted_address: results[0].formatted_address,
            types: results[0].types,
            source: 'text_search'
          });
        } else {
          console.log(`❌ Text Search failed: ${status}`);
          resolve(null);
        }
      });
    });
  }

  // Geocoding API - broadest search, last resort before manual entry
  async function searchGeocoding(query) {
    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          console.log(`✅ Geocoding found: ${results[0].formatted_address}`);

          // Extract place name from formatted_address (first component)
          const addressParts = results[0].formatted_address.split(',');
          const placeName = addressParts[0].trim();

          resolve({
            place_id: results[0].place_id,
            name: placeName,
            location: {
              lat: results[0].geometry.location.lat(),
              lng: results[0].geometry.location.lng()
            },
            formatted_address: results[0].formatted_address,
            address_components: results[0].address_components,
            types: results[0].types,
            source: 'geocoding'
          });
        } else {
          console.log(`❌ Geocoding failed: ${status}`);
          resolve(null);
        }
      });
    });
  }

  // Unified search with fallback chain: Text Search → Geocoding
  async function searchLocationBroadly(query) {
    console.log(`🔍 Enhanced search for: "${query}"`);

    // Try Text Search first (finds Drake Passage, Lemaire Channel, etc.)
    let result = await searchPlacesTextSearch(query);
    if (result) {
      console.log(`✅ Found via Places Text Search`);
      return result;
    }

    // Fallback to Geocoding (broadest search)
    result = await searchGeocoding(query);
    if (result) {
      console.log(`✅ Found via Geocoding API`);
      return result;
    }

    console.log(`❌ Location "${query}" not found in Google APIs`);
    return null;
  }

  async function addNewDestination(insertIndex, placeData, duration) {
    const addressInfo = parseAddressComponents(placeData.address_components || []);
    const placeDetails = await fetchPlaceDetails(placeData.place_id);

    // Always generate a unique UUID for each destination instance
    // This allows the same place to appear multiple times (e.g., Buenos Aires for transit)
    const destinationId = generateNewLocationId();
    const placeId = placeDetails?.place_id || placeData.place_id || null;

    const coordinates = placeDetails?.coordinates || {
      lat: placeData.location.lat,
      lng: placeData.location.lng
    };

    // Get country from Places API (REQUIRED)
    let country = placeDetails?.country || addressInfo.country;
    const city = placeDetails?.city || addressInfo.city;
    const administrative_area = placeDetails?.administrative_area || addressInfo.region;
    const country_code = placeDetails?.country_code;

    // Special handling for Antarctic locations (Drake Passage, etc.) that don't have a country
    const isAntarcticLocation =
      !country && (
        placeData.name.toLowerCase().includes('antarc') ||
        placeData.name.toLowerCase().includes('drake') ||
        placeData.formatted_address?.toLowerCase().includes('antarc') ||
        (coordinates.lat < -60) // Roughly Antarctic Circle
      );

    if (isAntarcticLocation) {
      console.log(`🧊 Detected Antarctic location without country: ${placeData.name}`);
      country = 'Antarctica';
    }

    // Derive region from country using authoritative mapping (REQUIRED)
    let region = null;
    let continent = null;
    if (country) {
      const regionMapping = getRegionForCountry(country);
      if (regionMapping) {
        region = regionMapping.region;
        continent = regionMapping.continent;
      } else {
        console.warn(`⚠️ No region mapping found for country: ${country}`);
        region = 'Custom'; // Fallback
        continent = 'Custom';
      }
    } else {
      console.error(`❌ Cannot add destination without country: ${placeData.name}`);
      alert(`Cannot add destination: Unable to determine country for "${placeData.name}". Please try a more specific location.`);
      return;
    }

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
      // Primary identifiers
      id: destinationId,
      name: placeDetails?.name || placeData.name,

      // Geographic hierarchy (REQUIRED)
      country,           // REQUIRED: from Places API
      region,            // REQUIRED: derived from country mapping
      city,
      administrative_area,
      country_code,
      continent,

      // Places API metadata
      place_id: placeId, // Store Place ID as metadata, not primary key
      coordinates,
      data_source: placeData.data_source || 'autocomplete', // Track where data came from

      // Trip planning
      duration_days: duration,
      activity_type: 'city exploration',
      highlights: [],
      notes: '',
      arrival_date: null,
      departure_date: null,
      leg: leg,
      sub_leg: sub_leg
    };

    if (placeDetails?.timezone) {
      newLocation.timezone = placeDetails.timezone;
    }
    if (placeDetails?.timezone_name) {
      newLocation.timezone_name = placeDetails.timezone_name;
    }
    if (placeDetails) {
      newLocation.place_data = {
        place_id: placeDetails.place_id,
        formatted_address: placeDetails.formatted_address,
        types: placeDetails.types,
        country: placeDetails.country,
        city: placeDetails.city,
        administrative_area: placeDetails.administrative_area,
        timezone: placeDetails.timezone,
        timezone_name: placeDetails.timezone_name,
        raw: placeDetails.raw_data || null
      };
    }

    ensureLocationCostBaseline(newLocation);

    workingData.locations.splice(insertIndex, 0, newLocation);
    recalculateDates(workingData.locations);
    recalculateTripMetadata();
    render(legFilter.value, subLegFilter.value, routingToggle.checked);
    closeAddDestinationModal();
    triggerAutosave();
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

  // Transport segment modal functions
  function openTransportEditModal(segmentId) {
    const segment = window.transportSegmentManager.getAllSegments().find(s => s.id === segmentId);
    if (!segment) {
      console.error('Transport segment not found:', segmentId);
      return;
    }

    const modal = document.getElementById('edit-transport-modal');
    const form = document.getElementById('edit-transport-form');

    // Populate form fields
    document.getElementById('transport-route').value = `${segment.from_destination_name} → ${segment.to_destination_name}`;
    document.getElementById('transport-mode').value = segment.transport_mode || 'plane';
    document.getElementById('transport-cost').value = segment.estimated_cost_usd || '';
    document.getElementById('transport-duration').value = segment.duration_hours || '';

    // Researched costs
    document.getElementById('transport-researched-low').value = segment.researched_cost_low || '';
    document.getElementById('transport-researched-mid').value = segment.researched_cost_mid || '';
    document.getElementById('transport-researched-high').value = segment.researched_cost_high || '';

    // Actual cost
    document.getElementById('transport-actual-cost').value = segment.actual_cost_usd || '';

    // Local currency
    document.getElementById('transport-currency-local').value = segment.currency_local || '';
    document.getElementById('transport-amount-local').value = segment.amount_local || '';

    // Research data (AI agent results)
    document.getElementById('transport-researched-duration').value = segment.researched_duration_hours || '';
    document.getElementById('transport-researched-stops').value = segment.researched_stops || '';
    document.getElementById('transport-airlines').value = segment.researched_airlines ? segment.researched_airlines.join(', ') : '';
    document.getElementById('transport-research-notes').value = segment.research_notes || '';
    document.getElementById('transport-research-sources').value = segment.research_sources ? segment.research_sources.join(', ') : '';

    // Alternative routes (full details integrated)
    const alternativesSection = document.getElementById('transport-alternatives-section');
    const alternativesDisplay = document.getElementById('transport-alternatives-display');
    if (segment.researched_alternatives && segment.researched_alternatives.length > 0) {
      alternativesSection.style.display = 'block';

      // Show primary route for comparison
      const primaryInfo = `
        <div style="margin-bottom: 12px; padding: 10px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
          <strong>Primary Route:</strong> ${segment.from_destination_name} → ${segment.to_destination_name}<br>
          <strong>Estimated Cost:</strong> $${segment.researched_cost_mid?.toFixed(0) || segment.estimated_cost_usd?.toFixed(0) || 'N/A'}
        </div>
      `;

      const alternativesHtml = segment.researched_alternatives.map((alt, idx) => {
        const savingsClass = alt.savings_vs_primary > 0 ? 'color: #2e7d32;' : 'color: #d32f2f;';
        const savingsText = alt.savings_vs_primary > 0
          ? `💰 Save $${alt.savings_vs_primary.toFixed(0)}`
          : `💸 Extra $${Math.abs(alt.savings_vs_primary).toFixed(0)}`;

        return `
          <div style="margin-bottom: 12px; padding: 10px; background: white; border: 1px solid #e0e0e0; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 15px;">#${idx + 1}: ${alt.from_location} → ${alt.to_location}</strong>
              <span style="${savingsClass} font-weight: bold;">${savingsText}</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 8px;">
              <div><strong>Cost Range:</strong> $${alt.cost_low?.toFixed(0) || 'N/A'} - $${alt.cost_high?.toFixed(0) || 'N/A'}</div>
              <div><strong>Mid Cost:</strong> $${alt.cost_mid?.toFixed(0) || 'N/A'}</div>
              ${alt.airlines && alt.airlines.length > 0 ? `
                <div style="grid-column: 1 / -1;"><strong>Airlines:</strong> ${alt.airlines.join(', ')}</div>
              ` : ''}
              ${alt.typical_duration_hours ? `
                <div><strong>Duration:</strong> ${alt.typical_duration_hours.toFixed(1)} hrs</div>
              ` : ''}
              ${alt.typical_stops !== undefined ? `
                <div><strong>Stops:</strong> ${alt.typical_stops === 0 ? 'Direct' : alt.typical_stops}</div>
              ` : ''}
              ${alt.distance_from_original_km > 0 ? `
                <div style="grid-column: 1 / -1;"><strong>Distance from original:</strong> ${alt.distance_from_original_km.toFixed(0)} km</div>
              ` : ''}
            </div>

            ${alt.notes ? `
              <div style="font-size: 13px; color: #666; font-style: italic; padding-top: 8px; border-top: 1px solid #f0f0f0;">
                ${alt.notes}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      alternativesDisplay.innerHTML = primaryInfo + alternativesHtml;
    } else {
      alternativesSection.style.display = 'none';
    }

    // Booking details
    document.getElementById('transport-booking-status').value = segment.booking_status || 'estimated';
    document.getElementById('transport-confidence').value = segment.confidence_level || 'low';
    document.getElementById('transport-booking-reference').value = segment.booking_reference || '';
    document.getElementById('transport-booking-link').value = segment.booking_link || '';

    // Notes
    document.getElementById('transport-notes').value = segment.notes || '';
    document.getElementById('edit-transport-segment-id').value = segmentId;

    modal.style.display = 'flex';
  }

  function closeTransportEditModal() {
    document.getElementById('edit-transport-modal').style.display = 'none';
  }

  async function saveTransportSegment(segmentId) {
    const mode = document.getElementById('transport-mode').value;
    const estimatedCost = parseFloat(document.getElementById('transport-cost').value) || 0;
    const duration = parseFloat(document.getElementById('transport-duration').value) || null;

    // Researched costs
    const researchedLow = parseFloat(document.getElementById('transport-researched-low').value) || null;
    const researchedMid = parseFloat(document.getElementById('transport-researched-mid').value) || null;
    const researchedHigh = parseFloat(document.getElementById('transport-researched-high').value) || null;

    // Actual cost
    const actualCost = parseFloat(document.getElementById('transport-actual-cost').value) || null;

    // Local currency
    const currencyLocal = document.getElementById('transport-currency-local').value.toUpperCase() || null;
    const amountLocal = parseFloat(document.getElementById('transport-amount-local').value) || null;

    // Research data (AI agent results)
    const researchedDuration = parseFloat(document.getElementById('transport-researched-duration').value) || null;
    const researchedStops = parseInt(document.getElementById('transport-researched-stops').value) || null;
    const airlinesText = document.getElementById('transport-airlines').value;
    const airlines = airlinesText ? airlinesText.split(',').map(a => a.trim()).filter(a => a) : [];
    const researchNotes = document.getElementById('transport-research-notes').value;
    const sourcesText = document.getElementById('transport-research-sources').value;
    const sources = sourcesText ? sourcesText.split(',').map(s => s.trim()).filter(s => s) : [];

    // Booking details
    const bookingStatus = document.getElementById('transport-booking-status').value;
    const confidenceLevel = document.getElementById('transport-confidence').value;
    const bookingReference = document.getElementById('transport-booking-reference').value;
    const bookingLink = document.getElementById('transport-booking-link').value;

    // Notes
    const notes = document.getElementById('transport-notes').value;

    const updates = {
      transport_mode: mode,
      transport_mode_icon: window.transportSegmentManager.getTransportIcon(mode),
      estimated_cost_usd: estimatedCost,
      researched_cost_low: researchedLow,
      researched_cost_mid: researchedMid,
      researched_cost_high: researchedHigh,
      actual_cost_usd: actualCost,
      currency_local: currencyLocal,
      amount_local: amountLocal,
      duration_hours: duration,
      researched_duration_hours: researchedDuration,
      researched_stops: researchedStops,
      researched_airlines: airlines,
      research_notes: researchNotes,
      research_sources: sources,
      booking_status: bookingStatus,
      confidence_level: confidenceLevel,
      booking_reference: bookingReference,
      booking_link: bookingLink,
      notes: notes
    };

    try {
      await window.transportSegmentManager.updateSegment(segmentId, updates, currentScenarioId);
      console.log('✅ Transport segment updated successfully');
      closeTransportEditModal();

      // Refresh the sidebar to show updated transport segment
      const legName = legFilter ? legFilter.value : 'all';
      const subLegName = subLegFilter ? subLegFilter.value : '';
      const filtered = (subLegName && subLegName !== '')
        ? filterBySubLeg(workingData, legName, subLegName)
        : filterByLeg(workingData, legName);
      updateSidebar(filtered);

      // Trigger save
      await autoSaveScenario();
    } catch (error) {
      console.error('Error updating transport segment:', error);
      alert('Failed to update transport segment. Please try again.');
    }
  }

  async function researchTransportCost(segmentId) {
    const segment = window.transportSegmentManager.getAllSegments().find(s => s.id === segmentId);
    if (!segment) {
      console.error('Transport segment not found:', segmentId);
      return;
    }

    console.log('🔍 Researching transport costs for:', segment);

    // Find the button and show loading state
    const button = document.querySelector(`[data-segment-id="${segmentId}"]`);
    const originalText = button ? button.innerHTML : '';
    if (button) {
      button.innerHTML = '⏳';
      button.disabled = true;
    }

    try {
      // Get session ID
      const sessionId = window.sessionManager?.getSessionId() || 'default';

      // Prepare research request
      const researchRequest = {
        session_id: sessionId,
        segment_id: segmentId,
        from_destination_name: segment.from_destination_name,
        to_destination_name: segment.to_destination_name,
        from_country: segment.from_country || '',
        to_country: segment.to_country || '',
        departure_date: segment.departure_date || ''
      };

      console.log('📤 Sending transport research request:', researchRequest);

      // Call the research API
      const response = await fetch('http://localhost:5001/api/transport/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(researchRequest)
      });

      const result = await response.json();

      if (result.status === 'success' && result.research_result) {
        console.log('✅ Transport research completed:', result.research_result);

        // Save the research results to Firestore
        try {
          const updateResponse = await fetch('http://localhost:5001/api/transport/update-research', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              session_id: sessionId,
              scenario_id: window.currentScenarioId,  // Include scenario_id directly
              segment_id: segmentId,
              research_data: result.research_result
            })
          });

          const updateResult = await updateResponse.json();
          console.log('💾 Segment updated in Firestore:', updateResult);
        } catch (updateError) {
          console.error('Failed to save research to Firestore:', updateError);
        }

        // Show success message with key findings
        const research = result.research_result;
        const costMid = research.cost_mid || 0;
        const airlines = research.airlines?.slice(0, 3).join(', ') || 'various carriers';
        const alternatives = research.alternatives?.length || 0;

        alert(`✅ Research complete! $${costMid.toFixed(0)} estimated (${airlines}). Found ${alternatives} alternative routes.`);

        // The segment will be updated via polling mechanism
        // The frontend polls /api/itinerary/changes every 2 seconds and will pick up the update

      } else {
        console.warn('⚠️ Partial research result:', result);
        alert(`⚠️ Research completed with limited data. Check console for details.`);
      }

    } catch (error) {
      console.error('❌ Error researching transport costs:', error);
      alert(`❌ Failed to research transport costs: ${error.message}`);
    } finally {
      // Restore button state
      if (button) {
        button.innerHTML = originalText || '🤖';
        button.disabled = false;
      }
    }
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
        const loadedData = mergeSubLegsFromTemplate(JSON.parse(JSON.stringify(latestVersion.itineraryData)));
        updateWorkingData(loadedData);
        currentScenarioId = scenarioId;
        window.currentScenarioId = currentScenarioId;
        currentScenarioName = scenario.name;
        render(legFilter.value, subLegFilter.value, routingToggle.checked);
        updateChatContext(legFilter.value, subLegFilter.value);
        closeManageScenariosModal();
        updateScenarioNameDisplay();

        // Save scenario selection to state
        statePersistence.saveScenarioSelection(scenarioId);

        // Switch chat to the new scenario
        if (window.switchChatForScenario) {
          await window.switchChatForScenario(scenarioId);
        }

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

        // Check if dynamic modal exists to determine which refresh to use
        const dynamicModal = document.getElementById('manage-scenarios-modal-dyn');
        if (dynamicModal) {
          await window.showManageScenarios();
        } else {
          await updateScenarioList();
        }

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

  // Bulk cost update modal functions
  const costUpdateWaiters = [];
  let bulkCostSelectedDestinations = new Set();

  function waitForNextCostUpdate(destinationLabel, timeoutMs = 240000) {
    let settled = false;
    let timeoutId;

    const entry = {
      destinationLabel,
      resolve: () => {},
      reject: () => {}
    };

    const promise = new Promise((resolve, reject) => {
      entry.resolve = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      };
      entry.reject = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        reject(error);
      };
    });

    timeoutId = setTimeout(() => {
      const index = costUpdateWaiters.indexOf(entry);
      if (index !== -1) {
        costUpdateWaiters.splice(index, 1);
      }
      entry.reject(new Error(`Timed out waiting for cost refresh${destinationLabel ? ` for ${destinationLabel}` : ''}`));
    }, timeoutMs);

    costUpdateWaiters.push(entry);

    const cancel = (reason) => {
      if (settled) return;
      const index = costUpdateWaiters.indexOf(entry);
      if (index !== -1) {
        costUpdateWaiters.splice(index, 1);
      }
      entry.reject(reason || new Error(`Cancelled waiting for cost refresh${destinationLabel ? ` for ${destinationLabel}` : ''}`));
    };

    const resolve = (result) => {
      if (settled) return;
      const index = costUpdateWaiters.indexOf(entry);
      if (index !== -1) {
        costUpdateWaiters.splice(index, 1);
      }
      entry.resolve(result);
    };

    return { promise, cancel, resolve };
  }

  function resolveNextCostUpdateWaiter(result) {
    if (!costUpdateWaiters.length) {
      return;
    }
    const waiter = costUpdateWaiters.shift();
    if (waiter) {
      waiter.resolve(result);
    }
  }

  const BULK_STATUS_CLASSES = ['queued', 'requesting', 'waiting', 'complete', 'failed', 'cancelled'];
  const BULK_STATUS_DEFAULT_MESSAGES = {
    queued: 'Queued for update',
    requesting: 'Sending update request to AI...',
    waiting: 'Waiting for AI cost update and summary...',
    complete: '✓ Costs and summary refreshed',
    failed: '⚠️ Update failed',
    cancelled: 'Update cancelled'
  };

  function setBulkDestinationStatus(item, status, message) {
    if (!item) return;

    BULK_STATUS_CLASSES.forEach(cls => item.classList.remove(`status-${cls}`));

    if (status) {
      item.classList.add(`status-${status}`);
      item.dataset.status = status;
    } else {
      delete item.dataset.status;
    }

    const statusEl = item.querySelector('[data-progress-status]');
    if (statusEl) {
      const label = message ?? (status ? BULK_STATUS_DEFAULT_MESSAGES[status] : '');
      statusEl.textContent = label || '';
      statusEl.dataset.state = status || '';
    }
  }

  function openBulkCostUpdateModal() {
    const modal = document.getElementById('bulk-cost-update-modal');
    const listContainer = document.getElementById('bulk-destination-list');
    const countDisplay = document.getElementById('bulk-selection-count');
    const confirmBtn = document.getElementById('confirm-bulk-update-btn');

    // Get currently filtered destinations
    const legName = legFilter.value;
    const subLegName = subLegFilter.value || '';
    const filtered = (subLegName && subLegName !== '')
      ? filterBySubLeg(workingData, legName, subLegName)
      : filterByLeg(workingData, legName);

    if (filtered.length === 0) {
      alert('No destinations to update. Please adjust your filters.');
      return;
    }

    // Reset selection state
    bulkCostSelectedDestinations.clear();

    // Get costs data to determine status
    const costs = workingData.costs || [];

    // Populate destination list
    listContainer.innerHTML = filtered.map((dest, idx) => {
      const destCosts = costs.filter(c => idsEqual(c.destination_id, dest.id));
      const hasCosts = destCosts.length > 0;
      const statusClass = hasCosts ? 'has-costs' : 'no-costs';
      const statusText = hasCosts ? '✓ Has costs' : '✗ No costs';
      const duration = dest.duration_days || 1;
      const destinationId = dest.id || dest.destination_id || dest.destinationId || '';

      return `
        <div class="bulk-destination-item" data-destination-index="${idx}" ${destinationId ? `data-destination-id="${destinationId}"` : ''}>
          <input type="checkbox" class="bulk-destination-checkbox" data-destination-index="${idx}">
          <div class="bulk-destination-info">
            <div class="bulk-destination-name">${dest.name || dest.city || 'Unknown'}</div>
            <div class="bulk-destination-meta">
              <span>${duration} day${duration !== 1 ? 's' : ''}</span>
              <span class="bulk-destination-status ${statusClass}">${statusText}</span>
            </div>
            <div class="bulk-destination-progress-status" data-progress-status></div>
          </div>
        </div>
      `;
    }).join('');

    // Update count display
    countDisplay.textContent = `0 of ${filtered.length} destinations selected`;
    confirmBtn.disabled = true;

    // Add event listeners for checkboxes and items
    listContainer.querySelectorAll('.bulk-destination-item').forEach((item, idx) => {
      const checkbox = item.querySelector('.bulk-destination-checkbox');

      // Click on item toggles checkbox
      item.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      });

      // Checkbox change updates selection
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          bulkCostSelectedDestinations.add(idx);
          item.classList.add('selected');
        } else {
          bulkCostSelectedDestinations.delete(idx);
          item.classList.remove('selected');
        }

        // Update count and button state
        countDisplay.textContent = `${bulkCostSelectedDestinations.size} of ${filtered.length} destinations selected`;
        confirmBtn.disabled = bulkCostSelectedDestinations.size === 0;
      });
    });

    modal.style.display = 'flex';
  }

  function closeBulkCostUpdateModal() {
    const modal = document.getElementById('bulk-cost-update-modal');
    const progressSection = document.getElementById('bulk-progress');
    const listContainer = document.getElementById('bulk-destination-list');
    const cancelBtn = document.getElementById('cancel-bulk-update-btn');

    modal.style.display = 'none';
    progressSection.style.display = 'none';
    listContainer.style.display = 'block';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.disabled = false;
    bulkCostSelectedDestinations.clear();
  }

  async function requestBulkCostUpdate() {
    if (bulkCostSelectedDestinations.size === 0) return;

    const confirmBtn = document.getElementById('confirm-bulk-update-btn');
    const cancelBtn = document.getElementById('cancel-bulk-update-btn');
    const progressSection = document.getElementById('bulk-progress');
    const progressFill = document.getElementById('bulk-progress-fill');
    const progressText = document.getElementById('bulk-progress-text');
    const listContainer = document.getElementById('bulk-destination-list');
    const countDisplay = document.getElementById('bulk-selection-count');

    // Get filtered destinations
    const legName = legFilter.value;
    const subLegName = subLegFilter.value || '';
    const filtered = (subLegName && subLegName !== '')
      ? filterBySubLeg(workingData, legName, subLegName)
      : filterByLeg(workingData, legName);

    // Get selected destinations
    const selectedEntries = Array.from(bulkCostSelectedDestinations)
      .map(idx => ({ idx, destination: filtered[idx] }))
      .filter(entry => entry.destination);

    if (selectedEntries.length === 0) return;

    // Disable controls and show progress UI
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    progressSection.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = `Starting bulk update for ${selectedEntries.length} destinations...`;
    if (countDisplay) {
      countDisplay.textContent = '';
    }

    // Disable all checkboxes to lock selection during processing
    listContainer.querySelectorAll('.bulk-destination-checkbox').forEach(cb => {
      cb.disabled = true;
    });

    // Mark selected destinations as queued
    selectedEntries.forEach(({ idx }) => {
      const item = listContainer.querySelector(`.bulk-destination-item[data-destination-index="${idx}"]`);
      if (item) {
        item.classList.add('processing');
        setBulkDestinationStatus(item, 'queued');
      }
    });

    let completed = 0;
    let failed = 0;
    const total = selectedEntries.length;

    // Process each destination sequentially, waiting for cost + summary refresh before continuing
    for (let i = 0; i < total; i++) {
      const { idx, destination } = selectedEntries[i];
      if (!destination) continue;

      const item = listContainer.querySelector(`.bulk-destination-item[data-destination-index="${idx}"]`);
      const destinationLabel = destination.name || destination.city || destination.id || `Destination ${i + 1}`;
      const progressPrefix = `(${i + 1}/${total})`;

      if (item) {
        setBulkDestinationStatus(item, 'requesting', `${progressPrefix} sending update request...`);
      }
      progressText.textContent = `Requesting cost update ${progressPrefix} for ${destinationLabel}`;

      let waitEntry;
      try {
        waitEntry = waitForNextCostUpdate(destinationLabel);
        const dispatchResult = await requestCostUpdateFromAgent(destination, null, legName, subLegName, { waitEntry });
        const dispatchOk = dispatchResult && dispatchResult.ok !== false;

        if (!dispatchOk) {
          failed++;
          const dispatchError =
            (dispatchResult && dispatchResult.error) ||
            new Error('Cost research request was not dispatched');
          waitEntry.cancel(dispatchError);
          // Swallow the rejection since we intentionally cancelled the waiter
          waitEntry.promise.catch(() => {});
          if (item) {
            const failureMessage =
              typeof dispatchError === 'string'
                ? dispatchError
                : dispatchError?.message || 'Unable to send request. Please ensure the scenario is loaded.';
            setBulkDestinationStatus(item, 'failed', failureMessage);
          }
          progressText.textContent = `Skipped ${destinationLabel} — request could not be sent`;
          continue;
        }

        if (item) {
          setBulkDestinationStatus(item, 'waiting', `${progressPrefix} waiting for AI cost update...`);
        }
        progressText.textContent = `Waiting for AI to finish ${progressPrefix} ${destinationLabel}`;

        const result = await waitEntry.promise;

        if (result?.costRefreshSucceeded && result?.summarySucceeded) {
          completed++;
          if (item) {
            setBulkDestinationStatus(item, 'complete');
          }
          progressText.textContent = `Finished ${progressPrefix} ${destinationLabel}`;
        } else {
          failed++;
          if (item) {
            if (result?.partial) {
              const note = result.partialMessage || 'AI returned narrative details but no structured pricing.';
              setBulkDestinationStatus(item, 'failed', note);
            } else if (!result?.costRefreshSucceeded) {
              setBulkDestinationStatus(item, 'failed', 'AI did not refresh costs. Ensure the scenario is saved.');
            } else if (!result?.summarySucceeded) {
              const errText = result.summaryError?.message || result.summaryError || 'Summary refresh failed.';
              setBulkDestinationStatus(item, 'failed', `Summary failed: ${errText}`);
            } else {
              setBulkDestinationStatus(item, 'failed', 'Unknown issue completing update.');
            }
          }
          if (result?.partial) {
            progressText.textContent = `AI returned narrative-only results for ${destinationLabel}. Review notes and retry if needed.`;
          } else {
            progressText.textContent = `Issue updating ${destinationLabel}. Review status for details.`;
          }
        }
      } catch (error) {
        failed++;
        const errMsg = error?.message || error;
        if (item) {
          setBulkDestinationStatus(item, 'failed', `Error: ${errMsg}`);
        }
        if (waitEntry) {
          waitEntry.cancel(error);
        }
        console.error(`Error updating costs for ${destinationLabel}:`, error);
        progressText.textContent = `Error updating ${destinationLabel}: ${errMsg}`;
      }

      const processed = completed + failed;
      const percent = Math.round((processed / total) * 100);
      progressFill.style.width = `${percent}%`;

      // Count display intentionally left blank during processing (progress bar communicates status)
    }

    // Complete
    cancelBtn.disabled = false;
    cancelBtn.textContent = 'Close';
    listContainer.querySelectorAll('.bulk-destination-checkbox').forEach(cb => {
      cb.disabled = false;
    });
    confirmBtn.disabled = bulkCostSelectedDestinations.size === 0;

    if (failed === 0) {
      progressFill.style.width = '100%';
      progressText.textContent = `All ${completed} destinations updated successfully.`;
    } else if (completed === 0) {
      progressText.textContent = `All ${failed} destinations failed. Review the statuses above and retry if needed.`;
    } else {
      progressText.textContent = `Updated ${completed} destinations. ${failed} destination${failed === 1 ? '' : 's'} had issues — review statuses above.`;
    }
  }

  window.updateSidebarHighlight = updateSidebarHighlight;

  const routingToggle = document.getElementById('routing-toggle');

  // Initialize routing toggle state (default: false/unchecked)
  const savedRoutingToggle = localStorage.getItem('rtw-routing-toggle');
  if (savedRoutingToggle !== null) {
    routingToggle.checked = savedRoutingToggle === 'true';
  } else {
    routingToggle.checked = false;
    localStorage.setItem('rtw-routing-toggle', 'false');
  }

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
  routingToggle.addEventListener('change', (e) => {
    // Save routing toggle state
    localStorage.setItem('rtw-routing-toggle', e.target.checked.toString());
    updateMap();
  });

  // Country view toggle
  const countryViewToggle = document.getElementById('country-view-toggle');
  if (countryViewToggle) {
    countryViewToggle.addEventListener('change', function(e) {
      if (e.target.checked) {
        // Show country rollup view
        renderCountryRollupView(workingData);
      } else {
        // Show regular destination view
        updateMap();
      }
    });
  }
  
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
          updateWorkingData(JSON.parse(JSON.stringify(emptyData)));
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

  // Add destination quick button
  document.getElementById('add-destination-bar-btn').addEventListener('click', () => {
    openAddDestinationModal(null); // null means auto-calculate insertion point
  });

  // Manage Costs & Budget button - navigates to unified cost manager
  document.getElementById('manage-costs-budget-btn').addEventListener('click', () => {
    const scenarioActionsDropdown = document.getElementById('scenario-actions-dropdown');
    const scenarioActionsBtn = document.getElementById('scenario-actions-btn');
    scenarioActionsDropdown.style.display = 'none';
    scenarioActionsBtn.classList.remove('active');

    if (!currentScenarioId) {
      alert('Please save or load a scenario first');
      return;
    }

    // Navigate to unified cost & budget manager page
    window.location.href = `./cost-manager.html?scenario=${currentScenarioId}`;
  });

  // Bulk cost update modal event listeners
  document.getElementById('select-all-destinations-btn').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.bulk-destination-checkbox');
    checkboxes.forEach(cb => {
      if (!cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event('change'));
      }
    });
  });

  document.getElementById('deselect-all-destinations-btn').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.bulk-destination-checkbox');
    checkboxes.forEach(cb => {
      if (cb.checked) {
        cb.checked = false;
        cb.dispatchEvent(new Event('change'));
      }
    });
  });

  document.getElementById('cancel-bulk-update-btn').addEventListener('click', closeBulkCostUpdateModal);

  document.getElementById('confirm-bulk-update-btn').addEventListener('click', requestBulkCostUpdate);

  // Close bulk cost modal when clicking outside
  document.getElementById('bulk-cost-update-modal').addEventListener('click', (e) => {
    if (e.target.id === 'bulk-cost-update-modal') {
      closeBulkCostUpdateModal();
    }
  });

  document.getElementById('data-integrity-btn').addEventListener('click', () => {
    const scenarioActionsDropdown = document.getElementById('scenario-actions-dropdown');
    const scenarioActionsBtn = document.getElementById('scenario-actions-btn');
    if (scenarioActionsDropdown) scenarioActionsDropdown.style.display = 'none';
    if (scenarioActionsBtn) scenarioActionsBtn.classList.remove('active');

    showDataIntegrityPanel(workingData, handleDataUpdate);
  });

  document.getElementById('geo-validation-btn').addEventListener('click', async () => {
    const scenarioActionsDropdown = document.getElementById('scenario-actions-dropdown');
    const scenarioActionsBtn = document.getElementById('scenario-actions-btn');
    if (scenarioActionsDropdown) scenarioActionsDropdown.style.display = 'none';
    if (scenarioActionsBtn) scenarioActionsBtn.classList.remove('active');

    // Create save callback that saves to Firestore
    const saveToFirestore = async () => {
      if (!currentScenarioId) {
        throw new Error('No scenario ID - cannot save');
      }
      await scenarioManager.saveVersion(currentScenarioId, workingData, false);
      console.log('✅ Geographic data saved to Firestore');
    };

    await showGeographicValidationPanel(workingData, handleDataUpdate, saveToFirestore);
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

  // Toggle map visibility
  const mapVisibilityToggle = document.getElementById('map-visibility-toggle');
  if (mapVisibilityToggle) {
    mapVisibilityToggle.addEventListener('change', (e) => {
      const mainContent = document.querySelector('.main-content');
      const sidebar = document.querySelector('.sidebar');
      const isChecked = e.target.checked;

      if (isChecked) {
        // Show map - restore saved sidebar width
        mainContent.classList.remove('map-hidden');
        localStorage.setItem('rtw-map-visible', 'true');

        const savedWidth = localStorage.getItem('sidebarWidth');
        if (savedWidth) {
          sidebar.style.width = savedWidth;
        } else {
          sidebar.style.width = '';
        }
      } else {
        // Hide map - remove inline width to allow CSS to take over
        mainContent.classList.add('map-hidden');
        localStorage.setItem('rtw-map-visible', 'false');

        // Clear inline width style so CSS width: 100% takes effect
        sidebar.style.width = '';
      }
    });
  }

  // Toggle education features visibility
  const educationVisibilityToggle = document.getElementById('education-visibility-toggle');
  if (educationVisibilityToggle) {
    educationVisibilityToggle.addEventListener('change', (e) => {
      const body = document.body;
      const isChecked = e.target.checked;

      if (isChecked) {
        body.classList.remove('education-hidden');
        localStorage.setItem('rtw-education-visible', 'true');
      } else {
        body.classList.add('education-hidden');
        localStorage.setItem('rtw-education-visible', 'false');
      }
    });
  }

  // Update itinerary data and cost summary when costs change
  window.addEventListener('costs-updated', async () => {
    console.log('🔄 costs-updated event received, refreshing costs...');
    const waiterResult = {
      costRefreshSucceeded: false,
      summarySucceeded: false,
      summaryError: null,
      refreshError: null,
      freshCostsCount: 0
    };

    try {
      // Always use scenario ID (costs are stored per scenario, not per chat session)
      if (currentScenarioId) {
        console.log(`📡 Fetching costs for scenario: ${currentScenarioId}`);
        const freshCosts = await costUI.fetchCosts({ session_id: currentScenarioId });
        console.log(`📦 Received ${freshCosts?.length || 0} costs from backend`);

        if (freshCosts && Array.isArray(freshCosts)) {
          workingData.costs = freshCosts;
          waiterResult.costRefreshSucceeded = true;
          waiterResult.freshCostsCount = freshCosts.length;
          console.log(`✅ Updated workingData.costs with ${freshCosts.length} costs`);
          console.log(`💰 Cost IDs:`, freshCosts.map(c => `${c.id}: ${c.amount_usd} for ${c.destination_id}`));

          // Re-render the sidebar AND header summary with fresh cost data
          const legName = legFilter.value || 'all';
          const subLegName = (subLegFilter.value && subLegFilter.value !== '') ? subLegFilter.value : null;

          // Call render to update both sidebar and header summary
          // triggerAutoSave=false to avoid unnecessary saves
          render(legName, subLegName, false, false);

          try {
            await updateCostSummary();
            waiterResult.summarySucceeded = true;
          } catch (summaryError) {
            waiterResult.summaryError = summaryError;
            console.error('❌ Error updating cost summary after refresh:', summaryError);
          }
        } else {
          console.warn('⚠️ No costs returned or invalid format');
        }
      } else {
        console.warn('⚠️ No currentScenarioId, skipping cost refresh');
        waiterResult.refreshError = new Error('No current scenario ID available');
      }
    } catch (error) {
      waiterResult.refreshError = error;
      if (!waiterResult.summaryError) {
        waiterResult.summaryError = error;
      }
      console.error('❌ Error refreshing costs after update:', error);
    } finally {
      resolveNextCostUpdateWaiter(waiterResult);
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

  // Summary generation button - shows options modal
  document.getElementById('generate-summary-btn').addEventListener('click', async () => {
    // Check if we have locations
    if (!workingData.locations || workingData.locations.length === 0) {
      alert('No locations in itinerary to generate summary');
      return;
    }

    try {
      // Use default options (all sections enabled, costs hidden by default)
      const options = {
        showCosts: false,
        includeExecutive: true,
        includeDetailed: true,
        includeFinancial: true,
        includeTimeline: true,
        includeDestinations: true,
        detailLevel: 'full',
        groupBy: 'country'
      };

      // Build itinerary data from current state
      const itineraryData = {
        trip: workingData.trip || {},
        locations: workingData.locations || [],
        legs: workingData.legs || [],
        costs: workingData.costs || [],
        countryNotes: workingData.countryNotes || {}
      };

      // Build scenario metadata
      let scenarioMetadata = null;
      if (currentScenarioId) {
        try {
          const scenario = await scenarioManager.getScenario(currentScenarioId);
          if (scenario) {
            scenarioMetadata = {
              name: scenario.name,
              version: scenario.currentVersion,
              updatedAt: scenario.updatedAt?.toDate?.()?.toISOString() || scenario.updatedAt
            };
          }
        } catch (error) {
          console.error('Error fetching scenario metadata:', error);
        }
      }

      // Generate and view summary with options
      await summaryManager.generateAndView(itineraryData, currentScenarioId, options, scenarioMetadata);

      // Update view summary button state after generation
      await updateViewSummaryButtonState();
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Failed to generate summary: ' + error.message);
    }
  });

  // View saved summary button (in scenario actions dropdown)
  document.getElementById('student-dashboard-btn').addEventListener('click', () => {
    const studentId = localStorage.getItem('current_student_id');
    if (studentId) {
      window.open(`/student-dashboard.html?student_id=${studentId}`, '_blank');
    } else {
      // No student selected, let the dashboard pick the first one
      window.open(`/student-dashboard.html`, '_blank');
    }
  });

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
  document.getElementById('cancel-edit-transport-btn').addEventListener('click', closeTransportEditModal);

  // Broad search button handler (uses Text Search + Geocoding for broader coverage)
  document.getElementById('broad-search-btn').addEventListener('click', async () => {
    const searchInput = document.getElementById('location-search');
    const query = searchInput.value.trim();

    if (!query) {
      alert('Please enter a location to search for.');
      return;
    }

    const btn = document.getElementById('broad-search-btn');
    const originalText = btn.textContent;
    btn.textContent = '🔍 Searching...';
    btn.disabled = true;

    try {
      console.log(`🔍 Broad search for: "${query}"`);
      const result = await searchLocationBroadly(query);

      if (result) {
        console.log(`✅ Found via ${result.source}:`, result);

        // Store in hidden input (same format as autocomplete)
        document.getElementById('selected-place').value = JSON.stringify({
          place_id: result.place_id,
          name: result.name,
          formatted_address: result.formatted_address,
          location: result.location,
          address_components: result.address_components,
          data_source: result.source  // Track where it came from
        });

        // Show source indicator
        const indicator = document.getElementById('search-source-indicator');
        const icon = document.getElementById('search-source-icon');
        const text = document.getElementById('search-source-text');

        if (result.source === 'text_search') {
          icon.textContent = '🗺️ ';
          text.textContent = `Found: ${result.name} (via Google Places Text Search)`;
        } else if (result.source === 'geocoding') {
          icon.textContent = '📍 ';
          text.textContent = `Found: ${result.name} (via Google Geocoding)`;
        }

        indicator.style.display = 'block';
        indicator.style.color = '#2e7d32';

      } else {
        console.log(`❌ No results found for "${query}"`);
        alert(`Could not find "${query}". Try:\n• Being more specific (e.g., "Drake Passage, Antarctica")\n• Using different keywords\n• Checking spelling`);

        // Clear previous selection and indicator
        document.getElementById('selected-place').value = '';
        document.getElementById('search-source-indicator').style.display = 'none';
      }

    } catch (error) {
      console.error('Broad search error:', error);
      alert(`Search error: ${error.message}`);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });

  // Close transport modal on overlay click
  document.getElementById('edit-transport-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-transport-modal') {
      closeTransportEditModal();
    }
  });

  // Form submissions
  document.getElementById('add-destination-form').addEventListener('submit', async (e) => {
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

      await addNewDestination(insertIndex, placeData, duration);
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

  document.getElementById('edit-transport-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const segmentId = document.getElementById('edit-transport-segment-id').value;
    if (segmentId) {
      await saveTransportSegment(segmentId);
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

    reader.onload = async (e) => {
      try {
        const success = await scenarioManager.importScenarios(e.target.result, overwrite);
        if (success) {
          closeImportScenariosModal();

          // Reload the imported scenario
          if (scenarioManager.currentScenarioId) {
            await window.loadScenarioById(scenarioManager.currentScenarioId);
          }

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

  async function handleItineraryChanges(changes) {
    // ⚠️ CRITICAL NOTE: This function is called as a workaround for non-deterministic AI behavior.
    // Even when the AI chat claims it cannot access the itinerary, the backend may still
    // process and apply changes that are detected via polling. This function ensures those
    // changes are applied to the UI regardless of the AI's response message.
    console.log('🚨 !!! ITINERARY CHANGES DETECTED !!!');
    console.log('🚨 !!! This might be causing the app reset !!!');
    console.log('🔧 handleItineraryChanges called with:', changes);
    console.log('📍 Current workingData.locations count:', workingData.locations?.length || 0);
    console.trace('🚨 Stack trace for handleItineraryChanges call:');

    // Process all changes, waiting for async ones
    for (const change of changes) {
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
        case 'transport_segment_updated':
          await handleTransportSegmentUpdated(change.segment_id);
          break;
        default:
          console.warn('⚠️ Unknown change type:', change.type);
          break;
      }
    }

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

  async function handleTransportSegmentUpdated(segmentId) {
    console.log(`🚌 Transport segment updated: ${segmentId}`);

    // Reload the transport segments from Firestore
    try {
      if (!window.transportSegmentManager) {
        console.error('Transport segment manager not available');
        return;
      }

      // Reload segments from Firestore - this will sync with the latest data
      await window.transportSegmentManager.loadSegments(window.currentScenarioId);
      console.log(`✅ Reloaded transport segments from Firestore`);

      // Find the updated segment and log it
      const updatedSegment = window.transportSegmentManager.getAllSegments().find(s => s.id === segmentId);
      if (updatedSegment) {
        console.log(`✨ Updated segment details:`, {
          id: updatedSegment.id,
          from: updatedSegment.from_name,
          to: updatedSegment.to_name,
          booking_status: updatedSegment.booking_status,
          cost_mid: updatedSegment.researched_cost_mid,
          airlines: updatedSegment.researched_airlines?.length || 0,
          alternatives: updatedSegment.researched_alternatives?.length || 0
        });
      } else {
        console.warn(`⚠️ Segment ${segmentId} not found after reload`);
      }
    } catch (error) {
      console.error('Error reloading transport segment:', error);
    }
  }

  // Initialize AI Travel Concierge Chat
  let chatInstance = null;
  if (window.TravelConciergeChat) {
    chatInstance = new window.TravelConciergeChat(handleItineraryChanges);
    
    // Hook into scenario switching events
    window.switchChatForScenario = async function(scenarioId) {
      if (!chatInstance || !scenarioId) return;
      console.log('🔄 App switching chat to scenario:', scenarioId);
      try {
        await chatInstance.switchToScenario(scenarioId);
        
        // Update scenario name display
        const scenario = await scenarioManager.getScenario(scenarioId);
        if (scenario) {
          currentScenarioName = scenario.name;
          updateScenarioNameDisplay();
        }
      } catch (error) {
        console.error('Error switching chat for scenario:', error);
      }
    };
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

  // Check for geographic data issues and show warning banner if needed
  if (hasGeographicDataIssues(workingData)) {
    showValidationWarningBanner(workingData, async () => {
      // Create save callback that saves to Firestore
      const saveToFirestore = async () => {
        if (!currentScenarioId) {
          throw new Error('No scenario ID - cannot save');
        }
        await scenarioManager.saveVersion(currentScenarioId, workingData, false);
        console.log('✅ Geographic data saved to Firestore');
      };

      await showGeographicValidationPanel(workingData, handleDataUpdate, saveToFirestore);
    });
  }

  // Initialize view summary button state
  updateViewSummaryButtonState();

  // Expose debug functions globally
  window.debugRTW = {
    getLegs: () => getLegsForData(workingData, { useDynamic: true }),
    getStoredLegs: () => workingData.legs, // Access original stored legs
    getLocations: () => workingData.locations,
    findLocation: (name) => workingData.locations.find(l => l.name.toLowerCase().includes(name.toLowerCase())),
    showLegStructure: () => {
      const legs = getLegsForData(workingData, { useDynamic: true });
      console.log('=== DYNAMIC LEG STRUCTURE ===');
      legs.forEach(leg => {
        console.log(`\n📍 Leg: "${leg.name}"`);
        console.log(`   Regions:`, leg.regions);
        if (leg.sub_legs?.length > 0) {
          console.log(`   Sub-legs:`);
          leg.sub_legs.forEach(sl => {
            console.log(`      - "${sl.name}": ${sl.countries?.length || 0} countries`, sl.countries);
          });
        }
      });
    },
    showDynamicLegs: () => {
      const { legs, stats } = generateDynamicLegs(workingData);
      console.log(getLegSummary(legs));
      console.log('Stats:', stats);
    },
    showLocation: (name) => {
      const loc = workingData.locations.find(l => l.name.toLowerCase().includes(name.toLowerCase()));
      if (loc) {
        console.log('=== LOCATION DATA ===');
        console.log('Name:', loc.name);
        console.log('Country:', loc.country);
        console.log('Region:', loc.region);
        console.log('City:', loc.city);
        console.log('Country Code:', loc.country_code);
        console.log('Continent:', loc.continent);
        console.log('Full data:', loc);
      } else {
        console.log('Location not found:', name);
      }
    }
  };

  // Initialize education UI
  initializeEducationUI(currentScenarioId, currentScenarioName);

  // Restore view preferences from localStorage
  const mapVisible = localStorage.getItem('rtw-map-visible');
  const educationVisible = localStorage.getItem('rtw-education-visible');

  // Map visibility (default: true/shown)
  if (mapVisible === null) {
    localStorage.setItem('rtw-map-visible', 'true');
  } else if (mapVisible === 'false') {
    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.getElementById('map-visibility-toggle');
    mainContent.classList.add('map-hidden');
    // Clear inline width so CSS can take over
    sidebar.style.width = '';
    if (toggle) toggle.checked = false;
  }

  // Education visibility (default: false/hidden)
  if (educationVisible === null) {
    localStorage.setItem('rtw-education-visible', 'false');
    const body = document.body;
    const toggle = document.getElementById('education-visibility-toggle');
    body.classList.add('education-hidden');
    if (toggle) toggle.checked = false;
  } else if (educationVisible === 'false') {
    const body = document.body;
    const toggle = document.getElementById('education-visibility-toggle');
    body.classList.add('education-hidden');
    if (toggle) toggle.checked = false;
  }

  console.log('✅ App initialized with state:', {
    scenarioId: currentScenarioId,
    scenarioName: currentScenarioName,
    leg: initialLeg,
    subLeg: initialSubLeg
  });
}
