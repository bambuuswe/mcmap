const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 16,
  maxZoom: 16
}).setView([0, 0], 16);

/*
  ↓↓↓ VIKTIG DEL ↓↓↓
  Carto Voyager ger tydliga gröna block
  som CSS sen gör fyrkantiga
*/
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
  { maxZoom: 19 }
).addTo(map);

// PIXLIG VIT DIAMANT (position)
const playerIcon = L.icon({
  iconUrl: "player.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const player = L.marker([0, 0], {
  icon: playerIcon
}).addTo(map);

// GPS
navigator.geolocation.watchPosition(
  pos => {
    const { latitude, longitude } = pos.coords;
    player.setLatLng([latitude, longitude]);
    map.setView([latitude, longitude]);
  },
  err => alert("GPS error"),
  { enableHighAccuracy: true }
);
