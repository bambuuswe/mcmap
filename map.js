const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 1,
  maxZoom: 20,
  zoomSnap: 0.1
}).setView([0, 0], 17);

// BYT TILL TOPO-KARTA istället - mycket bättre för skogs-look!
// Denna visar verkliga höjdlinjer och skogar som ser ut som Minecraft-terräng
L.tileLayer(
  "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  { 
    maxZoom: 17,
    attribution: '© OpenTopoMap'
  }
).addTo(map);

// Om opentopomap är för mörk/långsam, testa denna istället:
// L.tileLayer(
//   "https://{s}.tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=YOUR_API_KEY",
//   { maxZoom: 18 }
// ).addTo(map);

// ===== STATUS =====
let currentPos = [0, 0];
let currentHeading = 0;
let isLocked = false;
let destinationMarker = null;
let routingControl = null;

// ===== SPELARIKON med rotation =====
const playerIcon = L.divIcon({
  className: 'player-marker',
  html: '<img src="player.png" id="player-img" style="width:32px;height:32px;image-rendering:pixelated;">',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const player = L.marker([0, 0], { icon: playerIcon, zIndexOffset: 1000 }).addTo(map);

// ===== KOMPASS =====
function updateRotation(heading) {
  const img = document.getElementById('player-img');
  if (img) {
    // Rotera bilden runt mitten
    img.style.transform = `rotate(${heading}deg)`;
    img.style.transformOrigin = 'center center';
  }
}

async function requestOrientationPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission === 'granted') enableOrientation();
    } catch (e) {
      console.log("Orientation permission denied");
    }
  } else {
    enableOrientation();
  }
}

function enableOrientation() {
  window.addEventListener('deviceorientation', (event) => {
    let heading = event.alpha;
    
    if (event.webkitCompassHeading) {
      heading = event.webkitCompassHeading; // iOS
    } else if (event.alpha !== null) {
      heading = 360 - event.alpha; // Android
    }
    
    if (heading !== null && !isNaN(heading)) {
      currentHeading = heading;
      updateRotation(heading);
    }
  });
}

document.addEventListener('click', requestOrientationPermission, { once: true });

// ===== LÅS-KNAPP =====
const lockBtn = document.getElementById('lock-btn');
const info = document.getElementById('route-info');

function updateInfo(text) {
  info.innerHTML = text;
}

lockBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Förhindra att kartan klickas
  isLocked = !isLocked;
  
  if (isLocked) {
    lockBtn.classList.add('locked');
    lockBtn.innerHTML = '🔒';
    updateInfo('🔒 Följer spelaren...');
    if (currentPos[0] !== 0) {
      map.setView(currentPos, 17);
    }
  } else {
    lockBtn.classList.remove('locked');
    lockBtn.innerHTML = '🔓';
    updateInfo('🔓 Fritt läge • Klicka för mål');
  }
});

// ===== KARTNÅLAR =====
const pinIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmNDQyMiI+PHBhdGggZD0iTTEyIDJDOC4xMyAyIDUgNS4xMyA1IDljMCA1LjI1IDcgMTMgNyAxM3M3LTcuNzUgNy0xM2MwLTMuODctMy4xMy03LTctN3ptMCA5LjVjLTEuMzggMC0yLjUtMS4xMi0yLjUtMi41czEuMTItMi41IDIuNS0yLjUgMi41IDEuMTIgMi41IDIuNS0xLjEyIDIuNS0yLjUgMi41eiIvPjwvc3ZnPg==',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  className: 'destination-icon'
});

map.on('click', function(e) {
  if (isLocked) {
    updateInfo('🔒 Lås upp först! (Tryck 🔒)');
    // Skaka knappen visuellt
    lockBtn.style.transform = 'translateY(-50%) scale(1.2)';
    setTimeout(() => {
      lockBtn.style.transform = 'translateY(-50%) scale(1)';
    }, 200);
    return;
  }
  
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  
  if (destinationMarker) map.removeLayer(destinationMarker);
  if (routingControl) map.removeControl(routingControl);
  
  destinationMarker = L.marker([lat, lng], { icon: pinIcon })
    .addTo(map)
    .bindPopup("Mål: " + lat.toFixed(4) + ", " + lng.toFixed(4));
  
  if (currentPos[0] !== 0) {
    createRoute(currentPos, [lat, lng]);
  } else {
    updateInfo('📍 Mål satt! Väntar på GPS...');
  }
});

function createRoute(from, to) {
  if (routingControl) map.removeControl(routingControl);
  
  routingControl = L.Routing.control({
    waypoints: [L.latLng(from[0], from[1]), L.latLng(to[0], to[1])],
    routeWhileDragging: false,
    show: false,
    lineOptions: {
      styles: [{ 
        color: '#ff6b6b', 
        weight: 5, 
        opacity: 0.9,
        dashArray: '8, 8'
      }]
    },
    createMarker: () => null
  }).addTo(map);
  
  routingControl.on('routesfound', (e) => {
    const summary = e.routes[0].summary;
    const dist = (summary.totalDistance / 1000).toFixed(1);
    const time = Math.round(summary.totalTime / 60);
    updateInfo(`📍 ${dist} km • ⏱️ ${time} min`);
  });
}

// ===== GPS =====
let lastPos = null;

navigator.geolocation.watchPosition(
  (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    currentPos = [lat, lon];
    
    // Beräkna riktning från GPS om kompass saknas
    if (lastPos) {
      const lat1 = lastPos[0] * Math.PI / 180;
      const lat2 = lat * Math.PI / 180;
      const lon1 = lastPos[1] * Math.PI / 180;
      const lon2 = lon * Math.PI / 180;
      const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
      const heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      
      // Om vi inte har deviceOrientation, använd GPS-heading
      if (!window.DeviceOrientationEvent) {
        updateRotation(heading);
      }
    }
    lastPos = [lat, lon];
    
    player.setLatLng([lat, lon]);
    
    if (isLocked) {
      map.panTo([lat, lon]);
    }
    
    if (destinationMarker && routingControl) {
      const dest = destinationMarker.getLatLng();
      createRoute([lat, lon], [dest.lat, dest.lng]);
    }
  },
  (err) => {
    console.error("GPS error:", err);
    updateInfo('⚠️ GPS-fel!');
  },
  { enableHighAccuracy: true, maximumAge: 3000 }
);

// Initial text
updateInfo('🔓 Klicka för mål • Tryck 🔒 att följa');
