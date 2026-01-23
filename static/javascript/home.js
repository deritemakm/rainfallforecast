// Weather Map Application - Optimized Version
class WeatherMap {
    constructor() {
        this.map = null;
        this.weatherMarkers = [];
        this.showingWeatherLayer = true;
        this.selectedMunicipality = null;
        this.updateInterval = null;
        
        this.pampangaMunicipalities = []
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

        this.updateMarkers();
        
        // Uncomment below to use API
        await this.fetchAndUpdateWeatherData();
        this.startAutoUpdate();
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
                const href = link.getAttribute('href');
                // prevent immediate navigation so animation can play
                e.preventDefault();
                link.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    link.style.transform = 'scale(1)';
                    // navigate after animation completes
                    if (href) {
                        window.location.href = href;
                    }
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
            municipality = this.pampangaMunicipalities.find(m => m.name === "San Fernando") || this.pampangaMunicipalities[0];
        } else {
            // Find specific municipality
            const optionIndex = parseInt(selectedOptionId.replace('option-', ''));
            const municipalityNames = [
                "San Fernando", "Bacolor", "Santa Rita", "Guagua", "Sasmuan", "Lubao",
                "Floridablanca", "Porac", "Angeles", "Mabalacat", "Magalang", "Arayat",
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
            'extreme': '/static/weather-icon/torrential-rain.svg',
            'heavy': '/static/weather-icon/heavy-rain.svg', 
            'moderate': '/static/weather-icon/moderate-rain.svg',
            'light': '/static/weather-icon/light-rain.svg',
            'none': '/static/weather-icon/no-rain.svg'
        };
        return iconMap[type] || iconMap.light;
    }
    
    // Create popup content
    createPopupContent(municipality) {
        return `
            <div class="weather-popup" style="text-align: center; padding: 10px;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${municipality.name}</h3>
                <div style="font-size: 18px; font-weight: bold; color: #005280;">${Math.round(municipality.rainfall)}mm Rainfall</div>
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
        this.updateDOMElement(this.domElements.rainfallAmount, `${Math.round(municipality.rainfall)}mm Rainfall`);
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
        const fullForecast = municipality.forecast || [];
    
        // Use the 14-day forecast and show the first 7 days (index 0 to 6)
        const displayForecast = fullForecast.slice(1, 7); // Days 2 to 7 (6 days for the small panels)
       
        const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
        const todayIndex = new Date().getDay(); // 0 = Sunday ... 6 = Saturday
    
        this.domElements.smallPanels?.forEach((panel, index) => {
            if (index < displayForecast.length) {
                const forecast = displayForecast[index];
    
                // Calculate day name starting from tomorrow for the first panel
                const dayOfWeekIndex = (todayIndex + index + 1) % 7;
                const dayName = allDays[dayOfWeekIndex];
                
                const dayElement = panel.querySelector('.day-small');
                const iconElement = panel.querySelector('.weather-status-icon-small');
                const rainfallElement = panel.querySelector('.rainfall-amt');
                const typeElement = panel.querySelector('.rainfall-type-small span');
                
                this.updateDOMElement(dayElement, dayName);
                this.updateDOMElement(rainfallElement, `${Math.round(forecast.rain)}mm`); 
                this.updateDOMElement(typeElement, forecast.condition);
                
                if (iconElement) {
                    iconElement.src = this.getIconPath(forecast.type);
                }
            }
        });
    }
    
    // Update DOM element safely
    updateDOMElement(element, content) {
        if (element) element.textContent = content;
    }
    
    // Update initial weather card
    updateInitialWeatherCard() {
        const sanFernando = this.pampangaMunicipalities.find(m => m.name === "San Fernando");
        this.updateWeatherCard(sanFernando || this.pampangaMunicipalities[0]);
    }
    
    // Show loading state
    showLoadingState() {
        this.updateDOMElement(this.domElements.rainfallAmount, 'Loading...');
        this.updateDOMElement(this.domElements.rainfallType, '');
        this.updateDOMElement(this.domElements.location, '');
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
            console.error('Failed to fetch weather data from backend. Falling back to empty state.', error);

            this.pampangaMunicipalities = []; // Set to empty array on failure
            this.updateMarkers();
            this.showLoadingState('Forecast Unavailable');
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
            extreme: ["#2c3e50", "#000000", "#1a252f", "#434343"],
            heavy: ["#1e3c72", "#2a5298", "#4e8bb5", "#9bbcd9"],
            moderate: ["#00c6ff", "#0072ff", "#5dade2", "#85c1e9"],
            light: ["#6dd5ed", "#2193b0", "#a1c4fd", "#c2e9fb"],
            none: ["#fbc2eb", "#a6c1ee", "#f5f7fa", "#cfd9df"]
        };

        const colors = gradients[type] || gradients.light;
        const root = document.documentElement;
        root.style.setProperty("--gradient-color-1", colors[0]);
        root.style.setProperty("--gradient-color-2", colors[1]);
        root.style.setProperty("--gradient-color-3", colors[2]);
        root.style.setProperty("--gradient-color-4", colors[3]);

        console.log(`🌈 Gradient updated for weather type: ${type}`, colors);

        // 🔁 Refresh gradient animation
        if (window.gradient) {
            window.gradient.sectionColors = colors.map(c => normalizeColor(parseInt(c.replace('#', '0x'))));
            window.gradient.material = window.gradient.initMaterial();
        }
    }
}

// Initialize the weather map application
let weatherMapApp;

// Collapsible map legend toggle
document.addEventListener('DOMContentLoaded', () => {
    const legend = document.querySelector('.map-legend.collapsible');
    const header = legend.querySelector('.legend-header');
    const icon = header.querySelector('i');

    header.addEventListener('click', () => {
        legend.classList.toggle('collapsed');
        feather.replace(); // update the chevron icon direction
    });
});

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