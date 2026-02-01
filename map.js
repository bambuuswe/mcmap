const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 1,
  maxZoom: 20
}).setView([0, 0], 17);

// BYT TILL TERRÄNG/GRÖN KARTA istället för light_all
// Alternativ 1: OpenStreetMap (fler detaljer, mer färg)
L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { 
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }
).addTo(map);

// Alternativ 2 (om du vill ha MER grönt/mindre detaljer):
// L.tileLayer(
//   "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
//   { maxZoom: 17 }
// ).addTo(map);

// SPELARIKON - se till att den är pixelerad och centrerad
const playerIcon = L.icon({
  iconUrl: "player.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16], // Centrerad under spelaren
  popupAnchor: [0, -16]
});

const player = L.marker([0, 0], { icon: playerIcon }).addTo(map);

// Lägg till "Axaren" som ett område (polygon) om du vill markera det
// (kopiera koordinater från din nuvarande vy)
const axarenCoords = [
  [0.001, -0.001],
  [0.001, 0.001],
  [-0.001, 0.001],
  [-0.001, -0.001]
];

/* Avkommentera om du vill markera Axaren:
L.polygon(axarenCoords, {
  color: '#4a90e2',
  fillColor: '#4a90e2',
  fillOpacity: 0.3,
  weight: 2
}).addTo(map).bindPopup("Axaren");
*/

// GPS-tracking
navigator.geolocation.watchPosition(
  pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    player.setLatLng([lat, lon]);
    map.setView([lat, lon], 17); // Behåll zoom-nivå 17
  },
  err => alert("GPS error: " + err.message),
  { enableHighAccuracy: true }
);

// Klicka på kartan för att se koordinater (bra för debugging!)
map.on('click', function(e) {
  console.log("Lat: " + e.latlng.lat + ", Lon: " + e.latlng.lng);
});
