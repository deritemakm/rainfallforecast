// Weather Map Application - Optimized Version
class WeatherMap {
    constructor() {
        this.map = null;
        this.weatherMarkers = [];
        this.showingWeatherLayer = true;
        this.selectedMunicipality = null;
        this.updateInterval = null;
        
        // Constants
        this.BATCH_SIZE = 5;
        this.UPDATE_INTERVAL = 300000; // 5 minutes
        this.BACKEND_WEATHER_API_URL = 'http://127.0.0.1:8000/api/weather-data';
        
        // Cache DOM elements
        this.domElements = {};
        
        this.init();
    }
    
    // Initialize the application
    async init() {
        this.setupMap();
        this.cacheDOMElements();
        this.setupEventListeners();
        this.setupProvinceBoundary();
        this.showLoadingState();
        
        await this.fetchAndUpdateWeatherData();
        this.startAutoUpdate();
    }
    
    // Cache frequently used DOM elements
    cacheDOMElements() {
        this.domElements = {
            rainfallAmount: document.querySelector('.rainfall-amount'),
            weatherStatus: document.querySelector('.weather-status span:last-child'),
            locationDate: document.querySelector('.location-date span:last-child'),
            weatherIcon: document.querySelector('.weather-icon-large'),
            forecastList: document.querySelector('.forecast-list'),
            dayDropdown: document.querySelector('.day-dropdown'),
            municipalitySelect: document.getElementById('municipalitySelect'),
            dateSpans: document.querySelectorAll('.location-date span:last-child')
        };
    }
    
    // Initialize map with optimized settings
    setupMap() {
        this.map = L.map('map', {
            center: [15.0794, 120.6200],
            zoom: 11,
            minZoom: 10,
            maxZoom: 16,
            zoomControl: true,
            attributionControl: true
        });
        
        // Add tile layer with error handling
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);
        
        // Set map bounds
        const bounds = L.latLngBounds(
            L.latLng(14.75, 120.35),
            L.latLng(15.4, 121.0)
        );
        this.map.setMaxBounds(bounds);
    }
    
    // Setup province boundary
    setupProvinceBoundary() {
        const pampangaBounds = [
            [15.35, 120.40], [15.35, 120.95], [14.80, 120.95], 
            [14.80, 120.40], [15.35, 120.40]
        ];
        
        L.polygon(pampangaBounds, {
            color: '#4A9EFF',
            weight: 3,
            fillOpacity: 0.05,
            dashArray: '10, 5'
        }).addTo(this.map);
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Day dropdown change
        this.domElements.dayDropdown?.addEventListener('change', (e) => {
            const selectedIndex = 6 - e.target.selectedIndex;
            this.updateForecastSection(this.selectedMunicipality, selectedIndex);
        });
        
        // Municipality selector change
        this.domElements.municipalitySelect?.addEventListener('change', (e) => {
            this.handleMunicipalityChange(e.target.value);
        });
        
        // Add interactive effects
        this.addInteractiveEffects();
    }
    
    // Add interactive effects to UI elements
    addInteractiveEffects() {
        // Weather cell hover effects
        document.querySelectorAll('.weather-cell').forEach(cell => {
            cell.addEventListener('mouseenter', () => {
                cell.style.transform = 'scale(1.05)';
                cell.style.transition = 'transform 0.2s ease';
            });
            
            cell.addEventListener('mouseleave', () => {
                cell.style.transform = 'scale(1)';
            });
        });
        
        // Navigation icon click effects
        document.querySelectorAll('.nav-icon').forEach(icon => {
            icon.addEventListener('click', () => {
                icon.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    icon.style.transform = 'scale(1)';
                }, 150);
            });
        });
    }
    
    // Handle municipality selection change
    handleMunicipalityChange(selectedValue) {
        let municipality = this.pampangaMunicipalities[0];
        
        if (selectedValue !== 'all') {
            municipality = this.pampangaMunicipalities.find(m => 
                m.name.toLowerCase().replace(' ', '-') === selectedValue ||
                m.name.toLowerCase().includes(selectedValue.replace('-', ' '))
            ) || municipality;
        }
        
        // Reset dropdown to Day 1
        if (this.domElements.dayDropdown) {
            this.domElements.dayDropdown.selectedIndex = 6;
        }
        
        this.updateWeatherCardCurrentOnly(municipality);
        this.updateMapView(selectedValue, municipality);
    }
    
    // Update map view based on selection
    updateMapView(selectedValue, municipality) {
        if (selectedValue !== 'all') {
            this.map.setView(municipality.coords, 13);
            this.openMarkerPopup(municipality);
        } else {
            this.map.setView([15.0794, 120.6200], 11);
        }
    }
    
    // Open popup for specific municipality marker
    openMarkerPopup(municipality) {
        const marker = this.weatherMarkers.find(marker => {
            const latlng = marker.getLatLng();
            return Math.abs(latlng.lat - municipality.coords[0]) < 0.001 && 
                   Math.abs(latlng.lng - municipality.coords[1]) < 0.001;
        });
        if (marker) marker.openPopup();
    }
    
    // Reimplemented with fastapi server
    async fetchAndUpdateWeatherData() {
        this.showLoadingState();
        try {
            const response = await fetch(this.BACKEND_WEATHER_API_URL);
            
            const processedData = await response.json(); // This will be the array of municipalities
            console.log('Successfully fetched and parsed data:', processedData);

            this.pampangaMunicipalities = processedData;

            this.updateMarkers();
            this.updateInitialWeatherCard();

        } catch (error) {
            console.error('Failed to fetch weather data from backend:', error);
            this.showErrorState();
        } 
    }
    
    // Update markers on map
    updateMarkers() {
        this.clearMarkers();
        this.addWeatherMarkers();
    }
    
    // Clear existing markers
    clearMarkers() {
        this.weatherMarkers.forEach(marker => this.map.removeLayer(marker));
        this.weatherMarkers = [];
    }
    
    // Add weather markers to map
    addWeatherMarkers() {
        this.pampangaMunicipalities.forEach(municipality => {
            const marker = L.marker(municipality.coords, {
                icon: this.createWeatherIcon(municipality)
            }).addTo(this.map);
            
            marker.bindPopup(this.createPopupContent(municipality));
            marker.on('click', () => this.updateWeatherCardCurrentOnly(municipality));
            
            this.weatherMarkers.push(marker);
        });
    }
    
    // Create weather icon for marker
    createWeatherIcon(municipality) {
        const color = this.getColorForType(municipality.type);
        return L.divIcon({
            className: 'weather-marker',
            html: `<div style="background: ${color}; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${municipality.icon}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }
    
    // Get color for weather type
    getColorForType(type) {
        const colors = {
            extreme: '#FF4444',
            heavy: '#FF8800',
            moderate: '#4A9EFF',
            light: '#88CC88'
        };
        return colors[type] || colors.light;
    }
    
    // Create popup content
    createPopupContent(municipality) {
        return `
            <div class="weather-popup">
                <h3>${municipality.name}</h3>
                <p><strong>${municipality.rainfall} mm</strong></p>
                <p>${municipality.condition}</p>
                <p style="font-size: 24px;">${municipality.icon}</p>
            </div>
        `;
    }
    
    // Update weather card with current weather only
    updateWeatherCardCurrentOnly(municipality) {
        this.selectedMunicipality = municipality;
        
        const todayDate = new Date().toLocaleDateString(undefined, { 
            month: 'short', day: 'numeric', year: 'numeric' 
        });
        
        // Update DOM elements
        this.updateDOMElement(this.domElements.rainfallAmount, `${municipality.rainfall} mm Rainfall`);
        this.updateDOMElement(this.domElements.weatherStatus, municipality.condition);
        this.updateDOMElement(this.domElements.locationDate, `${municipality.name}, Pampanga`);
        this.updateDOMElement(this.domElements.weatherIcon, municipality.icon);
        
        // Update date spans
        if (this.domElements.dateSpans.length > 1) {
            this.domElements.dateSpans[1].textContent = todayDate;
        }
        
        this.updateForecastSection(municipality, 0);
    }
    
    // Update DOM element safely
    updateDOMElement(element, content) {
        if (element) element.textContent = content;
    }
    
    // Update forecast section
    updateForecastSection(municipality, dayIndex = 0) {
        if (!municipality.forecast?.length || !this.domElements.forecastList) return;
        
        let html = this.generateForecastItems(municipality);
        html += this.generateSelectedDayItem(municipality, dayIndex);
        
        this.domElements.forecastList.innerHTML = html;
        this.addForecastInteractivity();
    }
    
    // Generate forecast items HTML
    generateForecastItems(municipality) {
        let html = '';
        for (let i = 1; i < Math.min(7, municipality.forecast.length); i++) {
            const forecast = municipality.forecast[i];
            const date = new Date(forecast.date);
            
            html += `
                <div class="forecast-item">
                    <div class="forecast-icon">${this.getWeatherIcon(forecast.weathercode)}</div>
                    <div class="forecast-details">
                        <div class="forecast-rain">${forecast.rain} mm</div>
                        <div class="forecast-date">${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <div class="forecast-day">${this.getDayOfWeek(forecast.date)}</div>
                </div>
            `;
        }
        return html;
    }
    
    // Generate selected day item HTML
    generateSelectedDayItem(municipality, dayIndex) {
        const selectedForecast = municipality.forecast[dayIndex];
        if (!selectedForecast) return '';
        
        const labels = ['Today', 'Tomorrow'];
        const label = labels[dayIndex] || this.getDayOfWeek(selectedForecast.date);
        
        return `
            <div class="forecast-item tomorrow-special">
                <div class="forecast-icon">${this.getWeatherIcon(selectedForecast.weathercode)}</div>
                <div class="forecast-details">
                    <div class="tomorrow-text">${label}</div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 2px;">${selectedForecast.rain} mm</div>
                    <div class="tomorrow-desc">${municipality.condition}</div>
                </div>
            </div>
        `;
    }
    
    // Add interactivity to forecast items
    addForecastInteractivity() {
        document.querySelectorAll('.forecast-item').forEach(item => {
            item.addEventListener('click', function() {
                document.querySelectorAll('.forecast-item').forEach(i => i.style.background = '');
                this.style.background = 'rgba(79, 172, 254, 0.1)';
            });
        });
    }
    
    // Get day of week from date string
    getDayOfWeek(dateString) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[new Date(dateString).getDay()];
    }
    
    // Get weather icon from weather code
    getWeatherIcon(weathercode) {
        if (weathercode >= 95) return '⛈️'; // Thunderstorm
        if (weathercode >= 80) return '🌧️'; // Rain showers
        if (weathercode >= 60) return '🌧️'; // Rain
        if (weathercode >= 51) return '🌦️'; // Drizzle
        if (weathercode >= 1) return '🌤️'; // Partly cloudy
        return '☀️'; // Clear
    }
    
    // Update initial weather card
    updateInitialWeatherCard() {
        const angeles = this.pampangaMunicipalities.find(m => m.name === "Angeles City");
        this.updateWeatherCardCurrentOnly(angeles || this.pampangaMunicipalities[0]);
    }
    
    // Show loading state
    showLoadingState() {
        this.updateDOMElement(this.domElements.rainfallAmount, 'Loading...');
        this.updateDOMElement(this.domElements.weatherStatus, '');
        this.updateDOMElement(this.domElements.locationDate, '');
        this.updateDOMElement(this.domElements.weatherIcon, '');
        if (this.domElements.forecastList) {
            this.domElements.forecastList.innerHTML = '<div style="color:white;padding:10px;">Loading forecast...</div>';
        }
    }
    
    // Show error state
    showErrorState() {
        this.updateDOMElement(this.domElements.rainfallAmount, 'Error loading data');
        this.updateDOMElement(this.domElements.weatherStatus, 'Please try again');
    }
    
    // Start auto-update interval
    startAutoUpdate() {
        this.updateInterval = setInterval(() => {
            this.fetchAndUpdateWeatherData();
        }, this.UPDATE_INTERVAL);
    }
    
    // Stop auto-update interval
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    // Toggle weather layer visibility
    toggleWeatherLayer() {
        if (this.showingWeatherLayer) {
            this.weatherMarkers.forEach(marker => this.map.removeLayer(marker));
        } else {
            this.weatherMarkers.forEach(marker => this.map.addLayer(marker));
        }
        this.showingWeatherLayer = !this.showingWeatherLayer;
    }
    
    // Cleanup method
    destroy() {
        this.stopAutoUpdate();
        this.clearMarkers();
        if (this.map) {
            this.map.remove();
        }
    }
    
    // Pampanga municipalities data
    pampangaMunicipalities = [
        { name: "Angeles City", coords: [15.14336011, 120.59051810], rainfall: 45, condition: "Heavy Rain", icon: "⛈️", type: "extreme" },
        { name: "Apalit", coords: [14.94997653, 120.75675619], rainfall: 22, condition: "Moderate Rain", icon: "🌧️", type: "moderate" },
        { name: "Arayat", coords: [15.16593002, 120.78159403], rainfall: 28, condition: "Moderate Rain", icon: "🌧️", type: "moderate" },
        { name: "Bacolor", coords: [15.03378028, 120.62071385], rainfall: 38, condition: "Heavy Rain", icon: "⛈️", type: "heavy" },
        { name: "Candaba", coords: [15.10580611, 120.87269784], rainfall: 18, condition: "Light Rain", icon: "🌦️", type: "light" },
        { name: "Floridablanca", coords: [14.93617972, 120.48914087], rainfall: 41, condition: "Heavy Rain", icon: "⛈️", type: "heavy" },
        { name: "Guagua", coords: [14.9661957, 120.63310490], rainfall: 35, condition: "Heavy Rain", icon: "⛈️", type: "heavy" },
        { name: "Lubao", coords: [14.90217987, 120.55094493], rainfall: 12, condition: "Light Rain", icon: "🌦️", type: "light" },
        { name: "Mabalacat", coords: [15.22089063, 120.57105409], rainfall: 33, condition: "Heavy Rain", icon: "⛈️", type: "heavy" },
        { name: "Macabebe", coords: [14.91324103, 120.67347402], rainfall: 19, condition: "Light Rain", icon: "🌦️", type: "light" },
        { name: "Magalang", coords: [15.2478282, 120.68086630], rainfall: 42, condition: "Heavy Rain", icon: "⛈️", type: "heavy" },
        { name: "Masantol", coords: [14.85194769, 120.67746495], rainfall: 15, condition: "Light Rain", icon: "🌦️", type: "light" },
        { name: "Mexico", coords: [15.06633515, 120.71217193], rainfall: 25, condition: "Moderate Rain", icon: "🌧️", type: "moderate" },
        { name: "Minalin", coords: [14.95365406, 120.70039268], rainfall: 21, condition: "Moderate Rain", icon: "🌧️", type: "moderate" },
        { name: "Porac", coords: [15.1241602, 120.45899588], rainfall: 52, condition: "Extreme Rain", icon: "⛈️", type: "extreme" },
        { name: "San Fernando", coords: [15.05961285, 120.65646538], rainfall: 36, condition: "Heavy Rain", icon: "⛈️", type: "heavy" },
        { name: "San Luis", coords: [15.01880145, 120.81164009], rainfall: 17, condition: "Light Rain", icon: "🌦️", type: "light" },
        { name: "San Simon", coords: [14.9940879, 120.77563412], rainfall: 23, condition: "Moderate Rain", icon: "🌧️", type: "moderate" },
        { name: "Santa Ana", coords: [15.10942466, 120.77008266], rainfall: 29, condition: "Moderate Rain", icon: "🌧️", type: "moderate" },
        { name: "Santa Rita", coords: [15.00866765, 120.60767406], rainfall: 31, condition: "Heavy Rain", icon: "⛈️", type: "heavy" },
        { name: "Santo Tomas", coords: [15.00884912, 120.71039539], rainfall: 26, condition: "Moderate Rain", icon: "🌧️", type: "moderate" },
        { name: "Sasmuan", coords: [14.88693929, 120.61290981], rainfall: 14, condition: "Light Rain", icon: "🌦️", type: "light" }
    ];
}

// Initialize the weather map application
let weatherMapApp;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    weatherMapApp = new WeatherMap();
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (weatherMapApp) {
        weatherMapApp.destroy();
    }
});