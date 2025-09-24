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
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
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

// Update panels, charts, header
async function updateWeather(muniName) {
  const header = document.querySelector(".weather-panel-header h1");
  if (header) header.textContent = muniName;

  const [lat, lon] = pampangaMunicipalities[muniName] || pampangaMunicipalities["Angeles"];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&timezone=auto`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.daily) return;

    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const bigPanel = document.querySelector(".panel-big");
    const smallPanels = document.querySelectorAll(".panel-small");

    const today = new Date().getDay(); // 0 = Sun
    const todayRain = Math.round(data.daily.precipitation_sum[0]); // API day[0] is today

    // Update big panel (today)
    bigPanel.querySelector(".day").textContent = days[today];
    bigPanel.querySelector(".rainfall-amt").textContent = `${todayRain}mm Rainfall`;
    bigPanel.querySelector(".rainfall-type span").textContent = classifyRain(todayRain);

    // Update the next 6 days for small panels
    smallPanels.forEach((panel, i) => {
    const idx = i + 1; // next day index in API
    if (idx < data.daily.precipitation_sum.length) {
        const mm = Math.round(data.daily.precipitation_sum[idx]);
        const dayIdx = (today + idx) % 7; // roll over at Sat→Sun
        panel.querySelector(".day-small").textContent = days[dayIdx];
        panel.querySelector(".rainfall-amt").textContent = `${mm}mm`;
        panel.querySelector(".rainfall-type-small span").textContent = classifyRain(mm);
    }
    });

    // Update charts
    if (window.rainfallChart) {
      window.rainfallChart.data.datasets[0].data = data.daily.precipitation_sum.slice(0,7);
      window.rainfallChart.update();
    }
    if (window.conditionsChart) {
      const counts = { "No Rain": 0, "Light": 0, "Moderate": 0, "Heavy": 0, "Torrential": 0 };
      data.daily.precipitation_sum.slice(0,7).forEach(mm => {
        counts[classifyRain(Math.round(mm))]++;
      });
      window.conditionsChart.data.datasets[0].data = Object.values(counts);
      window.conditionsChart.update();
    }

  } catch (e) {
    console.error("Weather fetch failed", e);
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
updateWeather("Angeles");

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
