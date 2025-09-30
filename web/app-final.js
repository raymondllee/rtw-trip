const DATA_PATH = '../itinerary_structured.json';

// Scenario Management System
class ScenarioManager {
  constructor() {
    this.storageKey = 'rtw-scenarios';
    this.autosaveKey = 'rtw-autosave';
  }

  // Load all scenarios from localStorage
  loadScenarios() {
    try {
      const scenarios = localStorage.getItem(this.storageKey);
      return scenarios ? JSON.parse(scenarios) : {};
    } catch (error) {
      console.error('Error loading scenarios:', error);
      return {};
    }
  }

  // Save scenarios to localStorage
  saveScenarios(scenarios) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(scenarios));
      return true;
    } catch (error) {
      console.error('Error saving scenarios:', error);
      return false;
    }
  }

  // Save a new scenario
  saveScenario(name, description, data) {
    const scenarios = this.loadScenarios();
    scenarios[name] = {
      name,
      description: description || '',
      data: JSON.parse(JSON.stringify(data)), // Deep copy
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.saveScenarios(scenarios);
  }

  // Load a specific scenario
  loadScenario(name) {
    const scenarios = this.loadScenarios();
    return scenarios[name] || null;
  }

  // Delete a scenario
  deleteScenario(name) {
    const scenarios = this.loadScenarios();
    delete scenarios[name];
    return this.saveScenarios(scenarios);
  }

  // Get list of scenario names
  getScenarioNames() {
    const scenarios = this.loadScenarios();
    return Object.keys(scenarios).sort();
  }

  // Auto-save current state
  autosave(data) {
    try {
      localStorage.setItem(this.autosaveKey, JSON.stringify({
        data: JSON.parse(JSON.stringify(data)),
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error auto-saving:', error);
    }
  }

  // Load auto-saved state
  loadAutosave() {
    try {
      const autosave = localStorage.getItem(this.autosaveKey);
      return autosave ? JSON.parse(autosave) : null;
    } catch (error) {
      console.error('Error loading autosave:', error);
      return null;
    }
  }

  // Export all scenarios as JSON
  exportScenarios() {
    const scenarios = this.loadScenarios();
    const exportData = {
      scenarios,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    return JSON.stringify(exportData, null, 2);
  }

  // Import scenarios from JSON
  importScenarios(jsonData, overwrite = false) {
    try {
      const importData = JSON.parse(jsonData);
      if (!importData.scenarios) {
        throw new Error('Invalid scenario file format');
      }

      const currentScenarios = overwrite ? {} : this.loadScenarios();
      const importedScenarios = importData.scenarios;
      
      // Handle duplicates if not overwriting
      Object.keys(importedScenarios).forEach(name => {
        let finalName = name;
        let counter = 1;
        
        while (!overwrite && currentScenarios[finalName]) {
          finalName = `${name} (${counter})`;
          counter++;
        }
        
        currentScenarios[finalName] = importedScenarios[name];
        currentScenarios[finalName].name = finalName;
        currentScenarios[finalName].updatedAt = new Date().toISOString();
      });

      return this.saveScenarios(currentScenarios);
    } catch (error) {
      console.error('Error importing scenarios:', error);
      return false;
    }
  }
}

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
  let routingElements = [];

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
      
      if (pathCoords.length <= 10) {
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
    
    const name = location.name || '';
    const subtitle = [location.city, location.country].filter(Boolean).join(', ');
    const dr = formatDateRange(location.arrival_date, location.departure_date);
    const duration = location.duration_days ? `${location.duration_days} days` : '';
    const meta = [dr, duration].filter(Boolean).join(' • ');
    const activity = location.activity_type || '';
    const activityColor = getActivityColor(location.activity_type);
    const highlights = Array.isArray(location.highlights) ? location.highlights : [];
    const notes = location.notes || '';

    const content = `
      <div style="min-width: 260px; padding: 12px 14px;">
        <div style="font-weight: 700; font-size: 16px; margin-bottom: 6px;">${name}</div>
        ${subtitle ? `<div style="color: #666; margin-bottom: 4px;">${subtitle}</div>` : ''}
        ${meta ? `<div style="color: #444; margin-bottom: 8px;">${meta}</div>` : ''}
        ${activity ? `<div style="display: inline-block; color: #fff; padding: 2px 8px; border-radius: 999px; font-size: 12px; margin-bottom: 8px; background: ${activityColor}">${activity}</div>` : ''}
        ${notes ? `<div style="background: #f8f9fa; padding: 8px; border-radius: 4px; margin: 8px 0; border-left: 3px solid ${activityColor}; font-size: 13px; color: #555;"><strong style="color: #333;">Notes:</strong><br>${notes.replace(/\n/g, '<br>')}</div>` : ''}
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
  const scenarioManager = new ScenarioManager();
  const tripTitle = document.getElementById('trip-title');
  
  // Check for autosaved data
  const autosave = scenarioManager.loadAutosave();
  if (autosave && confirm('Found auto-saved changes. Would you like to restore them?')) {
    workingData = autosave.data;
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
  
  // Places API variables
  let pendingInsertIndex = null;
  let autocomplete = null;
  
  // Auto-save timer
  let autosaveTimer = null;
  
  function triggerAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      scenarioManager.autosave(workingData);
    }, 2000); // Auto-save after 2 seconds of inactivity
  }
  
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
    
    triggerAutosave();
  }
  
  function render(legName, useRouting = false) {
    currentMarkers.forEach(m => m.setMap(null));
    currentMarkers = [];
    
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
    updateScenarioSelector();
    
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
  
  function updateScenarioSelector() {
    const selector = document.getElementById('scenario-selector');
    const currentValue = selector.value;
    
    // Clear existing options except the first one
    selector.innerHTML = '<option value="">Select a scenario...</option>';
    
    // Add scenarios
    const scenarioNames = scenarioManager.getScenarioNames();
    scenarioNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      selector.appendChild(option);
    });
    
    // Restore selection if it still exists
    if (currentValue && scenarioNames.includes(currentValue)) {
      selector.value = currentValue;
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
    
    // Build sidebar with add buttons between destinations
    const sidebarItems = [];
    
    // Add button at the top
    sidebarItems.push(`
      <div class="add-destination-btn" data-insert-index="0">
        <span>+ Add destination at start</span>
      </div>
    `);
    
    locations.forEach((loc, idx) => {
      const dateRange = formatDateRange(loc.arrival_date, loc.departure_date);
      const duration = loc.duration_days || 1;
      const notes = loc.notes || '';
      
      // Add the destination item
      sidebarItems.push(`
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
            <div class="destination-notes">
              <textarea class="editable-notes" placeholder="Add notes..." data-location-id="${loc.id}">${notes}</textarea>
            </div>
          </div>
        </div>
      `);
      
      // Add button after this destination
      sidebarItems.push(`
        <div class="add-destination-btn" data-insert-index="${idx + 1}">
          <span>+ Add destination</span>
        </div>
      `);
    });
    
    destinationList.innerHTML = sidebarItems.join('');
    
    // Add click handlers for destinations
    destinationList.querySelectorAll('.destination-item').forEach((item, idx) => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('editable-duration') || 
            e.target.classList.contains('editable-notes') || 
            e.target.classList.contains('drag-handle')) return;
        if (highlightLocationFn) {
          const marker = currentMarkers[idx];
          const location = locations[idx];
          highlightLocationFn(idx, marker, location);
        }
      });
    });
    
    // Add click handlers for add buttons
    destinationList.querySelectorAll('.add-destination-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const insertIndex = parseInt(e.currentTarget.dataset.insertIndex);
        openAddDestinationModal(insertIndex);
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
        
        const globalLocation = workingData.locations.find(loc => loc.id === locationId);
        if (globalLocation) {
          globalLocation.duration_days = newDuration;
          recalculateDates(workingData.locations);
          render(legFilter.value, routingToggle.checked);
        }
      });
      
      input.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
  }
  
  function setupNotesEditing(container, filteredLocations) {
    container.querySelectorAll('.editable-notes').forEach(textarea => {
      // Auto-save notes on change with debouncing
      let notesTimer = null;
      
      textarea.addEventListener('input', (e) => {
        const locationId = parseInt(e.target.dataset.locationId);
        const newNotes = e.target.value;
        
        // Clear previous timer
        if (notesTimer) clearTimeout(notesTimer);
        
        // Set new timer to save after 1 second of no typing
        notesTimer = setTimeout(() => {
          const globalLocation = workingData.locations.find(loc => loc.id === locationId);
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
  
  function openAddDestinationModal(insertIndex) {
    pendingInsertIndex = insertIndex;
    const modal = document.getElementById('add-destination-modal');
    const searchInput = document.getElementById('location-search');
    const durationInput = document.getElementById('duration-input');
    
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
    const existingIds = workingData.locations.map(loc => loc.id || 0);
    return Math.max(...existingIds, 0) + 1;
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
    
    const newLocation = {
      id: generateNewLocationId(),
      name: placeData.name,
      city: addressInfo.city,
      country: addressInfo.country,
      region: addressInfo.region || 'Custom',
      coordinates: {
        lat: placeData.location.lat,
        lng: placeData.location.lng
      },
      duration_days: duration,
      activity_type: 'city exploration',
      highlights: [],
      notes: '',
      arrival_date: null,
      departure_date: null
    };
    
    workingData.locations.splice(insertIndex, 0, newLocation);
    recalculateDates(workingData.locations);
    render(legFilter.value, routingToggle.checked);
    closeAddDestinationModal();
  }
  
  // Scenario management functions
  function openSaveScenarioModal() {
    document.getElementById('save-scenario-modal').style.display = 'flex';
    document.getElementById('scenario-name').focus();
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
  
  function updateScenarioList() {
    const scenarioList = document.getElementById('scenario-list');
    const scenarios = scenarioManager.loadScenarios();
    const scenarioNames = Object.keys(scenarios).sort();
    
    if (scenarioNames.length === 0) {
      scenarioList.innerHTML = '<div class="empty-scenarios">No saved scenarios yet.</div>';
      return;
    }
    
    scenarioList.innerHTML = scenarioNames.map(name => {
      const scenario = scenarios[name];
      const createdDate = new Date(scenario.createdAt).toLocaleDateString();
      const locationCount = scenario.data.locations?.length || 0;
      
      return `
        <div class="scenario-item">
          <div class="scenario-info">
            <div class="scenario-name">${scenario.name}</div>
            <div class="scenario-meta">${locationCount} destinations • Created ${createdDate}</div>
            ${scenario.description ? `<div class="scenario-description">${scenario.description}</div>` : ''}
          </div>
          <div class="scenario-actions-btn">
            <button class="btn-load" onclick="loadScenarioByName('${name}')">Load</button>
            <button class="btn-delete" onclick="deleteScenarioByName('${name}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  window.loadScenarioByName = function(name) {
    const scenario = scenarioManager.loadScenario(name);
    if (scenario) {
      workingData = JSON.parse(JSON.stringify(scenario.data));
      render(legFilter.value, routingToggle.checked);
      closeManageScenariosModal();
      document.getElementById('scenario-selector').value = name;
    }
  };
  
  window.deleteScenarioByName = function(name) {
    if (confirm(`Delete scenario "${name}"?`)) {
      scenarioManager.deleteScenario(name);
      updateScenarioList();
      updateScenarioSelector();
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
    render(legFilter.value, routingToggle.checked);
  }
  
  legFilter.addEventListener('change', updateMap);
  routingToggle.addEventListener('change', updateMap);
  
  // Planning controls
  document.getElementById('recalculate-btn').addEventListener('click', () => {
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
  
  // Scenario controls
  document.getElementById('save-scenario-btn').addEventListener('click', openSaveScenarioModal);
  document.getElementById('manage-scenarios-btn').addEventListener('click', openManageScenariosModal);
  document.getElementById('export-scenarios-btn').addEventListener('click', () => {
    const dataStr = scenarioManager.exportScenarios();
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rtw-scenarios.json';
    link.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById('import-scenarios-btn').addEventListener('click', openImportScenariosModal);
  
  // Scenario selector
  document.getElementById('scenario-selector').addEventListener('change', (e) => {
    if (e.target.value) {
      const scenario = scenarioManager.loadScenario(e.target.value);
      if (scenario) {
        workingData = JSON.parse(JSON.stringify(scenario.data));
        render(legFilter.value, routingToggle.checked);
      }
    }
  });
  
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
      addNewDestination(pendingInsertIndex, placeData, duration);
    } catch (error) {
      console.error('Error parsing place data:', error);
      alert('Error adding destination. Please try again.');
    }
  });
  
  document.getElementById('save-scenario-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('scenario-name').value.trim();
    const description = document.getElementById('scenario-description').value.trim();
    
    if (!name) {
      alert('Please enter a scenario name.');
      return;
    }
    
    const success = scenarioManager.saveScenario(name, description, workingData);
    if (success) {
      closeSaveScenarioModal();
      updateScenarioSelector();
      document.getElementById('scenario-selector').value = name;
    } else {
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
          updateScenarioSelector();
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