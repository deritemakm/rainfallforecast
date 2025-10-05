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

// Rain classification
function classifyRain(mm) {
  if (mm === 0) return "No Rain";
  if (mm <= 2) return "Light";
  if (mm <= 10) return "Moderate";
  if (mm <= 20) return "Heavy";
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
          'rgba(78, 139, 181, 0.8)',
          'rgba(42, 82, 152, 0.8)',
          'rgba(30, 60, 114, 0.8)',
          'rgba(78, 139, 181, 0.6)',
          'rgba(155, 188, 217, 0.6)',
          'rgba(155, 188, 217, 0.4)',
          'rgba(30, 60, 114, 0.9)'
        ],
        borderColor: [
          'rgba(78, 139, 181, 1)',
          'rgba(42, 82, 152, 1)',
          'rgba(30, 60, 114, 1)',
          'rgba(78, 139, 181, 1)',
          'rgba(155, 188, 217, 1)',
          'rgba(155, 188, 217, 1)',
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
      labels: ['No Rain', 'Light', 'Moderate', 'Heavy', 'Torrential'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        backgroundColor: [
          'rgba(255, 206, 84, 0.8)',
          'rgba(155, 188, 217, 0.8)',
          'rgba(78, 139, 181, 0.8)',
          'rgba(42, 82, 152, 0.8)',
          'rgba(30, 60, 114, 0.8)'
        ],
        borderColor: [
          'rgba(255, 206, 84, 1)',
          'rgba(155, 188, 217, 1)',
          'rgba(78, 139, 181, 1)',
          'rgba(42, 82, 152, 1)',
          'rgba(30, 60, 114, 1)'
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

      // After loading, ensure the initial display is correct
      const initialMuni = document.querySelector(".options input:checked") 
                         ? document.querySelector(".options input:checked").nextElementSibling.getAttribute("data-txt") 
                         : "Angeles";
      
      const initialRadio = document.querySelector(`label[data-txt="${initialMuni}"]`).previousElementSibling;

      if (initialRadio) {
          initialRadio.checked = true;
          updateWeather(initialMuni);
      }
  } catch (e) {
      console.error("Failed to fetch forecast data from backend:", e);
  }
}

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


  // 3. Update main panel (today)
  const bigPanel = document.querySelector(".panel-big");
  const todayData = forecastList[0];

  const header = document.querySelector(".weather-panel-header h1");
  if (header) header.textContent = muniName;
  
  if (bigPanel) {
    bigPanel.querySelector(".day").textContent = "Today";
    bigPanel.querySelector(".rainfall-amt").textContent = `${Math.round(todayData.rain)}mm Rainfall`;
    bigPanel.querySelector(".rainfall-type span").textContent = todayData.type;
  }

  // Update the next 6 days for small panels
  const smallPanels = document.querySelectorAll(".panel-small");
  
  smallPanels.forEach((panel, i) => {
    const idx = i + 1; // next day index
    const dayData = forecastList[idx];

    if (dayData) {
      const dayIdx = (todayIndex + idx) % 7;
      panel.querySelector(".day-small").textContent = days[dayIdx];
      panel.querySelector(".rainfall-amt").textContent = `${Math.round(dayData.rain)}mm`;
      panel.querySelector(".rainfall-type-small span").textContent = dayData.type;
      
    }
  });

  // Update charts
  if (window.rainfallChart) {
    window.rainfallChart.data.labels = chartLabels; // Use dynamic labels
    window.rainfallChart.data.datasets[0].data = rainfallData;
    window.rainfallChart.update();
  }
  
  if (window.conditionsChart) {
    const counts = { "No Rain": 0, "Light": 0, "Moderate": 0, "Heavy": 0, "Torrential": 0 };
    rainfallData.forEach(mm => {
      counts[classifyRain(mm)]++;
    });
    window.conditionsChart.data.datasets[0].data = Object.values(counts);
    window.conditionsChart.update();
  }
}

// Hook dropdown
document.querySelectorAll(".options input").forEach(radio => {
  radio.addEventListener("change", () => {
    const label = document.querySelector(`label[for=${radio.id}]`);
    if (label) updateWeather(label.getAttribute("data-txt"));
  });
});

// Initialize charts & default weather
initCharts();
fetchData();

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
updateTime();
setInterval(updateTime, 1000);
