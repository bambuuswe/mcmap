// Initiera kartan
const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 1,
  maxZoom: 20,
  zoomSnap: 0.1  // Smidigare zoom
}).setView([0, 0], 17);

// Karta
L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { maxZoom: 19 }
).addTo(map);

// ===== STATUS =====
let currentPos = [0, 0];
let currentHeading = 0; // Gradantal
let isLocked = false;   // Följer kartan spelaren?
let destinationMarker = null;
let routingControl = null;

// ===== SPELARE MED ROTATION =====
// Vi skapar en custom div för att kunna rotera bilden
const playerIcon = L.divIcon({
  className: 'player-marker',
  html: '<img src="player.png" id="player-img" style="width:32px;height:32px;image-rendering:pixelated;">',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const player = L.marker([0, 0], { icon: playerIcon, zIndexOffset: 1000 }).addTo(map);

// ===== KOMPASS / ROTATION =====
function updateRotation(heading) {
  // heading är i grader (0-360)
  const img = document.getElementById('player-img');
  if (img) {
    img.style.transform = `rotate(${heading}deg)`;
    img.style.transformOrigin = 'center center';
  }
}

// iOS 13+ kräver permission
async function requestOrientationPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission === 'granted') {
        enableOrientation();
      }
    } catch (e) {
      console.log("Permission denied");
    }
  } else {
    enableOrientation(); // Android eller äldre iOS
  }
}

function enableOrientation() {
  window.addEventListener('deviceorientation', (event) => {
    let heading = event.alpha; // 0-360 grader
    
    // iOS Webkit har compassHeading
    if (event.webkitCompassHeading) {
      heading = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
      // Android: konvertera alpha till kompassriktning
      heading = 360 - event.alpha;
    }
    
    if (heading !== null && !isNaN(heading)) {
      currentHeading = heading;
      updateRotation(heading);
    }
  });
}

// Fråga om permission vid första klick (krävs för iOS)
document.addEventListener('click', () => {
  requestOrientationPermission();
}, { once: true });

// Fallback: Om ingen kompass finns, använd rörelsens riktning mellan GPS-punkter
let lastPos = null;
function calculateHeadingFromGPS(newPos) {
  if (!lastPos) {
    lastPos = newPos;
    return;
  }
  
  const lat1 = lastPos[0] * Math.PI / 180;
  const lat2 = newPos[0] * Math.PI / 180;
  const lon1 = lastPos[1] * Math.PI / 180;
  const lon2 = newPos[1] * Math.PI / 180;
  
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  
  const heading = Math.atan2(y, x) * 180 / Math.PI;
  currentHeading = (heading + 360) % 360;
  updateRotation(currentHeading);
  
  lastPos = newPos;
}

// ===== LÅS-KNAPPEN =====
const lockBtn = document.getElementById('lock-btn');
const info = document.getElementById('route-info');

lockBtn.addEventListener('click', () => {
  isLocked = !isLocked;
  if (isLocked) {
    lockBtn.classList.add('locked');
    lockBtn.innerHTML = '🔒';
    info.innerHTML = '🔒 Låst på spelaren';
    // Centrera direkt
    if (currentPos[0] !== 0) {
      map.setView(currentPos, 17);
    }
  } else {
    lockBtn.classList.remove('locked');
    lockBtn.innerHTML = '🔓';
    info.innerHTML = '🔓 Fritt läge • Klicka för mål';
  }
});

// ===== KARTNÅLAR =====
const pinIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmNDQyMiI+PHBhdGggZD0iTTEyIDJDOC4xMyAyIDUgNS4xMyA1IDljMCA1LjI1IDcgMTMgNyAxM3M3LTcuNzUgNy0xM2MwLTMuODctMy4xMy03LTctN3ptMCA5LjVjLTEuMzggMC0yLjUtMS4xMi0yLjUtMi41czEuMTItMi41IDIuNS0yLjUgMi41IDEuMTIgMi41IDIuNS0xLjEyIDIuNS0yLjUgMi41eiIvPjwvc3ZnPg==',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  className: 'destination-icon'
});

map.on('click', function(e) {
  if (isLocked) {
    info.innerHTML = '🔒 Lås upp först! (Tryck 🔒)';
    return;
  }
  
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  
  if (destinationMarker) map.removeLayer(destinationMarker);
  if (routingControl) map.removeControl(routingControl);
  
  destinationMarker = L.marker([lat, lng], { icon: pinIcon })
    .addTo(map)
    .bindPopup("Mål");
  
  if (currentPos[0] !== 0) {
    createRoute(currentPos, [lat, lng]);
  }
});

function createRoute(from, to) {
  if (routingControl) map.removeControl(routingControl);
  
  routingControl = L.Routing.control({
    waypoints: [L.latLng(from[0], from[1]), L.latLng(to[0], to[1])],
    routeWhileDragging: false,
    show: false,
    lineOptions: {
      styles: [{ color: '#ff6b35', weight: 4, opacity: 0.8, dashArray: '10, 10' }]
    },
    createMarker: () => null
  }).addTo(map);
  
  routingControl.on('routesfound', function(e) {
    const summary = e.routes[0].summary;
    const dist = (summary.totalDistance / 1000).toFixed(1);
    const time = Math.round(summary.totalTime / 60);
    info.innerHTML = isLocked ? 
      `🔒 ${dist}km • ${time}min` : 
      `📍 ${dist}km • ${time}min • 🔓 för att panorera`;
  });
}

// ===== GPS TRACKING =====
navigator.geolocation.watchPosition(
  pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    currentPos = [lat, lon];
    
    // Fallback: Om ingen kompass, räkna ut från GPS-rörelse
    if (!window.DeviceOrientationEvent) {
      calculateHeadingFromGPS([lat, lon]);
    }
    
    player.setLatLng([lat, lon]);
    
    // Om låst, följ spelaren
    if (isLocked) {
      map.setView([lat, lon], 17);
    }
    
    // Uppdatera route om det finns mål
    if (destinationMarker && routingControl) {
      const dest = destinationMarker.getLatLng();
      createRoute([lat, lon], [dest.lat, dest.lng]);
    }
  },
  err => console.error("GPS error:", err),
  { enableHighAccuracy: true, maximumAge: 5000 }
);
