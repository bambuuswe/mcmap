// Initiera kartan
const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 1,
  maxZoom: 20
}).setView([0, 0], 17);

// Minecraft-aktig karta - OpenStreetMap funkar bäst med filters
L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { maxZoom: 19 }
).addTo(map);

// ===== SPELARE (GPS) =====
const playerIcon = L.icon({
  iconUrl: "player.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: 'player-icon-img'
});

const player = L.marker([0, 0], { icon: playerIcon }).addTo(map);
let currentPos = [0, 0];

// ===== KARTNÅLAR & ROUTING =====
let destinationMarker = null;
let routingControl = null;

// Skapa custom pin-ikon (röd Minecraft-liknande)
const pinIcon = L.divIcon({
  className: 'custom-pin',
  html: '📍',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

// Klicka för att sätta ut nål
map.on('click', function(e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  
  // Ta bort gammal nål om det finns
  if (destinationMarker) {
    map.removeLayer(destinationMarker);
  }
  if (routingControl) {
    map.removeControl(routingControl);
  }
  
  // Sätt ut ny nål
  destinationMarker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmNDQyMiI+PHBhdGggZD0iTTEyIDJDOC4xMyAyIDUgNS4xMyA1IDljMCA1LjI1IDcgMTMgNyAxM3M3LTcuNzUgNy0xM2MwLTMuODctMy4xMy03LTctN3ptMCA5LjVjLTEuMzggMC0yLjUtMS4xMi0yLjUtMi41czEuMTItMi41IDIuNS0yLjUgMi41IDEuMTIgMi41IDIuNS0xLjEyIDIuNS0yLjUgMi41eiIvPjwvc3ZnPg==', // Röd pin som base64
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      className: 'destination-icon'
    })
  }).addTo(map).bindPopup("Mål: " + lat.toFixed(5) + ", " + lng.toFixed(5));
  
  // Om vi har GPS-position, räkna ut väg dit
  if (currentPos[0] !== 0) {
    createRoute(currentPos, [lat, lng]);
  } else {
    document.getElementById('route-info').innerHTML = 
      "📍 Mål satt! Väntar på GPS-signal...";
  }
});

// Skapa vägbeskrivning
function createRoute(from, to) {
  // Ta bort gammal route
  if (routingControl) {
    map.removeControl(routingControl);
  }
  
  // Skapa ny routing
  routingControl = L.Routing.control({
    waypoints: [
      L.latLng(from[0], from[1]),
      L.latLng(to[0], to[1])
    ],
    routeWhileDragging: false,
    show: false, // Döljer instruktioner, vi visar egen info
    lineOptions: {
      styles: [{ 
        color: '#ff6b35', 
        weight: 4, 
        opacity: 0.8,
        dashArray: '10, 10'
      }]
    },
    createMarker: function() { return null; } // Inga extra markörer från router
  }).addTo(map);
  
  // När rutten är beräknad, visa info
  routingControl.on('routesfound', function(e) {
    const routes = e.routes;
    const summary = routes[0].summary;
    const distance = (summary.totalDistance / 1000).toFixed(1); // km
    const time = Math.round(summary.totalTime / 60); // minuter
    
    document.getElementById('route-info').innerHTML = 
      `🎯 Mål: ${distance} km bort<br>⏱️ ${time} min promenad`;
  });
}

// Räkna ut fågelvägen (om routing inte funkar)
function updateStraightLineDistance(to) {
  const fromLatLng = L.latLng(currentPos[0], currentPos[1]);
  const toLatLng = L.latLng(to[0], to[1]);
  const distance = fromLatLng.distanceTo(toLatLng); // meter
  
  document.getElementById('route-info').innerHTML = 
    `📍 Mål satt!<br>📏 ${(distance/1000).toFixed(2)} km fågelvägen<br>🎮 Följ punkten!`;
}

// ===== GPS TRACKING =====
navigator.geolocation.watchPosition(
  pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    currentPos = [lat, lon];
    
    player.setLatLng([lat, lon]);
    map.setView([lat, lon], 17);
    
    // Om vi har ett mål, uppdatera vägbeskrivningen
    if (destinationMarker && routingControl) {
      const dest = destinationMarker.getLatLng();
      createRoute([lat, lon], [dest.lat, dest.lng]);
    }
  },
  err => {
    console.error("GPS error:", err);
    document.getElementById('route-info').innerHTML = "⚠️ GPS-fel!";
  },
  { enableHighAccuracy: true, maximumAge: 10000 }
);

// Fallback om GPS inte finns
if (!navigator.geolocation) {
  document.getElementById('route-info').innerHTML = "⚠️ Ingen GPS tillgänglig";
}
