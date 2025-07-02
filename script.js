// Initialize map centered on Pampanga with appropriate zoom
let map = L.map('map').setView([15.0794, 120.6200], 11);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Pampanga municipalities data
const pampangaMunicipalities = [
    {
        name: "Angeles City",
        coords: [15.14336011, 120.59051810],
        rainfall: 45,
        condition: "Heavy Rain",
        icon: "⛈️",
        type: "extreme"
    },
    {
        name: "Apalit",
        coords: [14.94997653, 120.75675619],
        rainfall: 22,
        condition: "Moderate Rain",
        icon: "🌧️",
        type: "moderate"
    },
    {
        name: "Arayat",
        coords: [15.16593002, 120.78159403],
        rainfall: 28,
        condition: "Moderate Rain",
        icon: "🌧️",
        type: "moderate"
    },
    {
        name: "Bacolor",
        coords: [15.03378028, 120.62071385],
        rainfall: 38,
        condition: "Heavy Rain",
        icon: "⛈️",
        type: "heavy"
    },
    {
        name: "Candaba",
        coords: [15.10580611, 120.87269784],
        rainfall: 18,
        condition: "Light Rain",
        icon: "🌦️",
        type: "light"
    },
    {
        name: "Floridablanca",
        coords: [14.93617972, 120.48914087],
        rainfall: 41,
        condition: "Heavy Rain",
        icon: "⛈️",
        type: "heavy"
    },
    {
        name: "Guagua",
        coords: [14.9661957, 120.63310490],
        rainfall: 35,
        condition: "Heavy Rain",
        icon: "⛈️",
        type: "heavy"
    },
    {
        name: "Lubao",
        coords: [14.90217987, 120.55094493],
        rainfall: 12,
        condition: "Light Rain",
        icon: "🌦️",
        type: "light"
    },
    {
        name: "Mabalacat",
        coords: [15.22089063, 120.57105409],
        rainfall: 33,
        condition: "Heavy Rain",
        icon: "⛈️",
        type: "heavy"
    },
    {
        name: "Macabebe",
        coords: [14.91324103, 120.67347402],
        rainfall: 19,
        condition: "Light Rain",
        icon: "🌦️",
        type: "light"
    },
    {
        name: "Magalang",
        coords: [15.2478282, 120.68086630],
        rainfall: 42,
        condition: "Heavy Rain",
        icon: "⛈️",
        type: "heavy"
    },
    {
        name: "Masantol",
        coords: [14.85194769, 120.67746495],
        rainfall: 15,
        condition: "Light Rain",
        icon: "🌦️",
        type: "light"
    },
    {
        name: "Mexico",
        coords: [15.06633515, 120.71217193],
        rainfall: 25,
        condition: "Moderate Rain",
        icon: "🌧️",
        type: "moderate"
    },
    {
        name: "Minalin",
        coords: [14.95365406, 120.70039268],
        rainfall: 21,
        condition: "Moderate Rain",
        icon: "🌧️",
        type: "moderate"
    },
    {
        name: "Porac",
        coords: [15.1241602, 120.45899588],
        rainfall: 52,
        condition: "Extreme Rain",
        icon: "⛈️",
        type: "extreme"
    },
    {
        name: "San Fernando",
        coords: [15.05961285, 120.65646538],
        rainfall: 36,
        condition: "Heavy Rain",
        icon: "⛈️",
        type: "heavy"
    },
    {
        name: "San Luis",
        coords: [15.01880145, 120.81164009],
        rainfall: 17,
        condition: "Light Rain",
        icon: "🌦️",
        type: "light"
    },
    {
        name: "San Simon",
        coords: [14.9940879, 120.77563412],
        rainfall: 23,
        condition: "Moderate Rain",
        icon: "🌧️",
        type: "moderate"
    },
    {
        name: "Santa Ana",
        coords: [15.10942466, 120.77008266],
        rainfall: 29,
        condition: "Moderate Rain",
        icon: "🌧️",
        type: "moderate"
    },
    {
        name: "Santa Rita",
        coords: [15.00866765, 120.60767406],
        rainfall: 31,
        condition: "Heavy Rain",
        icon: "⛈️",
        type: "heavy"
    },
    {
        name: "Santo Tomas",
        coords: [15.00884912, 120.71039539],
        rainfall: 26,
        condition: "Moderate Rain",
        icon: "🌧️",
        type: "moderate"
    },
    {
        name: "Sasmuan",
        coords: [14.88693929, 120.61290981],
        rainfall: 14,
        condition: "Light Rain",
        icon: "🌦️",
        type: "light"
    }
];

let weatherMarkers = [];
let showingWeatherLayer = true;

// Track selected municipality for forecast
let selectedMunicipality = pampangaMunicipalities[0];

// Custom icon function
function createWeatherIcon(municipality) {
    return L.divIcon({
        className: 'weather-marker',
        html: `<div style="background: ${getColorForType(municipality.type)}; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${municipality.icon}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

function getColorForType(type) {
    switch(type) {
        case 'extreme': return '#FF4444';
        case 'heavy': return '#FF8800';
        case 'moderate': return '#4A9EFF';
        case 'light': return '#88CC88';
        default: return '#88CC88';
    }
}

// Add weather markers to map
function addWeatherMarkers() {
    pampangaMunicipalities.forEach(municipality => {
        const marker = L.marker(municipality.coords, {
            icon: createWeatherIcon(municipality)
        }).addTo(map);

        marker.bindPopup(`
            <div class="weather-popup">
                <h3>${municipality.name}</h3>
                <p><strong>${municipality.rainfall} mm</strong></p>
                <p>${municipality.condition}</p>
                <p style="font-size: 24px;">${municipality.icon}</p>
            </div>
        `);

        // Update main weather card when marker is clicked
        marker.on('click', function() {
            updateWeatherCard(municipality);
        });

        weatherMarkers.push(marker);
    });
}

// Fetch rainfall data from OpenMeteo API for all municipalities
async function fetchRainfallData() {
    const promises = pampangaMunicipalities.map(async (municipality) => {
        const lat = municipality.coords[0];
        const lon = municipality.coords[1];
        // Fetch daily precipitation sum for the next 7 days
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,weathercode&timezone=auto`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.daily && data.daily.precipitation_sum && data.daily.precipitation_sum.length > 0) {
                const rainfall = Math.round(data.daily.precipitation_sum[0]);
                municipality.rainfall = rainfall;
                // Update type, condition, and icon based on rainfall
                if (rainfall >= 40) {
                    municipality.type = "extreme";
                    municipality.condition = "Extreme Rain";
                    municipality.icon = "⛈️";
                } else if (rainfall >= 30) {
                    municipality.type = "heavy";
                    municipality.condition = "Heavy Rain";
                    municipality.icon = "⛈️";
                } else if (rainfall >= 20) {
                    municipality.type = "moderate";
                    municipality.condition = "Moderate Rain";
                    municipality.icon = "🌧️";
                } else {
                    municipality.type = "light";
                    municipality.condition = "Light Rain";
                    municipality.icon = "🌦️";
                }
                // Store 7-day forecast
                municipality.forecast = [];
                for (let i = 0; i < data.daily.precipitation_sum.length; i++) {
                    municipality.forecast.push({
                        date: data.daily.time[i],
                        rain: Math.round(data.daily.precipitation_sum[i]),
                        weathercode: data.daily.weathercode ? data.daily.weathercode[i] : null
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to fetch data for ${municipality.name}:`, error);
        }
    });
    await Promise.all(promises);
}

// Helper to get day of week from date string
function getDayOfWeek(dateString) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = new Date(dateString);
    return days[d.getDay()];
}

// Helper to get weather icon from weathercode (OpenMeteo)
function getWeatherIcon(weathercode) {
    // Basic mapping for demo; you can expand this for more codes
    if (weathercode === 95 || weathercode === 96 || weathercode === 99) return '⛈️'; // Thunderstorm
    if (weathercode >= 80 && weathercode <= 82) return '🌧️'; // Rain showers
    if (weathercode >= 60 && weathercode <= 67) return '🌧️'; // Rain
    if (weathercode >= 51 && weathercode <= 57) return '🌦️'; // Drizzle
    if (weathercode >= 1 && weathercode <= 3) return '🌤️'; // Partly cloudy
    return '☀️'; // Default: clear
}

// Update forecast section for selected municipality and selected day
function updateForecastSection(municipality, dayIndex = 0) {
    const forecastList = document.querySelector('.forecast-list');
    if (!municipality.forecast || municipality.forecast.length === 0) return;
    // Show the next 7 days (skip today for forecast, or show all 7)
    let html = '';
    for (let i = 1; i < Math.min(7, municipality.forecast.length); i++) {
        const f = municipality.forecast[i];
        html += `<div class="forecast-item">
            <div class="forecast-icon">${getWeatherIcon(f.weathercode)}</div>
            <div class="forecast-details">
                <div class="forecast-rain">${f.rain} mm</div>
                <div class="forecast-date">${new Date(f.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
            </div>
            <div class="forecast-day">${getDayOfWeek(f.date)}</div>
        </div>`;
    }
    // Special item for selected day
    const selectedForecast = municipality.forecast[dayIndex];
    if (selectedForecast) {
        let label = '';
        if (dayIndex === 0) label = 'Today';
        else if (dayIndex === 1) label = 'Tomorrow';
        else label = getDayOfWeek(selectedForecast.date);
        html += `<div class="forecast-item tomorrow-special">
            <div class="forecast-icon">${getWeatherIcon(selectedForecast.weathercode)}</div>
            <div class="forecast-details">
                <div class="tomorrow-text">${label}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 2px;">${selectedForecast.rain} mm</div>
                <div class="tomorrow-desc">${municipality.condition}</div>
            </div>
        </div>`;
    }
    forecastList.innerHTML = html;
}

// Update weather card with selected municipality data and selected day
function updateWeatherCard(municipality, dayIndex = 0) {
    selectedMunicipality = municipality;
    let rainfall = municipality.rainfall;
    let icon = municipality.icon;
    let condition = municipality.condition;
    let dateText = `${municipality.name}, Pampanga`;
    let dateDisplay = '';
    if (municipality.forecast && municipality.forecast.length > dayIndex) {
        const forecast = municipality.forecast[dayIndex];
        rainfall = forecast.rain;
        icon = getWeatherIcon(forecast.weathercode);
        // Optionally, you can map weathercode to a condition string
        condition = municipality.condition;
        dateDisplay = new Date(forecast.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    document.querySelector('.rainfall-amount').textContent = `${rainfall} mm Rainfall`;
    document.querySelector('.weather-status span:last-child').textContent = condition;
    document.querySelector('.location-date span:last-child').textContent = dateText;
    document.querySelector('.weather-icon-large').textContent = icon;
    if (dateDisplay) {
        // Update the date display in the weather card
        const dateSpans = document.querySelectorAll('.location-date span:last-child');
        if (dateSpans.length > 1) {
            dateSpans[1].textContent = dateDisplay;
        }
    }
    updateForecastSection(municipality, dayIndex);
}

// Toggle weather layer visibility
function toggleWeatherLayer() {
    if (showingWeatherLayer) {
        weatherMarkers.forEach(marker => map.removeLayer(marker));
        showingWeatherLayer = false;
    } else {
        weatherMarkers.forEach(marker => map.addLayer(marker));
        showingWeatherLayer = true;
    }
}

// Listen for day dropdown changes
const dayDropdown = document.querySelector('.day-dropdown');
dayDropdown.addEventListener('change', function() {
    // Dropdown is reversed: Day 7 is index 6, Day 1 is index 0
    const selectedIndex = 6 - this.selectedIndex;
    updateWeatherCard(selectedMunicipality, selectedIndex);
});

// In municipality selector, update forecast and reset day dropdown when changing selection
const municipalitySelect = document.getElementById('municipalitySelect');
municipalitySelect.addEventListener('change', function() {
    const selectedValue = this.value;
    let municipality = pampangaMunicipalities[0];
    if (selectedValue !== 'all') {
        const found = pampangaMunicipalities.find(m => 
            m.name.toLowerCase().replace(' ', '-') === selectedValue ||
            m.name.toLowerCase().includes(selectedValue.replace('-', ' '))
        );
        if (found) municipality = found;
    }
    // Reset dropdown to Day 1 (today)
    dayDropdown.selectedIndex = 6;
    updateWeatherCard(municipality, 0);
    // Zoom map to selected municipality or reset to Pampanga view
    if (selectedValue !== 'all') {
        map.setView(municipality.coords, 13); // Adjust zoom level as needed
        // Show popup for selected municipality
        const marker = weatherMarkers.find(marker => {
            const latlng = marker.getLatLng();
            return latlng.lat === municipality.coords[0] && latlng.lng === municipality.coords[1];
        });
        if (marker) marker.openPopup();
    } else {
        map.setView([15.0794, 120.6200], 11); // Default Pampanga view
    }
});

// More accurate Pampanga province boundary
const pampangaBounds = [
    [15.35, 120.40],  // Northwest
    [15.35, 120.95],  // Northeast
    [14.80, 120.95],  // Southeast
    [14.80, 120.40],  // Southwest
    [15.35, 120.40]   // Close the polygon
];

L.polygon(pampangaBounds, {
    color: '#4A9EFF',
    weight: 3,
    fillOpacity: 0.05,
    dashArray: '10, 5'
}).addTo(map);

// Set map bounds to restrict view to Pampanga area
const southWest = L.latLng(14.75, 120.35);
const northEast = L.latLng(15.4, 121.0);
const bounds = L.latLngBounds(southWest, northEast);

// Set max bounds to keep the map focused on Pampanga
map.setMaxBounds(bounds);
map.setMinZoom(10);
map.setMaxZoom(16);

// Initialize markers
addWeatherMarkers();

// Interactive functionality for forecast items
document.querySelectorAll('.forecast-item').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('.forecast-item').forEach(i => i.style.background = '');
        this.style.background = 'rgba(79, 172, 254, 0.1)';
    });
});

// Show loading spinner
function showLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'flex';
}
// Hide loading spinner
function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'none';
}

// On page load, show spinner, fetch data, then hide spinner after update
showLoadingSpinner();
fetchRainfallData().then(() => {
    // Remove old markers
    weatherMarkers.forEach(marker => map.removeLayer(marker));
    weatherMarkers = [];
    // Add updated markers
    addWeatherMarkers();
    // Update main weather card with Angeles City and today
    const angeles = pampangaMunicipalities.find(m => m.name === "Angeles City");
    updateWeatherCard(angeles || pampangaMunicipalities[0], 0);
    hideLoadingSpinner();
});

// Auto-update weather data every 5 minutes
setInterval(fetchRainfallData, 300000); 