const DATA_PATH = './itinerary_structured.json';

async function loadData() {
  const res = await fetch(DATA_PATH);
  if (!res.ok) throw new Error('Failed to load itinerary_structured.json');
  return res.json();
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

function groupLegs(data) {
  // Use the legs data from the structured itinerary
  if (data.legs && Array.isArray(data.legs)) {
    return data.legs.map(leg => leg.name);
  }
  // Fallback to regions if legs not available
  const set = new Set();
  for (const l of data.locations || []) if (l.region) set.add(l.region);
  return Array.from(set);
}

function filterByLeg(data, legName) {
  if (!legName || legName === 'all') return data.locations || [];
  
  // Find the leg by name
  const leg = data.legs?.find(l => l.name === legName);
  if (!leg) return data.locations || [];
  
  // Filter locations by date range of the leg
  return (data.locations || []).filter(location => {
    if (!location.arrival_date && !location.departure_date) return false;
    const locDate = location.arrival_date || location.departure_date;
    return locDate >= leg.start_date && locDate <= leg.end_date;
  });
}

function addMarkersAndPath(map, locations, showRouting = false) {
  const info = new google.maps.InfoWindow();
  const markers = [];
  const pathCoords = [];
  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#1e88e5',
      strokeOpacity: 0.7,
      strokeWeight: 3
    }
  });

  let activeMarker = null;

  locations.forEach((loc, idx) => {
    const ll = toLatLng(loc);
    if (!ll) return;
    pathCoords.push(ll);
    
    // Create custom marker with better styling
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
    
    // Add click handler for marker
    const clickHandler = () => {
      highlightLocation(idx, marker, loc);
    };
    
    marker.addListener('click', clickHandler);
    
    // Store the click handler for external use
    marker.clickHandler = clickHandler;
    markers.push(marker);
  });

  // Add route path - either simple polyline or directions
  if (pathCoords.length >= 2 && showRouting) {
    // Use Google Directions API for more realistic routing
    directionsRenderer.setMap(map);
    
    // For long trips, we'll need to break into segments due to waypoint limits
    const maxWaypoints = 8; // Google Maps API limit is 25, but we'll be conservative
    
    if (pathCoords.length <= maxWaypoints + 2) {
      // Single request
      const waypoints = pathCoords.slice(1, -1).map(coord => ({
        location: coord,
        stopover: false
      }));
      
      directionsService.route({
        origin: pathCoords[0],
        destination: pathCoords[pathCoords.length - 1],
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.TRANSIT,
        optimizeWaypoints: false
      }, (result, status) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(result);
        } else {
          // Fallback to simple polyline
          addSimplePolyline(map, pathCoords);
        }
      });
    } else {
      // Fallback to simple polyline for complex routes
      addSimplePolyline(map, pathCoords);
    }
  } else if (pathCoords.length >= 2) {
    addSimplePolyline(map, pathCoords);
  }

  // Highlight function for external use
  function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function highlightLocation(index, marker, location) {
    // Reset previous active marker
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
    
    // Highlight current marker
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
    
    // Show info window
    const name = escapeHtml(location.name);
    const subtitle = escapeHtml([location.city, location.country].filter(Boolean).join(', '));
    const dr = formatDateRange(location.arrival_date, location.departure_date);
    const duration = location.duration_days ? `${location.duration_days} days` : '';
    const meta = [dr, duration].filter(Boolean).join(' • ');
    const activity = escapeHtml(location.activity_type);
    const activityColor = getActivityColor(location.activity_type);
    const highlights = Array.isArray(location.highlights) ? location.highlights.map(escapeHtml) : [];

    const content = `
      <div class="info-window">
        <div class="info-title">${name}</div>
        ${subtitle ? `<div class="info-subtitle">${subtitle}</div>` : ''}
        ${meta ? `<div class="info-meta">${meta}</div>` : ''}
        ${activity ? `<div class="info-badge" style="background:${activityColor}">${activity}</div>` : ''}
        ${highlights.length ? `<ul class="info-highlights">${highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
          <a href="#" class="view-json-link" data-location-id="${location.id}" style="font-size: 12px; color: #1e88e5; text-decoration: none;">View JSON</a>
        </div>
      </div>
    `;

    info.setOptions({ maxWidth: 360 });
    info.setContent(content);
    info.open({ anchor: marker, map });

    // Add click handler for View JSON link
    setTimeout(() => {
      const jsonLink = document.querySelector('.view-json-link');
      if (jsonLink) {
        jsonLink.addEventListener('click', (e) => {
          e.preventDefault();
          const locationId = e.target.dataset.locationId;
          const loc = workingData.locations.find(l => idsEqual(l.id, locationId));
          if (loc) {
            alert(JSON.stringify(loc, null, 2));
          }
        });
      }
    }, 0);
    
    // Center map on marker
    map.panTo(marker.getPosition());
    
    // Update sidebar highlighting
    updateSidebarHighlight(index);
  }

  return { markers, directionsRenderer: showRouting ? directionsRenderer : null, highlightLocation };
}

function addSimplePolyline(map, pathCoords) {
  const polyline = new google.maps.Polyline({
    path: pathCoords,
    geodesic: true,
    strokeColor: '#1e88e5',
    strokeOpacity: 0.7,
    strokeWeight: 3
  });
  polyline.setMap(map);
  return polyline;
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


async function initMapApp() {
  const data = await loadData();
  const tripTitle = document.getElementById('trip-title');
  tripTitle.textContent = data.trip?.title || 'Round The World Trip';

  const map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 0, lng: 0 },
    zoom: 2,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  const locations = data.locations || [];
  computeBounds(map, locations);

  const legFilter = document.getElementById('leg-filter');
  const legs = groupLegs(data);
  legs.forEach(legName => {
    const opt = document.createElement('option');
    opt.value = legName;
    opt.textContent = legName;
    legFilter.appendChild(opt);
  });

  let currentMarkers = [];
  let currentDirectionsRenderer = null;
  let highlightLocationFn = null;
  let currentLocations = [];
  
  function render(legName, useRouting = false) {
    // Clear existing markers and directions
    currentMarkers.forEach(m => m.setMap(null));
    if (currentDirectionsRenderer) {
      currentDirectionsRenderer.setMap(null);
    }
    currentMarkers = [];
    
    const filtered = filterByLeg(data, legName);
    currentLocations = filtered;
    const { markers, directionsRenderer, highlightLocation } = addMarkersAndPath(map, filtered, useRouting);
    currentMarkers = markers;
    currentDirectionsRenderer = directionsRenderer;
    highlightLocationFn = highlightLocation;
    computeBounds(map, filtered);
    
    // Update sidebar
    updateSidebar(filtered);
    
    // Update summary with leg info
    const summary = document.getElementById('summary');
    if (legName === 'all') {
      summary.textContent = `${filtered.length} stops • ${data.trip?.duration || ''} • ${data.trip?.total_cost || ''}`;
    } else {
      const leg = data.legs?.find(l => l.name === legName);
      if (leg) {
        summary.textContent = `${filtered.length} stops • ${leg.duration_days} days • ${leg.total_cost}`;
      } else {
        summary.textContent = `${filtered.length} stops`;
      }
    }
  }
  
  function updateSidebar(locations) {
    const destinationList = document.getElementById('destination-list');
    const destinationCount = document.querySelector('.destination-count');
    
    destinationCount.textContent = `${locations.length} destinations`;
    
    destinationList.innerHTML = locations.map((loc, idx) => {
      const dateRange = formatDateRange(loc.arrival_date, loc.departure_date);
      const duration = loc.duration_days ? `${loc.duration_days} days` : '';
      const dateText = [dateRange, duration].filter(Boolean).join(' • ');
      
      return `
        <div class="destination-item" data-index="${idx}" style="display: flex; align-items: flex-start;">
          <div class="destination-number" style="background: ${getActivityColor(loc.activity_type)}">${idx + 1}</div>
          <div class="destination-info">
            <div class="destination-name">${loc.name}</div>
            <div class="destination-location">${[loc.city, loc.country].filter(Boolean).join(', ')}</div>
            ${dateText ? `<div class="destination-dates">${dateText}</div>` : ''}
            ${loc.activity_type ? `<div class="destination-activity" style="background: ${getActivityColor(loc.activity_type)}">${loc.activity_type}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handlers to destination items
    destinationList.querySelectorAll('.destination-item').forEach((item, idx) => {
      item.addEventListener('click', () => {
        if (highlightLocationFn) {
          const marker = currentMarkers[idx];
          const location = locations[idx];
          highlightLocationFn(idx, marker, location);
        }
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
  
  // Make updateSidebarHighlight available globally
  window.updateSidebarHighlight = updateSidebarHighlight;

  // Add routing toggle functionality
  const routingToggle = document.getElementById('routing-toggle');
  
  function updateMap() {
    render(legFilter.value, routingToggle.checked);
  }
  
  legFilter.addEventListener('change', updateMap);
  routingToggle.addEventListener('change', updateMap);
  
  render('all');
}

window.addEventListener('load', () => {
  // Wait for Google Maps script to be ready
  const wait = () => {
    if (!window.google || !window.google.maps) return setTimeout(wait, 50);
    initMapApp().catch(err => {
      console.error(err);
      alert('Failed to initialize map: ' + err.message);
    });
  };
  wait();
});


