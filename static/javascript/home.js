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

        this.pampangaMunicipalities = this.getStaticMunicipalityData();
        this.updateMarkers();
        this.updateInitialWeatherCard();
        
        // Uncomment below to use API
        // await this.fetchAndUpdateWeatherData();
        // this.startAutoUpdate();
    }
    
    // Cache frequently used DOM elements
    cacheDOMElements() {
        this.domElements = {
            // Main weather panel elements
            day: document.querySelector('.day'),
            time: document.querySelector('.time'),
            weatherIcon: document.querySelector('.weather-status-icon'),
            rainfallAmount: document.querySelector('.rainfall-amt'),
            rainfallType: document.querySelector('.rainfall-type span'),
            location: document.querySelector('.location span'),
            date: document.querySelector('.date span'),
            
            // Small panels for forecast
            smallPanels: document.querySelectorAll('.panel-small'),
            
            // Dropdown for municipality selection
            municipalityOptions: document.querySelectorAll('.options input[type="radio"]'),
            selectedDisplay: document.querySelector('.selected')
        };
    }
    
    // Initialize map with optimized settings
    setupMap() {
        this.map = L.map('map', {
            center: [15.0794, 120.6200],
            zoom: 5,
            minZoom: 10,
            maxZoom: 16,
            zoomControl: true,
            attributionControl: true
        });
        
        // Add tile layer with error handling
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OSM &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
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
            color: '#D9D9D9',
            weight: 2,
            fillOpacity: 0.05,
            dashArray: '10, 5'
        }).addTo(this.map);
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Municipality dropdown change
        this.domElements.municipalityOptions?.forEach(option => {
            option.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.handleMunicipalityChange(e.target.id);
                }
            });
        });
        
        // Weather panel hover effects
        this.addInteractiveEffects();
    }
    
    // Add interactive effects to UI elements
    addInteractiveEffects() {
        // Weather panel hover effects
        document.querySelectorAll('.panel-big, .panel-small').forEach(panel => {
            panel.addEventListener('mouseenter', () => {
                panel.style.transform = 'translateY(-8px) scale(1.03)';
                panel.style.boxShadow = '0 8px 25px rgba(3, 87, 116, 0.5)';
            });
            
            panel.addEventListener('mouseleave', () => {
                panel.style.transform = 'translateY(0) scale(1)';
                panel.style.boxShadow = panel.classList.contains('panel-big') ? 
                    '0 4px 15px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.4)';
            });
        });
        
        // Navigation effects
        document.querySelectorAll('.navbar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                link.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    link.style.transform = 'scale(1)';
                }, 150);
            });
        });
    }
    
    // Handle municipality selection change
    handleMunicipalityChange(selectedOptionId) {
        let municipality = this.pampangaMunicipalities[0]; // Default to first municipality
        
        if (selectedOptionId === 'all') {
            // Show all municipalities view
            this.map.setView([15.0794, 120.6200], 11);
            municipality = this.pampangaMunicipalities.find(m => m.name === "Porac") || this.pampangaMunicipalities[0];
        } else {
            // Find specific municipality
            const optionIndex = parseInt(selectedOptionId.replace('option-', ''));
            const municipalityNames = [
                "San Fernando", "Bacolor", "Santa Rita", "Guagua", "Sasmuan", "Lubao",
                "Floridablanca", "Porac", "Angeles City", "Mabalacat", "Magalang", "Arayat",
                "Candaba", "San Luis", "San Simon", "Apalit", "Masantol", "Macabebe",
                "Minalin", "Santo Tomas", "Mexico", "Santa Ana"
            ];
            
            const selectedName = municipalityNames[optionIndex - 1];
            municipality = this.pampangaMunicipalities.find(m => 
                m.name === selectedName || m.name.includes(selectedName)
            ) || municipality;
            
            // Center map on selected municipality
            this.map.setView(municipality.coords, 13);
            this.openMarkerPopup(municipality);
        }
        
        this.updateWeatherCard(municipality);
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
            marker.on('click', () => this.updateWeatherCard(municipality));
            
            this.weatherMarkers.push(marker);
        });
    }
    
    // Create weather icon for marker
    createWeatherIcon(municipality) {
        const iconPath = this.getIconPath(municipality.type);
        
        return L.divIcon({
            className: 'weather-marker',
            html: `<div style="background: #111; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 2px solid #6a778e; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                <img src="${iconPath}" style="width: 18px; height: 18px;" alt="${municipality.type}">
            </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }
    
    // Get icon path based on weather type
    getIconPath(type) {
        const iconMap = {
            'extreme': '/static/weather-icons/torrential.svg',
            'heavy': '/static/weather-icons/heavy.svg', 
            'moderate': '/static/weather-icons/moderate.svg',
            'light': '/static/weather-icons/logo.svg',
            'none': '/static/weather-icons/no-rain.svg'
        };
        return iconMap[type] || iconMap.light;
    }
    
    // Create popup content
    createPopupContent(municipality) {
        return `
            <div class="weather-popup" style="text-align: center; padding: 10px;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${municipality.name}</h3>
                <div style="font-size: 18px; font-weight: bold; color: #005280;">${municipality.rainfall}mm Rainfall</div>
                <div style="color: #666; margin: 5px 0;">${municipality.condition}</div>
                <img src="${this.getIconPath(municipality.type)}" style="width: 32px; height: 32px; margin-top: 5px;" alt="${municipality.type}">
            </div>
        `;
    }
    
    // Update weather card with selected municipality data
    updateWeatherCard(municipality) {
        this.selectedMunicipality = municipality;
        this.updateBackgroundGradient(municipality.type);
        
        const now = new Date();
        const today = now.toLocaleDateString('en-US', { weekday: 'long' });
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const date = now.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
        
        // Update main weather panel
        this.updateDOMElement(this.domElements.day, today);
        this.updateDOMElement(this.domElements.time, time);
        this.updateDOMElement(this.domElements.rainfallAmount, `${municipality.rainfall}mm Rainfall`);
        this.updateDOMElement(this.domElements.rainfallType, municipality.condition);
        this.updateDOMElement(this.domElements.location, `${municipality.name}, Pampanga`);
        this.updateDOMElement(this.domElements.date, date);
        
        // Update main weather icon
        if (this.domElements.weatherIcon) {
            this.domElements.weatherIcon.src = this.getIconPath(municipality.type);
        }
        
        // Update forecast panels with sample data
        this.updateForecastPanels(municipality);
    }
    
    // Update forecast panels (small panels)
    updateForecastPanels(municipality) {
        const forecastData = this.generateForecastData(municipality);
        // Start from tomorrow
        const allDays = ['Sun','Mon','Tue','Wed','Thur','Fri','Sat'];
        const todayIndex = new Date().getDay(); // 0 = Sunday ... 6 = Saturday
        const rotatedDays = [];

        for (let i = 1; i <= 6; i++) {
            rotatedDays.push(allDays[(todayIndex + i) % 7]);
        }

        this.domElements.smallPanels?.forEach((panel, index) => {
            if (index < forecastData.length) {
                const forecast = forecastData[index];
                
                const dayElement = panel.querySelector('.day-small');
                const iconElement = panel.querySelector('.weather-status-icon-small');
                const rainfallElement = panel.querySelector('.rainfall-amt');
                const typeElement = panel.querySelector('.rainfall-type-small span');
                
                this.updateDOMElement(dayElement, rotatedDays[index]);
                this.updateDOMElement(rainfallElement, `${forecast.rainfall}mm`);
                this.updateDOMElement(typeElement, forecast.condition);
                
                if (iconElement) {
                    iconElement.src = this.getIconPath(forecast.type);
                }
            }
        });
    }
    
    // Generate sample forecast data
    generateForecastData(municipality) {
        const baseRainfall = municipality.rainfall;
        const forecasts = [];
        
        for (let i = 0; i < 6; i++) {
            const variation = (Math.random() - 0.5) * 20; // ±10mm variation
            const rainfall = Math.max(0, Math.round(baseRainfall + variation));
            
            let type, condition;
            if (rainfall >= 30) {
                type = 'extreme';
                condition = 'Torrential';
            } else if (rainfall >= 20) {
                type = 'heavy';
                condition = 'Heavy';
            } else if (rainfall >= 10) {
                type = 'moderate';
                condition = 'Moderate';
            } else if (rainfall > 0) {
                type = 'light';
                condition = 'Light';
            } else {
                type = 'none';
                condition = 'No Rain';
            }
            
            forecasts.push({ rainfall, type, condition });
        }
        
        return forecasts;
    }
    
    // Update DOM element safely
    updateDOMElement(element, content) {
        if (element) element.textContent = content;
    }
    
    // Update initial weather card
    updateInitialWeatherCard() {
        const porac = this.pampangaMunicipalities.find(m => m.name === "Porac");
        this.updateWeatherCard(porac || this.pampangaMunicipalities[0]);
    }
    
    // Show loading state
    showLoadingState() {
        this.updateDOMElement(this.domElements.rainfallAmount, 'Loading...');
        this.updateDOMElement(this.domElements.rainfallType, '');
        this.updateDOMElement(this.domElements.location, '');
    }
    
    // Get static municipality data (replace with API call when ready)
    getStaticMunicipalityData() {
        return [
            { name: "Angeles City", coords: [15.14336011, 120.59051810], rainfall: 45, condition: "Heavy Rain", type: "extreme" },
            { name: "Apalit", coords: [14.94997653, 120.75675619], rainfall: 22, condition: "Moderate Rain", type: "moderate" },
            { name: "Arayat", coords: [15.16593002, 120.78159403], rainfall: 28, condition: "Moderate Rain", type: "moderate" },
            { name: "Bacolor", coords: [15.03378028, 120.62071385], rainfall: 38, condition: "Heavy Rain", type: "heavy" },
            { name: "Candaba", coords: [15.10580611, 120.87269784], rainfall: 18, condition: "Light Rain", type: "light" },
            { name: "Floridablanca", coords: [14.93617972, 120.48914087], rainfall: 41, condition: "Heavy Rain", type: "heavy" },
            { name: "Guagua", coords: [14.9661957, 120.63310490], rainfall: 35, condition: "Heavy Rain", type: "heavy" },
            { name: "Lubao", coords: [14.90217987, 120.55094493], rainfall: 12, condition: "Light Rain", type: "light" },
            { name: "Mabalacat", coords: [15.22089063, 120.57105409], rainfall: 33, condition: "Heavy Rain", type: "heavy" },
            { name: "Macabebe", coords: [14.91324103, 120.67347402], rainfall: 19, condition: "Light Rain", type: "light" },
            { name: "Magalang", coords: [15.2478282, 120.68086630], rainfall: 42, condition: "Heavy Rain", type: "heavy" },
            { name: "Masantol", coords: [14.85194769, 120.67746495], rainfall: 15, condition: "Light Rain", type: "light" },
            { name: "Mexico", coords: [15.06633515, 120.71217193], rainfall: 25, condition: "Moderate Rain", type: "moderate" },
            { name: "Minalin", coords: [14.95365406, 120.70039268], rainfall: 21, condition: "Moderate Rain", type: "moderate" },
            { name: "Porac", coords: [15.1241602, 120.45899588], rainfall: 33, condition: "Heavy Rain", type: "heavy" },
            { name: "San Fernando", coords: [15.05961285, 120.65646538], rainfall: 25, condition: "Intense", type: "heavy" },
            { name: "San Luis", coords: [15.01880145, 120.81164009], rainfall: 17, condition: "Light Rain", type: "light" },
            { name: "San Simon", coords: [14.9940879, 120.77563412], rainfall: 23, condition: "Moderate Rain", type: "moderate" },
            { name: "Santa Ana", coords: [15.10942466, 120.77008266], rainfall: 29, condition: "Moderate Rain", type: "moderate" },
            { name: "Santa Rita", coords: [15.00866765, 120.60767406], rainfall: 31, condition: "Heavy Rain", type: "heavy" },
            { name: "Santo Tomas", coords: [15.00884912, 120.71039539], rainfall: 26, condition: "Moderate Rain", type: "moderate" },
            { name: "Sasmuan", coords: [14.88693929, 120.61290981], rainfall: 14, condition: "Light Rain", type: "light" }
        ];
    }
    
    // Fetch weather data from API (currently disabled, using static data)
    async fetchAndUpdateWeatherData() {
        this.showLoadingState();
        try {
            const response = await fetch(this.BACKEND_WEATHER_API_URL);
            const processedData = await response.json();
            console.log('Successfully fetched weather data:', processedData);
            
            this.pampangaMunicipalities = processedData;
            this.updateMarkers();
            this.updateInitialWeatherCard();
            
        } catch (error) {
            console.error('Failed to fetch weather data from backend:', error);
            // Fallback to static data
            this.pampangaMunicipalities = this.getStaticMunicipalityData();
            this.updateMarkers();
            this.updateInitialWeatherCard();
        }
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

    updateBackgroundGradient(type) {
        const gradients = {
            extreme: ["#2c3e50", "#000000", "#1a252f", "#434343"], // Torrential/Extreme
            heavy: ["#1e3c72", "#2a5298", "#4e8bb5", "#9bbcd9"],   // Heavy Rain
            moderate: ["#00c6ff", "#0072ff", "#5dade2", "#85c1e9"], // Moderate Rain
            light: ["#6dd5ed", "#2193b0", "#a1c4fd", "#c2e9fb"],   // Light Rain
            none: ["#fbc2eb", "#a6c1ee", "#f5f7fa", "#cfd9df"]     // No Rain
        };

        const colors = gradients[type] || gradients.light;

        const root = document.documentElement;
        root.style.setProperty("--gradient-color-1", colors[0]);
        root.style.setProperty("--gradient-color-2", colors[1]);
        root.style.setProperty("--gradient-color-3", colors[2]);
        root.style.setProperty("--gradient-color-4", colors[3]);

        console.log(`🌈 Gradient updated for weather type: ${type}`, colors);
    }
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