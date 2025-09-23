// Initialize map
const map = L.map('map').setView([15.0794, 120.6194], 10); 
// Pampanga center coords (approx)

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

// Example marker (San Fernando City Hall)
L.marker([15.0342, 120.6844]).addTo(map)
  .bindPopup('<b>San Fernando</b><br>Pampanga Capital')
  .openPopup();
