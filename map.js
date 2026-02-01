const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  zoomSnap: 1
}).setView([0, 0], 16);

// OpenStreetMap tiles (pixel-art look via CSS)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

// Spelare-markör
const playerIcon = L.divIcon({
  className: "player",
  html: "🟩",
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

let playerMarker = L.marker([0, 0], { icon: playerIcon }).addTo(map);

// Geolocation
if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      playerMarker.setLatLng([lat, lon]);
      map.setView([lat, lon], 16);
    },
    (err) => {
      console.error(err);
      alert("Kunde inte hämta position 😢");
    },
    {
      enableHighAccuracy: true
    }
  );
} else {
  alert("Geolocation stöds inte i din browser");
}
