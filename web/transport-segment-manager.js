/**
 * Transport Segment Manager
 * Manages inter-destination transport segments with costs, booking status, and research
 */

class TransportSegmentManager {
  constructor() {
    this.segments = [];
    this.apiBaseUrl = window.RTW_CONFIG?.apiBaseUrl || '';
  }

  /**
   * Load transport segments from API
   */
  async loadSegments(scenarioId) {
    try {
      const url = `${this.apiBaseUrl}/api/transport-segments?scenario_id=${scenarioId}`;
      console.log(`🔄 TransportSegmentManager: Loading segments from ${url}`);

      const response = await fetch(url);
      console.log(`📡 TransportSegmentManager: Response received, status: ${response.status}`);

      const data = await response.json();
      console.log(`✅ TransportSegmentManager: Parsed JSON, found ${data.transport_segments?.length || 0} segments`);

      this.segments = data.transport_segments || [];
      return this.segments;
    } catch (error) {
      console.error('❌ TransportSegmentManager: Error loading transport segments:', error);
      return [];
    }
  }

  /**
   * Sync transport segments based on current location order
   */
  async syncSegments(scenarioId, locations) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/transport-segments/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenarioId })
      });
      const data = await response.json();

      if (data.status === 'success') {
        this.segments = data.transport_segments || [];
        console.log(`✅ Synced transport segments: ${data.created} created, ${data.kept} kept, ${data.removed} removed`);

        // Calculate distance and costs for new segments
        await this.calculateSegmentDetails(locations);
      }

      return data;
    } catch (error) {
      console.error('Error syncing transport segments:', error);
      throw error;
    }
  }

  /**
   * Calculate distance and estimated costs for segments
   */
  async calculateSegmentDetails(locations) {
    if (!google?.maps?.geometry?.spherical) {
      console.warn('Google Maps not loaded, skipping segment calculations');
      return;
    }

    const locationMap = {};
    locations.forEach(loc => {
      locationMap[loc.id] = loc;
    });

    for (const segment of this.segments) {
      const fromLoc = locationMap[segment.from_destination_id];
      const toLoc = locationMap[segment.to_destination_id];

      if (!fromLoc || !toLoc) continue;

      const fromLL = this.toLatLng(fromLoc);
      const toLL = this.toLatLng(toLoc);

      if (fromLL && toLL) {
        // Calculate distance
        const distanceMeters = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(fromLL.lat, fromLL.lng),
          new google.maps.LatLng(toLL.lat, toLL.lng)
        );
        segment.distance_km = distanceMeters / 1000;

        // Determine transport mode if not set
        if (!segment.transport_mode || segment.transport_mode === 'plane') {
          segment.transport_mode = this.getTransportMode(fromLoc, toLoc, segment.distance_km);
          segment.transport_mode_icon = this.getTransportIcon(segment.transport_mode);
        }

        // Estimate cost if not researched
        if (!segment.researched_cost_mid && segment.estimated_cost_usd === 0) {
          segment.estimated_cost_usd = this.estimateCost(
            fromLoc,
            toLoc,
            segment.transport_mode,
            segment.distance_km,
            segment.num_travelers || 3
          );
        }
      }
    }
  }

  /**
   * Update a transport segment
   */
  async updateSegment(segmentId, updates, scenarioId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/transport-segments/${segmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, scenario_id: scenarioId })
      });
      const data = await response.json();

      if (data.status === 'success') {
        // Update local segment
        const index = this.segments.findIndex(s => s.id === segmentId);
        if (index !== -1) {
          this.segments[index] = data.segment;
        }
      }

      return data;
    } catch (error) {
      console.error('Error updating transport segment:', error);
      throw error;
    }
  }

  /**
   * Get segment between two destinations
   */
  getSegment(fromId, toId) {
    return this.segments.find(s =>
      s.from_destination_id === fromId && s.to_destination_id === toId
    );
  }

  /**
   * Get all segments
   */
  getAllSegments() {
    return this.segments;
  }

  /**
   * Get active cost for a segment (actual > researched > estimated)
   */
  getActiveCost(segment) {
    if (segment.actual_cost_usd && segment.actual_cost_usd > 0) {
      return segment.actual_cost_usd;
    }
    if (segment.researched_cost_mid && segment.researched_cost_mid > 0) {
      return segment.researched_cost_mid;
    }
    return segment.estimated_cost_usd || 0;
  }

  /**
   * Calculate total transport costs
   */
  getTotalCost() {
    return this.segments.reduce((total, segment) => {
      return total + this.getActiveCost(segment);
    }, 0);
  }

  /**
   * Get transport mode based on distance and geography
   */
  getTransportMode(fromLoc, toLoc, distanceKm) {
    // Check if there's an explicit transport mode
    if (toLoc.transport_from_previous) {
      return toLoc.transport_from_previous;
    }

    // Auto-detect based on distance
    if (distanceKm > 1000) {
      return 'plane';
    } else if (distanceKm > 500) {
      return fromLoc.country === toLoc.country ? 'train' : 'plane';
    } else if (distanceKm > 100) {
      return 'train';
    } else if (distanceKm > 20) {
      return 'car';
    } else {
      return 'walking';
    }
  }

  /**
   * Get icon for transport mode
   */
  getTransportIcon(mode) {
    const icons = {
      'plane': '✈️',
      'train': '🚂',
      'car': '🚗',
      'bus': '🚌',
      'ferry': '🚢',
      'walking': '🚶',
      'other': '🚗'
    };
    return icons[mode] || '✈️';
  }

  /**
   * Estimate cost based on transport mode and distance
   */
  estimateCost(fromLoc, toLoc, mode, distanceKm, numTravelers = 3) {
    // Check for known flight costs first
    const fromCode = this.getAirportCode(fromLoc);
    const toCode = this.getAirportCode(toLoc);
    const routeKey = `${fromCode}-${toCode}`;

    const knownFlightCosts = this.getKnownFlightCosts();
    if (knownFlightCosts[routeKey]) {
      return knownFlightCosts[routeKey] * numTravelers;
    }

    // Estimate based on mode and distance
    let costPerPerson = 0;

    switch (mode) {
      case 'plane':
        if (distanceKm > 8000) costPerPerson = 1200; // Long haul
        else if (distanceKm > 3000) costPerPerson = 600; // Medium haul
        else if (distanceKm > 1000) costPerPerson = 300; // Regional
        else costPerPerson = 150; // Domestic short
        break;
      case 'train':
        costPerPerson = Math.max(50, distanceKm * 0.15);
        break;
      case 'bus':
        costPerPerson = Math.max(20, distanceKm * 0.08);
        break;
      case 'car':
        costPerPerson = Math.max(30, distanceKm * 0.12);
        break;
      case 'ferry':
        costPerPerson = Math.max(25, distanceKm * 0.20);
        break;
      case 'walking':
        costPerPerson = 0;
        break;
      default:
        costPerPerson = 100;
    }

    return Math.round(costPerPerson * numTravelers);
  }

  /**
   * Get airport code for location
   */
  getAirportCode(location) {
    const airportCodes = {
      'San Francisco': 'SFO', 'Denpasar': 'DPS', 'Bali': 'DPS',
      'Sorong': 'SOQ', 'Raja Ampat': 'SOQ', 'Koror': 'ROR', 'Palau': 'ROR',
      'Manila': 'MNL', 'Singapore': 'SIN', 'Kuala Lumpur': 'KUL',
      'Kota Kinabalu': 'BKI', 'Taipei': 'TPE', 'Tokyo': 'NRT',
      'Seoul': 'ICN', 'Beijing': 'PEK', 'Kathmandu': 'KTM',
      'Paro': 'PBH', 'Copenhagen': 'CPH', 'Stockholm': 'ARN',
      'Tromsø': 'TOS', 'Reykjavik': 'KEF', 'Amsterdam': 'AMS',
      'Kilimanjaro': 'JRO', 'Kigali': 'KGL', 'Rio de Janeiro': 'GIG',
      'Manaus': 'MAO', 'Quito': 'UIO', 'Galápagos': 'GPS', 'Buenos Aires': 'EZE'
    };
    return airportCodes[location.city] || airportCodes[location.name] || 'XXX';
  }

  /**
   * Known flight costs (per person)
   */
  getKnownFlightCosts() {
    return {
      'SFO-DPS': 1500, 'DPS-SOQ': 400, 'SOQ-ROR': 700, 'ROR-MNL': 400,
      'MNL-SIN': 200, 'SIN-KUL': 100, 'KUL-BKI': 200, 'BKI-KUL': 200,
      'KUL-TPE': 250, 'TPE-NRT': 300, 'NRT-ICN': 200, 'ICN-PEK': 250,
      'PEK-KTM': 300, 'KTM-PBH': 400, 'KTM-CPH': 600, 'CPH-ARN': 100,
      'ARN-TOS': 250, 'TOS-KEF': 300, 'KEF-AMS': 400, 'AMS-JRO': 700,
      'JRO-KGL': 300, 'KGL-GIG': 1000, 'GIG-MAO': 200, 'MAO-UIO': 300,
      'UIO-GPS': 400, 'GPS-EZE': 600, 'EZE-SFO': 1800
    };
  }

  /**
   * Convert location to LatLng
   */
  toLatLng(location) {
    if (location.coordinates?.lat && location.coordinates?.lng) {
      return { lat: location.coordinates.lat, lng: location.coordinates.lng };
    }
    return null;
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Get confidence badge HTML
   */
  getConfidenceBadge(segment) {
    const badges = {
      'estimated': { color: '#999', text: 'Est', title: 'Estimated cost' },
      'researched': { color: '#3498db', text: 'Researched', title: 'AI researched cost' },
      'booked': { color: '#27ae60', text: 'Booked', title: 'Booked and confirmed' },
      'paid': { color: '#27ae60', text: 'Paid', title: 'Paid in full' }
    };

    const badge = badges[segment.booking_status] || badges['estimated'];
    return `<span class="confidence-badge" style="background: ${badge.color}" title="${badge.title}">${badge.text}</span>`;
  }
}

// Create singleton instance
window.transportSegmentManager = new TransportSegmentManager();
