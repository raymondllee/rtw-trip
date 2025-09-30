const DATA_PATH = '../itinerary_structured.json';

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

function filterByLeg(data, legName) {
  if (!legName || legName === 'all') return data.locations || [];
  
  const leg = data.legs?.find(l => l.name === legName);
  if (!leg) return data.locations || [];
  
  return (data.locations || []).filter(location => {
    if (!location.arrival_date && !location.departure_date) return false;
    const locDate = location.arrival_date || location.departure_date;
    return locDate >= leg.start_date && locDate <= leg.end_date;
  });
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

function addMarkersAndPath(map, locations, showRouting = false) {
  const info = new google.maps.InfoWindow();
  const markers = [];
  const pathCoords = [];
  let activeMarker = null;
  let routingElements = []; // Track all routing elements for cleanup

  locations.forEach((loc, idx) => {
    const ll = toLatLng(loc);
    if (!ll) return;
    pathCoords.push(ll);
    
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

  // Add routing path
  if (pathCoords.length >= 2) {
    if (showRouting) {
      // Use Google Directions API for more realistic routing
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#1e88e5',
          strokeOpacity: 0.7,
          strokeWeight: 3
        }
      });
      directionsRenderer.setMap(map);
      routingElements.push(directionsRenderer);
      
      // For long routes, use simple polyline as fallback
      if (pathCoords.length <= 10) { // Conservative limit
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
            directionsRenderer.setMap(null);
            const polyline = new google.maps.Polyline({
              path: pathCoords,
              geodesic: true,
              strokeColor: '#1e88e5',
              strokeOpacity: 0.7,
              strokeWeight: 3
            });
            polyline.setMap(map);
            routingElements.push(polyline);
          }
        });
      } else {
        // Use simple polyline for complex routes
        directionsRenderer.setMap(null);
        const polyline = new google.maps.Polyline({
          path: pathCoords,
          geodesic: true,
          strokeColor: '#1e88e5',
          strokeOpacity: 0.7,
          strokeWeight: 3
        });
        polyline.setMap(map);
        routingElements.push(polyline);
      }
    } else {
      // Simple polyline
      const polyline = new google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: '#1e88e5',
        strokeOpacity: 0.7,
        strokeWeight: 3
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
    
    // Show info window
    const name = location.name || '';
    const subtitle = [location.city, location.country].filter(Boolean).join(', ');
    const dr = formatDateRange(location.arrival_date, location.departure_date);
    const duration = location.duration_days ? `${location.duration_days} days` : '';
    const meta = [dr, duration].filter(Boolean).join(' • ');
    const activity = location.activity_type || '';
    const activityColor = getActivityColor(location.activity_type);
    const highlights = Array.isArray(location.highlights) ? location.highlights : [];

    const content = `
      <div style="min-width: 260px; padding: 12px 14px;">
        <div style="font-weight: 700; font-size: 16px; margin-bottom: 6px;">${name}</div>
        ${subtitle ? `<div style="color: #666; margin-bottom: 4px;">${subtitle}</div>` : ''}
        ${meta ? `<div style="color: #444; margin-bottom: 8px;">${meta}</div>` : ''}
        ${activity ? `<div style="display: inline-block; color: #fff; padding: 2px 8px; border-radius: 999px; font-size: 12px; margin-bottom: 8px; background: ${activityColor}">${activity}</div>` : ''}
        ${highlights.length ? `<ul style="margin: 8px 0 0 18px; padding: 0;">${highlights.map(h => `<li style="margin: 2px 0;">${h}</li>`).join('')}</ul>` : ''}
      </div>
    `;

    info.setOptions({ maxWidth: 360 });
    info.setContent(content);
    info.open({ anchor: marker, map });
    
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
  const tripTitle = document.getElementById('trip-title');
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
  const legs = groupLegs(workingData);
  legs.forEach(legName => {
    const opt = document.createElement('option');
    opt.value = legName;
    opt.textContent = legName;
    legFilter.appendChild(opt);
  });

  let currentMarkers = [];
  let currentRoutingElements = [];
  let highlightLocationFn = null;
  let currentLocations = [];
  
  function recalculateDates(locations, startDate) {
    if (!startDate) startDate = workingData.trip?.start_date || '2026-06-12';
    
    let currentDate = new Date(startDate + 'T00:00:00Z');
    
    locations.forEach((loc, idx) => {
      if (idx === 0) {
        loc.arrival_date = formatDate(currentDate);
        loc.departure_date = formatDate(addDays(currentDate, (loc.duration_days || 1) - 1));
      } else {
        currentDate = addDays(new Date(locations[idx - 1].departure_date + 'T00:00:00Z'), 1);
        loc.arrival_date = formatDate(currentDate);
        loc.departure_date = formatDate(addDays(currentDate, (loc.duration_days || 1) - 1));
      }
      currentDate = new Date(loc.departure_date + 'T00:00:00Z');
    });
  }
  
  function render(legName, useRouting = false) {
    // Clear existing markers
    currentMarkers.forEach(m => m.setMap(null));
    currentMarkers = [];
    
    // Clear existing routing elements
    currentRoutingElements.forEach(element => {
      if (element && element.setMap) {
        element.setMap(null);
      }
    });
    currentRoutingElements = [];
    
    const filtered = filterByLeg(workingData, legName);
    currentLocations = filtered;
    const { markers, highlightLocation, routingElements } = addMarkersAndPath(map, filtered, useRouting);
    currentMarkers = markers;
    currentRoutingElements = routingElements || [];
    highlightLocationFn = highlightLocation;
    computeBounds(map, filtered);
    
    updateSidebar(filtered);
    
    const summary = document.getElementById('summary');
    if (legName === 'all') {
      summary.textContent = `${filtered.length} stops • ${workingData.trip?.duration || ''} • ${workingData.trip?.total_cost || ''}`;
    } else {
      const leg = workingData.legs?.find(l => l.name === legName);
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
    
    const isFiltered = legFilter.value !== 'all';
    const countText = isFiltered 
      ? `${locations.length} destinations (${legFilter.value} leg)` 
      : `${locations.length} destinations`;
    destinationCount.textContent = countText;
    
    destinationList.innerHTML = locations.map((loc, idx) => {
      const dateRange = formatDateRange(loc.arrival_date, loc.departure_date);
      const duration = loc.duration_days || 1;
      
      return `
        <div class="destination-item" data-index="${idx}" draggable="true" style="display: flex; align-items: flex-start;">
          <div class="drag-handle">⋮⋮</div>
          <div class="destination-number" style="background: ${getActivityColor(loc.activity_type)}">${idx + 1}</div>
          <div class="destination-info">
            <div class="destination-name">${loc.name}</div>
            <div class="destination-location">${[loc.city, loc.country].filter(Boolean).join(', ')}</div>
            <div class="destination-dates">
              ${dateRange ? `${dateRange} • ` : ''}
              <input type="number" class="editable-duration" value="${duration}" min="1" max="365" data-location-id="${loc.id}"> days
            </div>
            ${loc.activity_type ? `<div class="destination-activity" style="background: ${getActivityColor(loc.activity_type)}">${loc.activity_type}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handlers (avoid drag handle and input)
    destinationList.querySelectorAll('.destination-item').forEach((item, idx) => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('editable-duration') || e.target.classList.contains('drag-handle')) return;
        if (highlightLocationFn) {
          const marker = currentMarkers[idx];
          const location = locations[idx];
          highlightLocationFn(idx, marker, location);
        }
      });
    });
    
    setupDragAndDrop(destinationList, locations);
    setupDurationEditing(destinationList, locations);
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
          // Get the actual locations being reordered
          const draggedLocation = filteredLocations[draggedIndex];
          const targetLocation = filteredLocations[dropIndex];
          
          // Find their positions in the global locations array
          const globalDraggedIndex = workingData.locations.findIndex(loc => loc.id === draggedLocation.id);
          const globalTargetIndex = workingData.locations.findIndex(loc => loc.id === targetLocation.id);
          
          if (globalDraggedIndex !== -1 && globalTargetIndex !== -1) {
            // Remove from global array
            const movedLocation = workingData.locations.splice(globalDraggedIndex, 1)[0];
            
            // Calculate new insertion point (adjust for removal if needed)
            let newInsertIndex = globalTargetIndex;
            if (globalDraggedIndex < globalTargetIndex) {
              newInsertIndex--;
            }
            
            // Insert at new position in global array
            workingData.locations.splice(newInsertIndex, 0, movedLocation);
            
            // Recalculate dates for the entire trip
            recalculateDates(workingData.locations);
            
            // Re-render current view
            render(legFilter.value, routingToggle.checked);
          }
        }
      });
    });
  }
  
  function setupDurationEditing(container, filteredLocations) {
    container.querySelectorAll('.editable-duration').forEach(input => {
      input.addEventListener('change', (e) => {
        const locationId = parseInt(e.target.dataset.locationId);
        const newDuration = parseInt(e.target.value) || 1;
        
        // Always update the global location data
        const globalLocation = workingData.locations.find(loc => loc.id === locationId);
        if (globalLocation) {
          globalLocation.duration_days = newDuration;
          
          // Recalculate dates for the entire trip to maintain sequence
          recalculateDates(workingData.locations);
          
          // Re-render current view
          render(legFilter.value, routingToggle.checked);
        }
      });
      
      input.addEventListener('click', (e) => {
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
  
  window.updateSidebarHighlight = updateSidebarHighlight;

  const routingToggle = document.getElementById('routing-toggle');
  
  function updateMap() {
    render(legFilter.value, routingToggle.checked);
  }
  
  legFilter.addEventListener('change', updateMap);
  routingToggle.addEventListener('change', updateMap);
  
  // Planning controls
  document.getElementById('recalculate-btn').addEventListener('click', () => {
    // Always recalculate the entire trip to maintain proper sequencing
    recalculateDates(workingData.locations);
    render(legFilter.value, routingToggle.checked);
  });
  
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset all changes to original itinerary?')) {
      workingData = JSON.parse(JSON.stringify(originalData));
      render(legFilter.value, routingToggle.checked);
    }
  });
  
  document.getElementById('export-btn').addEventListener('click', () => {
    const dataStr = JSON.stringify(workingData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'updated_itinerary.json';
    link.click();
    URL.revokeObjectURL(url);
  });
  
  render('all');
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