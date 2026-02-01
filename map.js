const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 1,
  maxZoom: 20
}).setView([0, 0], 17);

// PLATT karta som pixeliseras snyggt
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  { maxZoom: 19 }
).addTo(map);

// PIXLIG VIT DIAMANT (player.png)
const playerIcon = L.icon({
  iconUrl: "player.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const player = L.marker([0, 0], { icon: playerIcon }).addTo(map);

// GPS
navigator.geolocation.watchPosition(
  pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    player.setLatLng([lat, lon]);
    map.setView([lat, lon]);
  },
  err => alert("GPS error"),
  { enableHighAccuracy: true }
);
