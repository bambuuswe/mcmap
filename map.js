const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 1,
  maxZoom: 20,
  zoomSnap: 0.5
}).setView([0, 0], 16);

L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
  maxZoom: 17
}).addTo(map);

// State
let currentPos = [0, 0];
let destinationMarker = null;
let routingControl = null;
let lastInstruction = "";
let ttsEnabled = true;
let isLocked = false;
let isCompassLocked = false;
let routeInstructions = [];
let currentStepIndex = 0;
let searchTimeout = null;

// UI
const els = {
  instruction: document.getElementById('instruction'),
  street: document.getElementById('street'),
  etaTime: document.getElementById('eta-time'),
  etaMin: document.getElementById('eta-min'),
  etaKm: document.getElementById('eta-km'),
  soundBtn: document.getElementById('sound-btn'),
  lockBtn: document.getElementById('lock-btn'),
  compassBtn: document.getElementById('compass-btn'),
  turnIcon: document.getElementById('turn-icon'),
  map: document.getElementById('map'),
  searchInput: document.getElementById('search-input'),
  searchBtn: document.getElementById('search-btn'),
  searchResults: document.getElementById('search-results')
};

// TTS
function speak(text) {
  if (!ttsEnabled || !text || text === lastInstruction) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'sv-SE';
  window.speechSynthesis.speak(utterance);
  lastInstruction = text;
}

// Spelar-ikon
const playerIcon = L.divIcon({
  className: 'player-marker',
  html: '<img src="car.png" id="player-img" style="width:32px;height:32px;transform-origin:center;">',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const player = L.marker([0, 0], { icon: playerIcon, zIndexOffset: 1000 }).addTo(map);

// KOMPASS
let currentHeading = 0;
let deviceOrientationEnabled = false;

async function requestOrientation() {
  if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission === 'granted') {
        enableOrientation();
        return true;
      }
    } catch (e) {}
  } else {
    enableOrientation();
    return true;
  }
  return false;
}

function enableOrientation() {
  if (deviceOrientationEnabled) return;
  deviceOrientationEnabled = true;
  
  window.addEventListener('deviceorientation', (e) => {
    let heading = null;
    if (e.webkitCompassHeading !== undefined) {
      heading = e.webkitCompassHeading;
    } else if (e.alpha !== null) {
      heading = 360 - e.alpha;
    }
    if (heading !== null && !isNaN(heading)) {
      currentHeading = (heading + 360) % 360;
      updateRotation();
    }
  });
}

function updateRotation() {
  const img = document.getElementById('player-img');
  
  if (isCompassLocked) {
    els.map.style.transform = `translate(-50%, -50%) rotate(${-currentHeading}deg)`;
    if (img) img.style.transform = `rotate(${currentHeading}deg)`;
    els.turnIcon.style.transform = `rotate(${currentHeading}deg)`;
  } else {
    els.map.style.transform = `translate(-50%, -50%) rotate(0deg)`;
    if (img) img.style.transform = `rotate(${currentHeading}deg)`;
    els.turnIcon.style.transform = `rotate(${currentHeading}deg)`;
  }
}

document.addEventListener('click', () => {
  if (!deviceOrientationEnabled) requestOrientation();
}, { once: true });

// SÖKFUNKTION!
async function searchAddress(query) {
  if (!query || query.length < 3) return;
  
  try {
    // Använd OpenStreetMap Nominatim (gratis)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=se`
    );
    const data = await response.json();
    displaySearchResults(data);
  } catch (error) {
    console.error('Sökfel:', error);
    speak("Kunde inte söka");
  }
}

function displaySearchResults(results) {
  els.searchResults.innerHTML = '';
  
  if (results.length === 0) {
    els.searchResults.innerHTML = '<div class="search-result-item">Inga resultat</div>';
    els.searchResults.classList.add('active');
    return;
  }
  
  results.forEach(result => {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.textContent = result.display_name.split(',').slice(0, 3).join(', '); // Kortare namn
    div.addEventListener('click', () => {
      selectSearchResult(result);
    });
    els.searchResults.appendChild(div);
  });
  
  els.searchResults.classList.add('active');
}

function selectSearchResult(result) {
  const lat = parseFloat(result.lat);
  const lon = parseFloat(result.lon);
  
  // Stäng sökresultat
  els.searchResults.classList.remove('active');
  els.searchInput.value = result.display_name.split(',')[0];
  
  // Sätt som destination
  if (destinationMarker) map.removeLayer(destinationMarker);
  if (routingControl) map.removeControl(routingControl);
  
  // Pan till platsen
  map.setView([lat, lon], 16);
  
  destinationMarker = L.marker([lat, lon], {
    icon: L.divIcon({
      className: 'destination-marker',
      html: '<div style="width:16px;height:16px;background:#ff4444;border:2px solid #000;"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })
  }).addTo(map);
  
  // Om vi har GPS, beräkna rutt
  if (currentPos[0] !== 0) {
    calculateRoute(currentPos, [lat, lon]);
    speak(`Navigerar till ${result.display_name.split(',')[0]}`);
  } else {
    speak(`Valde ${result.display_name.split(',')[0]}. Väntar på GPS.`);
  }
}

// Sök-event
els.searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value;
  
  if (query.length >= 3) {
    searchTimeout = setTimeout(() => {
      searchAddress(query);
    }, 500); // Vänta 500ms efter att användaren slutat skriva
  } else {
    els.searchResults.classList.remove('active');
  }
});

els.searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchAddress(els.searchInput.value);
  }
});

els.searchBtn.addEventListener('click', () => {
  searchAddress(els.searchInput.value);
});

// Stäng sökresultat när man klickar utanför
document.addEventListener('click', (e) => {
  if (!e.target.closest('.mc-search-container')) {
    els.searchResults.classList.remove('active');
  }
});

// Översätt instruktioner
function translateInstruction(text) {
  const translations = {
    'Head': 'Kör rakt fram',
    'Turn left': 'Sväng vänster',
    'Turn right': 'Sväng höger',
    'Turn sharp left': 'Sväng skarpt vänster',
    'Turn sharp right': 'Sväng skarpt höger',
    'Turn slight left': 'Sväng svagt vänster',
    'Turn slight right': 'Sväng svagt höger',
    'Continue': 'Fortsätt',
    'Continue straight': 'Fortsätt rakt fram',
    'At the roundabout': 'I rondellen',
    'take the': 'ta',
    'exit': 'utfarten',
    'first': 'första',
    'second': 'andra',
    'third': 'tredje',
    'fourth': 'fjärde',
    'fifth': 'femte',
    'sixth': 'sjätte',
    'seventh': 'sjunde',
    'eighth': 'åttonde',
    'ninth': 'nionde',
    'tenth': 'tionde',
    'onto': 'in på',
    'on': 'på',
    'toward': 'mot',
    'You have arrived': 'Du har anlänt',
    'Destination reached': 'Destination nådd',
    'Enter': 'Kör in på',
    'Leave': 'Lämna',
    ' toward ': ' mot ',
    ' on ': ' på '
  };
  
  let translated = text;
  for (const [en, sv] of Object.entries(translations)) {
    translated = translated.replace(new RegExp(en, 'gi'), sv);
  }
  return translated;
}

function getTurnIcon(text) {
  text = text.toLowerCase();
  if (text.includes('left')) return '⬅️';
  if (text.includes('right')) return '➡️';
  if (text.includes('roundabout')) return '↪️';
  if (text.includes('arrived') || text.includes('reached')) return '🏁';
  return '⬆️';
}

function updateCurrentInstruction() {
  if (!routeInstructions.length || currentPos[0] === 0) return;
  
  let closestIndex = 0;
  let minDistance = Infinity;
  
  for (let i = 0; i < routeInstructions.length; i++) {
    const dist = getDistanceToStep(routeInstructions[i], currentPos);
    if (dist !== null && dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }
  
  if (minDistance < 50 && closestIndex < routeInstructions.length - 1) {
    closestIndex++;
  }
  
  if (closestIndex !== currentStepIndex) {
    currentStepIndex = closestIndex;
    const instruction = routeInstructions[currentStepIndex];
    
    if (instruction) {
      const text = translateInstruction(instruction.text);
      const distance = instruction.distance ? Math.round(instruction.distance) : 0;
      
      els.instruction.textContent = text;
      els.street.textContent = distance > 0 ? `om ${distance} meter` : 'nu';
      els.turnIcon.textContent = getTurnIcon(instruction.text);
      
      if (lastInstruction !== text) {
        speak(`${text} om ${distance} meter`);
      }
    }
  } else if (routeInstructions[currentStepIndex]) {
    const instruction = routeInstructions[currentStepIndex];
    const dist = getDistanceToStep(instruction, currentPos);
    if (dist !== null) {
      els.street.textContent = dist > 100 ? `om ${Math.round(dist)} meter` : 'nu';
    }
  }
}

function getDistanceToStep(step, currentPos) {
  if (!step || !currentPos) return null;
  if (step.latLng) {
    const stepLatLng = L.latLng(step.latLng.lat, step.latLng.lng);
    const current = L.latLng(currentPos[0], currentPos[1]);
    return stepLatLng.distanceTo(current);
  }
  return null;
}

// KNAPPAR
els.lockBtn.addEventListener('click', () => {
  isLocked = !isLocked;
  els.lockBtn.textContent = isLocked ? '🔒' : '🔓';
  els.lockBtn.classList.toggle('locked', isLocked);
  if (isLocked && currentPos[0] !== 0) {
    map.setView(currentPos, 16);
    speak("Kartan låst på position");
  } else {
    speak("Kartan upplåst");
  }
});

els.compassBtn.addEventListener('click', async () => {
  if (!deviceOrientationEnabled) {
    const granted = await requestOrientation();
    if (!granted) {
      speak("Tillåt åtkomst till kompassen");
      return;
    }
  }
  isCompassLocked = !isCompassLocked;
  els.compassBtn.classList.toggle('locked', isCompassLocked);
  if (isCompassLocked) {
    speak("Kompass låst. Kartan roterar.");
    els.map.classList.add('rotating');
  } else {
    speak("Kompass upplåst.");
    els.map.classList.remove('rotating');
  }
  updateRotation();
});

els.soundBtn.addEventListener('click', () => {
  ttsEnabled = !ttsEnabled;
  els.soundBtn.textContent = ttsEnabled ? '🔊' : '🔇';
  els.soundBtn.classList.toggle('muted', !ttsEnabled);
  if (!ttsEnabled) window.speechSynthesis.cancel();
});

document.getElementById('layers-btn').addEventListener('click', () => {
  let hasTopo = false;
  map.eachLayer((layer) => {
    if (layer instanceof L.TileLayer) {
      hasTopo = layer._url.includes('opentopomap');
      map.removeLayer(layer);
    }
  });
  L.tileLayer(hasTopo ? 
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" :
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    { maxZoom: 19 }
  ).addTo(map);
});

document.getElementById('cancel-btn').addEventListener('click', () => {
  if (destinationMarker) {
    map.removeLayer(destinationMarker);
    destinationMarker = null;
  }
  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }
  routeInstructions = [];
  currentStepIndex = 0;
  els.instruction.textContent = "Navigering avbruten";
  els.street.textContent = "Klicka för nytt mål";
  els.etaTime.textContent = "--:--";
  els.etaMin.textContent = "--";
  els.etaKm.textContent = "--";
  els.turnIcon.textContent = '➡️';
  speak("Navigering avbruten");
});

document.getElementById('share-btn').addEventListener('click', () => {
  const time = els.etaTime.textContent;
  if (time !== '--:--') {
    const text = `Jag ankommer ${time} med Minecraft Map!`;
    if (navigator.share) navigator.share({ text });
    else alert(text);
  }
});

// Sätt mål via klick (om upplåst)
map.on('click', (e) => {
  if (isLocked) {
    els.lockBtn.style.animation = 'shake 0.3s';
    setTimeout(() => els.lockBtn.style.animation = '', 300);
    speak("Lås upp kartan först");
    return;
  }
  
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  
  if (destinationMarker) map.removeLayer(destinationMarker);
  if (routingControl) map.removeControl(routingControl);
  
  destinationMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: 'destination-marker',
      html: '<div style="width:16px;height:16px;background:#ff4444;border:2px solid #000;"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })
  }).addTo(map);
  
  if (currentPos[0] !== 0) {
    calculateRoute(currentPos, [lat, lng]);
  }
});

function calculateRoute(from, to) {
  if (routingControl) map.removeControl(routingControl);
  
  routeInstructions = [];
  currentStepIndex = 0;
  
  routingControl = L.Routing.control({
    waypoints: [L.latLng(from[0], from[1]), L.latLng(to[0], to[1])],
    routeWhileDragging: false,
    show: false,
    lineOptions: {
      styles: [{ color: '#4caf50', weight: 6, dashArray: '8, 4' }]
    },
    createMarker: () => null
  }).addTo(map);
  
  routingControl.on('routesfound', (e) => {
    const route = e.routes[0];
    const summary = route.summary;
    
    if (route.instructions && route.instructions.length) {
      routeInstructions = route.instructions.map((inst, index) => ({
        text: inst.text,
        distance: inst.distance,
        latLng: route.coordinates[inst.index] || null
      }));
    } else {
      routeInstructions = [{
        text: 'Kör mot destinationen',
        distance: summary.totalDistance,
        latLng: L.latLng(to[0], to[1])
      }];
    }
    
    const now = new Date();
    const arrival = new Date(now.getTime() + summary.totalTime * 1000);
    els.etaTime.textContent = arrival.toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'});
    els.etaMin.textContent = Math.round(summary.totalTime / 60);
    els.etaKm.textContent = (summary.totalDistance / 1000).toFixed(1);
    
    updateCurrentInstruction();
    
    if (routeInstructions[0]) {
      const text = translateInstruction(routeInstructions[0].text);
      const dist = Math.round(routeInstructions[0].distance);
      speak(`${text} om ${dist} meter. ${Math.round(summary.totalTime / 60)} minuter totalt.`);
    }
  });
}

// GPS
navigator.geolocation.watchPosition(
  (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    currentPos = [lat, lon];
    player.setLatLng([lat, lon]);
    
    if (routeInstructions.length > 0) {
      updateCurrentInstruction();
    }
    
    if (isLocked) {
      map.setView([lat, lon], 16);
    }
    
    if (destinationMarker && routingControl) {
      const dest = destinationMarker.getLatLng();
      const dist = L.latLng(lat, lon).distanceTo(dest);
      if (dist > 10) {
        calculateRoute([lat, lon], [dest.lat, dest.lng]);
      }
    }
  },
  (err) => console.error(err),
  { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
);

// Shake animation
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateY(0); }
    25% { transform: translateY(-5px) rotate(-5deg); }
    75% { transform: translateY(-5px) rotate(5deg); }
  }
`;
document.head.appendChild(style);
