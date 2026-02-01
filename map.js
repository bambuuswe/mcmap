const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 1,
  maxZoom: 20
}).setView([0, 0], 17);

// Minecraft-terräng karta
L.tileLayer(
  "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  { maxZoom: 17 }
).addTo(map);

// State
let currentPos = [0, 0];
let currentHeading = 0;
let isLocked = false;
let destinationMarker = null;
let routingControl = null;

// UI refs
const els = {
  instruction: document.getElementById('instruction'),
  street: document.getElementById('street'),
  etaTime: document.getElementById('eta-time'),
  etaMin: document.getElementById('eta-min'),
  etaKm: document.getElementById('eta-km'),
  lockBtn: document.getElementById('lock-btn'),
  arrow: document.getElementById('turn-arrow')
};

// Player icon med rotation
const playerIcon = L.divIcon({
  className: 'player-marker',
  html: '<img src="player.png" id="player-img" style="width:36px;height:36px;image-rendering:pixelated;transform-origin:center;">',
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const player = L.marker([0, 0], { icon: playerIcon, zIndexOffset: 1000 }).addTo(map);

// Compass
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
  window.addEventListener('deviceorientation', (e) => {
    let heading = e.webkitCompassHeading || (360 - e.alpha);
    if (heading !== null) {
      currentHeading = heading;
      const img = document.getElementById('player-img');
      if (img) img.style.transform = `rotate(${heading}deg)`;
    }
  });
}

document.addEventListener('click', requestOrientation, { once: true });

// Lock button
els.lockBtn.addEventListener('click', () => {
  isLocked = !isLocked;
  els.lockBtn.classList.toggle('locked');
  els.lockBtn.textContent = isLocked ? '🔒' : '🔓';
  if (isLocked && currentPos[0] !== 0) {
    map.setView(currentPos, 17);
  }
});

// Side buttons
let soundEnabled = true;
document.getElementById('sound-btn').addEventListener('click', function() {
  soundEnabled = !soundEnabled;
  this.textContent = soundEnabled ? '🔊' : '🔇';
  this.style.opacity = soundEnabled ? '1' : '0.6';
});

document.getElementById('overview-btn').addEventListener('click', () => {
  if (destinationMarker) {
    const bounds = L.latLngBounds([currentPos], [destinationMarker.getLatLng()]);
    map.fitBounds(bounds, {padding: [50, 50]});
  }
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
  els.street.textContent = "Klicka på kartan för mål";
  els.etaTime.textContent = "--:--";
  els.etaMin.textContent = "--";
  els.etaKm.textContent = "--";
});

// Share
document.getElementById('share-btn').addEventListener('click', () => {
  const time = els.etaTime.textContent;
  if (time !== '--:--') {
    if (navigator.share) {
      navigator.share({ text: `Jag ankommer ${time} med Minecraft Map!` });
    } else {
      alert(`Ankomst: ${time}`);
    }
  }
});

// Set destination
map.on('click', (e) => {
  if (isLocked) {
    els.lockBtn.style.animation = 'shake 0.5s';
    setTimeout(() => els.lockBtn.style.animation = '', 500);
    return;
  }
  
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  
  if (destinationMarker) map.removeLayer(destinationMarker);
  if (routingControl) map.removeControl(routingControl);
  
  // Röd pixel-marker (Minecraft style)
  destinationMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: 'destination-marker',
      html: '<div style="width:20px;height:20px;background:#ff4444;border:3px solid #000;box-shadow:2px 2px 0 rgba(0,0,0,0.5);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    })
  }).addTo(map);
  
  if (currentPos[0] !== 0) {
    calculateRoute(currentPos, [lat, lng]);
  } else {
    els.instruction.textContent = "Väntar på GPS...";
  }
});

function calculateRoute(from, to) {
  if (routingControl) map.removeControl(routingControl);
  
  routingControl = L.Routing.control({
    waypoints: [L.latLng(from[0], from[1]), L.latLng(to[0], to[1])],
    routeWhileDragging: false,
    show: false,
    lineOptions: {
      styles: [{
        color: '#4caf50',
        weight: 8,
        opacity: 1,
        dashArray: '10, 5',
        lineCap: 'square'
      }]
    },
    createMarker: () => null
  }).addTo(map);
  
  routingControl.on('routesfound', (e) => {
    const route = e.routes[0];
    const summary = route.summary;
    
    // Update UI
    const now = new Date();
    const arrival = new Date(now.getTime() + summary.totalTime * 1000);
    els.etaTime.textContent = arrival.toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'});
    els.etaMin.textContent = Math.round(summary.totalTime / 60);
    els.etaKm.textContent = (summary.totalDistance / 1000).toFixed(1);
    
    // Turn instruction (simulated)
    els.instruction.textContent = "Sväng höger om 150m";
    els.street.textContent = "Mot skogsstigen";
    els.arrow.textContent = "➡️";
    
    if (soundEnabled) {
      // Vibration för feedback
      if (navigator.vibrate) navigator.vibrate(50);
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

// Add shake animation
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateY(0); }
    25% { transform: translateY(-5px); }
    75% { transform: translateY(5px); }
  }
`;
document.head.appendChild(style);
