// Pampanga municipalities with coordinates
const pampangaMunicipalities = {
  "Angeles": [15.14336011, 120.59051810],
  "Apalit": [14.94997653, 120.75675619],
  "Arayat": [15.16593002, 120.78159403],
  "Bacolor": [15.03378028, 120.62071385],
  "Candaba": [15.10580611, 120.87269784],
  "Floridablanca": [14.93617972, 120.48914087],
  "Guagua": [14.9661957, 120.63310490],
  "Lubao": [14.90217987, 120.55094493],
  "Mabalacat": [15.22089063, 120.57105409],
  "Macabebe": [14.91324103, 120.67347402],
  "Magalang": [15.2478282, 120.68086630],
  "Masantol": [14.85194769, 120.67746495],
  "Mexico": [15.06633515, 120.71217193],
  "Minalin": [14.95365406, 120.70039268],
  "Porac": [15.1241602, 120.45899588],
  "San Fernando": [15.05961285, 120.65646538],
  "San Luis": [15.01880145, 120.81164009],
  "San Simon": [14.9940879, 120.77563412],
  "Santa Ana": [15.10942466, 120.77008266],
  "Santa Rita": [15.00866765, 120.60767406],
  "Santo Tomas": [15.00884912, 120.71039539],
  "Sasmuan": [14.88693929, 120.61290981]
};

// Global variable to store all fetched data
let allForecastData = [];
let selectedMunicipality = null;
let sliderIndex = 0; // current first visible card index
const CARDS_PER_VIEW = 5; // adjustable

// Rain classification
function classifyRain(mm) {
  if (mm === 0) return "No Rain";
  if (mm <= 60) return "Light";
  if (mm <= 180) return "Moderate";
  if (mm <= 360) return "Heavy";
  if (mm <= 720) return "Intense";
  return "Torrential";
}

// Chart initialization
function initCharts() {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#D9D9D9',
          font: { family: 'Inter', size: 12 }
        }
      }
    },
    animation: { duration: 2000, easing: 'easeInOutQuart' }
  };

  // Rainfall Chart
  const rainfallCtx = document.getElementById('rainfallChart').getContext('2d');
  window.rainfallChart = new Chart(rainfallCtx, {
    type: 'bar',
    data: {
      labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
      datasets: [{
        label: 'Rainfall (mm)',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: [
          'rgba(30, 60, 114, 0.8)',
          'rgba(30, 60, 114, 0.8)',
          'rgba(42, 82, 152, 0.8)',
          'rgba(78, 139, 181, 0.8)',
          'rgba(42, 82, 152, 0.8)',
          'rgba(30, 60, 114, 0.8)',
          'rgba(30, 60, 114, 0.8)'
        ],
        borderColor: [
          'rgba(30, 60, 114, 1)',
          'rgba(30, 60, 114, 1)',
          'rgba(42, 82, 152, 1)',
          'rgba(78, 139, 181, 1)',
          'rgba(42, 82, 152, 1)',
          'rgba(30, 60, 114, 1)',
          'rgba(30, 60, 114, 1)'
        ],
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: {
            color: '#D9D9D9',
            font: { family: 'Inter' },
            callback: value => value + 'mm'
          }
        },
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: '#D9D9D9', font: { family: 'Inter', size: 11 } }
        }
      }
    }
  });

  // Weather Conditions Chart
  const conditionsCtx = document.getElementById('conditionsChart').getContext('2d');
  window.conditionsChart = new Chart(conditionsCtx, {
    type: 'doughnut',
    data: {
      labels: ['No Rain', 'Light', 'Moderate', 'Heavy', 'Intense', 'Torrential'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        backgroundColor: [
          'rgba(217, 217, 217, 0.8)',
          'rgba(135, 206, 235, 0.8)',
          'rgba(255, 165, 0, 0.8)',
          'rgba(255, 99, 71, 0.8)',
          'rgba(220, 20, 60, 0.8)',
          'rgba(139, 0, 0, 1)'
        ],
        borderColor: [
          'rgba(217, 217, 217, 1)',
          'rgba(135, 206, 235, 1)',
          'rgba(255, 165, 0, 1)',
          'rgba(255, 99, 71, 1)',
          'rgba(220, 20, 60, 1)',
          'rgba(139, 0, 0, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#D9D9D9',
            font: { family: 'Inter', size: 11 },
            usePointStyle: true,
            padding: 15
          }
        }
      },
      animation: { duration: 2000, easing: 'easeInOutQuart' }
    }
  });
}

async function fetchData() {
  try {
    const res = await fetch('/api/weather-data');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    allForecastData = await res.json();
    console.log("Forecast data loaded:", allForecastData.length, "municipalities.");

    buildMunicipalitySlider();

    // After loading, ensure the initial display is correct
    const initialMuni = document.querySelector(".options input:checked") 
                       ? document.querySelector(".options input:checked").nextElementSibling.getAttribute("data-txt") 
                       : "Angeles";
    
    const initialRadio = document.querySelector(`label[data-txt="${initialMuni}"]`)?.previousElementSibling;

    if (initialRadio) {
      initialRadio.checked = true;
      // Use unified card selection so active styling & charts sync
      selectMunicipalityCard(initialMuni);
      // Center/ensure visibility in slider
      const track = document.getElementById('municipalityTrack');
      const card = track ? [...track.children].find(c=>c.getAttribute('data-muni')===initialMuni) : null;
      if(card){
        const idx = [...track.children].indexOf(card);
        sliderIndex = Math.min(Math.max(idx - Math.floor(CARDS_PER_VIEW/2),0), Math.max(0, track.children.length - CARDS_PER_VIEW));
        slide(0);
      }
    }
  } catch (e) {
    console.error("Failed to fetch forecast data from backend:", e);
  }
}

function getSevenDayTotal(forecastList){
  return forecastList.slice(0,7).reduce((acc,f)=>acc + (Number(f.rain)||0),0);
}

function rainTypeFromTotal(total){
  // reuse classification thresholds but scaled for cumulative 7-day; choose highest day classification instead
  if(total >= 140) return 'extreme'; // avg 20mm/day
  if(total >= 100) return 'heavy';
  if(total >= 60) return 'moderate';
  if(total >= 10) return 'light';
  return 'none';
}

function buildMunicipalitySlider(){
  const track = document.getElementById('municipalityTrack');
  if(!track) return;
  track.innerHTML = '';
  allForecastData.sort((a,b)=>a.name.localeCompare(b.name));
  allForecastData.forEach(m => {
    const total = getSevenDayTotal(m.forecast);
    const type = rainTypeFromTotal(total);
    // Compute 7-day average (use actual number of days available up to 7)
    const daysCount = Math.min(7, m.forecast.length);
    const avg = daysCount ? (total / daysCount) : 0;
    const card = document.createElement('div');
    card.className = 'muni-card';
    card.setAttribute('data-muni', m.name);
    card.innerHTML = `
      <div class="muni-name">${m.name}</div>
      <div class="total-rain-wrapper">
        <div class="total-rain">${Math.round(total)}<span class="unit">mm</span></div>
        <div class="card-tooltip">
          <i data-feather="info"></i>
          <span class="card-tooltip-text">Total rainfall amount per week</span>
        </div>
      </div>
      <div class="avg-rain" title="7-day average rainfall">${avg.toFixed(1)}<span class="unit"> Avg mm</span></div>
      <div class="rain-type-tag" data-type="${type}">${type.replace(/^(.)/,c=>c.toUpperCase())} Total</div>
    `;
    card.addEventListener('click', ()=>{
      selectMunicipalityCard(m.name);
    });
    track.appendChild(card);
  });
  // Replace feather icons for newly added cards
  if(typeof feather !== 'undefined') feather.replace();
  
  // Initial selection prefers 'San Fernando' if present
  if(allForecastData.length){
    const preferred = 'San Fernando';
    const target = allForecastData.find(m=>m.name === preferred)?.name || allForecastData[0].name;
    selectMunicipalityCard(target);
    const card = [...track.children].find(c=>c.getAttribute('data-muni')===target);
    if(card){
      const idx = [...track.children].indexOf(card);
      sliderIndex = Math.min(Math.max(idx - Math.floor(CARDS_PER_VIEW/2),0), Math.max(0, track.children.length - CARDS_PER_VIEW));
      slide(0);
    }
  }
  updateSliderButtons();
}

function selectMunicipalityCard(name){
  selectedMunicipality = name;
  document.querySelectorAll('.muni-card').forEach(c=>{
    const isActive = c.getAttribute('data-muni')===name;
    c.classList.toggle('active', isActive);
    c.setAttribute('aria-selected', isActive ? 'true' : 'false');
    // Make only active card tabbable for cleaner keyboard navigation
    c.setAttribute('tabindex', isActive ? '0' : '-1');
  });
  // Center the newly active card in the slider viewport
  const track = document.getElementById('municipalityTrack');
  if(track){
    const activeCard = [...track.children].find(c=>c.getAttribute('data-muni')===name);
    if(activeCard){
      const idx = [...track.children].indexOf(activeCard);
      const maxIndex = Math.max(0, track.children.length - CARDS_PER_VIEW);
      sliderIndex = Math.min(Math.max(idx - Math.floor(CARDS_PER_VIEW/2),0), maxIndex);
      slide(0); // re-render position
    }
  }
  updateWeather(name);
}

function slide(direction){
  const track = document.getElementById('municipalityTrack');
  if(!track) return;
  const totalCards = track.children.length;
  const maxIndex = Math.max(0, totalCards - CARDS_PER_VIEW);
  sliderIndex = Math.min(Math.max(sliderIndex + direction, 0), maxIndex);
  const cardWidth = track.querySelector('.muni-card')?.offsetWidth || 230;
  const gap = 18; // keep in sync with CSS
  const offset = -(sliderIndex * (cardWidth + gap));
  track.style.transform = `translateX(${offset}px)`;
  updateSliderButtons();
}

function updateSliderButtons(){
  const prev = document.querySelector('.municipality-slider .prev');
  const next = document.querySelector('.municipality-slider .next');
  const track = document.getElementById('municipalityTrack');
  if(!track) return;
  const totalCards = track.children.length;
  const maxIndex = Math.max(0, totalCards - CARDS_PER_VIEW);
  if(prev) prev.disabled = sliderIndex === 0;
  if(next) next.disabled = sliderIndex === maxIndex;
  [prev,next].forEach(btn=>{
    if(btn){
      btn.style.opacity = btn.disabled ? .35 : 1;
      btn.style.pointerEvents = btn.disabled ? 'none' : 'auto';
    }
  });
}

window.addEventListener('resize', ()=>{
  // reset transform to avoid misalignment on resize
  slide(0);
});

document.addEventListener('click', e=>{
  if(e.target.matches('.municipality-slider .prev')) slide(-1);
  if(e.target.matches('.municipality-slider .next')) slide(1);
});

async function updateWeather(muniName) {
  // Get forecast data for the selected municipality
  const muniData = allForecastData.find(m => m.name === muniName);

  if (!muniData || !muniData.forecast) {
    console.warn(`No forecast data found for ${muniName}`);
    return;
  }

  // Prepare data for charts and panels
  const forecastList = muniData.forecast;
  const rainfallData = forecastList.slice(0, 7).map(f => Math.round(f.rain)); // Extract first 7 rain values
  
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const todayIndex = new Date().getDay(); // 0 = Sun
  
  // Create dynamic labels 
  const chartLabels = forecastList.slice(0, 7).map((_, i) => {
    const dayIndex = (todayIndex + i) % 7;
    return i === 0 ? "Today" : days[dayIndex];
  });

  // Update header only (cards now show totals)
  const header = document.querySelector('.weather-panel-header h1');
  if(header) header.textContent = muniName;

  // Update charts
  if (window.rainfallChart) {
    window.rainfallChart.data.labels = chartLabels; // Use dynamic labels
    window.rainfallChart.data.datasets[0].data = rainfallData;
    window.rainfallChart.update();
  }
  
  if (window.conditionsChart) {
    const counts = { "No Rain": 0, "Light": 0, "Moderate": 0, "Heavy": 0, "Intense": 0, "Torrential": 0 };
    rainfallData.forEach(mm => {
      counts[classifyRain(mm)]++;
    });
    window.conditionsChart.data.datasets[0].data = Object.values(counts);
    window.conditionsChart.update();
  }
}

// Update time every second
function updateTime() {
  const now = new Date();
  const timeElement = document.querySelector('.time');
  if (timeElement) {
    timeElement.textContent = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', minute: '2-digit', hour12: true 
    });
  }
}

// Highlight current page in navbar
function highlightCurrentPage() {
  const currentPath = window.location.pathname;
  const navItems = document.querySelectorAll('.navbar-item');
  
  console.log('highlightCurrentPage - Current path:', currentPath);
  console.log('highlightCurrentPage - Found nav items:', navItems.length);
  
  navItems.forEach(item => {
    const page = item.getAttribute('data-page');
    console.log('Checking nav item with data-page:', page);
    
    // Check if current path matches the page
    if ((currentPath === '/' && page === 'home') ||
        (currentPath.includes('/report') && page === 'report') ||
        (currentPath.includes('/about') && page === 'about')) {
      item.classList.add('active');
      console.log('Added active class to:', page);
    } else {
      item.classList.remove('active');
    }
  });
}

// Add navigation effects
function addNavigationEffects() {
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize charts & default weather
  initCharts();
  fetchData();
  
  // Start time updates
  updateTime();
  setInterval(updateTime, 1000);
  
  // Highlight current page and add navigation effects
  console.log('Current path:', window.location.pathname);
  highlightCurrentPage();
  addNavigationEffects();
  
  // Debug: Check if active class was added
  const activeItems = document.querySelectorAll('.navbar-item.active');
  console.log('Active navbar items:', activeItems.length);
  activeItems.forEach(item => {
    console.log('Active item page:', item.getAttribute('data-page'));
  });
  
  // Dropdown toggle functionality
  const dropdown = document.querySelector('.select');
  const selected = dropdown?.querySelector('.selected');
  const options = dropdown?.querySelector('.options');
  
  if (selected && options) {
    selected.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
    
    // Hook dropdown (supports existing dropdown selection focusing slider)
    document.querySelectorAll('.options input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const label = document.querySelector(`label[for=${radio.id}]`);
        if (label) {
          const name = label.getAttribute('data-txt');
          selectMunicipalityCard(name);
          // auto scroll slider so that selected card is visible
          const track = document.getElementById('municipalityTrack');
          const card = track ? [...track.children].find(c=>c.getAttribute('data-muni')===name) : null;
          if(card){
            const idx = [...track.children].indexOf(card);
            sliderIndex = Math.min(Math.max(idx - Math.floor(CARDS_PER_VIEW/2),0), Math.max(0, track.children.length - CARDS_PER_VIEW));
            slide(0);
          }
        }
        // Close dropdown after selection
        dropdown.classList.remove('active');
      });
    });
  }
});