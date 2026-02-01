const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 1,
  maxZoom: 20
}).setView([0, 0], 17);

L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
  maxZoom: 17
}).addTo(map);

// State
let currentPos = [0, 0];
let destinationMarker = null;
let routingControl = null;
let lastInstruction = "";
let ttsEnabled = true;
let isLocked = false; // Följa spelarens position
let isCompassLocked = false; // Kartan roterar med mobilen

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
  turnIcon: document.getElementById('turn-icon')
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
  html: '<img src="player.png" id="player-img" style="width:32px;height:32px;transform-origin:center;transition:transform 0.1s;">',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const player = L.marker([0, 0], { icon: playerIcon, zIndexOffset: 1000 }).addTo(map);

// KOMPASS / ROTATION
let currentHeading = 0;
let deviceOrientationEnabled = false;

async function requestOrientation() {
  if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission === 'granted') enableOrientation();
    } catch (e) {}
  } else {
    enableOrientation();
  }
}

function enableOrientation() {
  if (deviceOrientationEnabled) return;
  deviceOrientationEnabled = true;
  
  window.addEventListener('deviceorientation', (e) => {
    let heading = e.webkitCompassHeading || (360 - e.alpha);
    if (heading !== null && !isNaN(heading)) {
      currentHeading = heading;
      updateMapRotation();
    }
  });
}

function updateMapRotation() {
  const img = document.getElementById('player-img');
  if (!img) return;
  
  if (isCompassLocked) {
    // KARTAN ROTERAR - spelaren pekar alltid uppåt!
    // Rotera kartan så att "framåt" (heading) pekar uppåt
    map.setBearing(currentHeading);
    // Spelar-ikonen pekar alltid upp (0 grader)
    img.style.transform = `rotate(0deg)`;
    // Uppdatera turn-ikonen också
    els.turnIcon.style.transform = `rotate(0deg)`;
  } else {
    // KARTAN ÄR STILL - spelaren roterar
    map.setBearing(0);
    img.style.transform = `rotate(${currentHeading}deg)`;
    els.turnIcon.style.transform = `rotate(${currentHeading}deg)`;
  }
}

document.addEventListener('click', requestOrientation, { once: true });

// LÅSKNAPP (följa spelarens position)
els.lockBtn.addEventListener('click', () => {
  isLocked = !isLocked;
  els.lockBtn.textContent = isLocked ? '🔒' : '🔓';
  els.lockBtn.classList.toggle('locked', isLocked);
  
  if (isLocked && currentPos[0] !== 0) {
    map.setView(currentPos, 17);
    speak("Kartan låst på position");
  } else {
    speak("Kartan upplåst");
  }
});

// KOMPASSKNAPP (lås kartan till mobilens rotation)
els.compassBtn.addEventListener('click', () => {
  isCompassLocked = !isCompassLocked;
  els.compassBtn.classList.toggle('locked', isCompassLocked);
  
  if (isCompassLocked) {
    // Aktivera kompass-läge
    speak("Kompass låst. Kartan roterar med mobilen.");
    // Se till att orientation är aktiv
    if (!deviceOrientationEnabled) {
      requestOrientation();
    }
  } else {
    speak("Kompass upplåst.");
    // Återställ kartan
    map.setBearing(0);
  }
  
  updateMapRotation();
});

// ÖVRIGA KNAPPAR
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
  els.instruction.textContent = "Navigering avbruten";
  els.street.textContent = "Klicka för nytt mål";
  els.etaTime.textContent = "--:--";
  els.etaMin.textContent = "--";
  els.etaKm.textContent = "--";
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

// Sätt mål
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
    
    const now = new Date();
    const arrival = new Date(now.getTime() + summary.totalTime * 1000);
    els.etaTime.textContent = arrival.toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'});
    els.etaMin.textContent = Math.round(summary.totalTime / 60);
    els.etaKm.textContent = (summary.totalDistance / 1000).toFixed(1);
    
    els.instruction.textContent = "Sväng höger om 100 meter";
    els.street.textContent = "Mot destinationen";
    
    speak(`Sväng höger om 100 meter. ${Math.round(summary.totalTime / 60)} minuter kvar.`);
  });
}

// GPS
navigator.geolocation.watchPosition(
  (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    currentPos = [lat, lon];
    player.setLatLng([lat, lon]);
    
    if (isLocked) {
      map.setView([lat, lon], 17);
    }
    
    if (destinationMarker && routingControl) {
      const dest = destinationMarker.getLatLng();
      calculateRoute([lat, lon], [dest.lat, dest.lng]);
    }
  },
  (err) => console.error(err),
  { enableHighAccuracy: true, maximumAge: 3000 }
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
