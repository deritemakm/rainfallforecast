from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel # For defining request body structure
import httpx # For making asynchronous HTTP requests
import asyncio # For running async tasks concurrently
from datetime import datetime, timedelta
import os

app = FastAPI()

# Serve everything under /static/ from the static folder
app.mount("/static", StaticFiles(directory="static"), name="static")

# 1. Serve the main HTML page at the root URL '/'.
@app.get("/", response_class=HTMLResponse)
async def read_root():
    # within the 'static' folder, relative to where main.py is.
    html_file_path = os.path.join("static", "index.html")
    if not os.path.exists(html_file_path):
        raise HTTPException(status_code=404, detail="index.html not found in static directory")
    with open(html_file_path, "r") as f:
        return f.read()

# In-memory cache for weather data
weather_cache = {
    "data": [],
    "last_updated": None
}

CACHE_DURATION_MINUTES = 15 

# Constants for OpenMeteo API (moved from JS)
OPEN_METEO_API_BASE_URL = 'https://api.open-meteo.com/v1/forecast'

pampanga_municipalities_data = [
    { "name": "Angeles City", "coords": [15.14336011, 120.59051810]},
    { "name": "Apalit", "coords": [14.94997653, 120.75675619]},
    { "name": "Arayat", "coords": [15.16593002, 120.78159403]},
    { "name": "Bacolor", "coords": [15.03378028, 120.62071385]},
    { "name": "Candaba", "coords": [15.10580611, 120.87269784]},
    { "name": "Floridablanca", "coords": [14.93617972, 120.48914087]},
    { "name": "Guagua", "coords": [14.9661957, 120.63310490]},
    { "name": "Lubao", "coords": [14.90217987, 120.55094493]},
    { "name": "Mabalacat", "coords": [15.22089063, 120.57105409]},
    { "name": "Macabebe", "coords": [14.91324103, 120.67347402]},
    { "name": "Magalang", "coords": [15.2478282, 120.68086630]},
    { "name": "Masantol", "coords": [14.85194769, 120.67746495]},
    { "name": "Mexico", "coords": [15.06633515, 120.71217193]},
    { "name": "Minalin", "coords": [14.95365406, 120.70039268]},
    { "name": "Porac", "coords": [15.1241602, 120.45899588]},
    { "name": "San Fernando", "coords": [15.05961285, 120.65646538]},
    { "name": "San Luis", "coords": [15.01880145, 120.81164009]},
    { "name": "San Simon", "coords": [14.9940879, 120.77563412]},
    { "name": "Santa Ana", "coords": [15.10942466, 120.77008266]},
    { "name": "Santa Rita", "coords": [15.00866765, 120.60767406]},
    { "name": "Santo Tomas", "coords": [15.00884912, 120.71039539]},
    { "name": "Sasmuan", "coords": [14.88693929, 120.61290981]}
]

# Helper function to classify weather
def get_weather_classification(rainfall: int):
    if rainfall >= 40:
        return {"type": "extreme", "condition": "Extreme Rain", "icon": "⛈️"}
    if rainfall >= 30:
        return {"type": "heavy", "condition": "Heavy Rain", "icon": "⛈️"}
    if rainfall >= 20:
        return {"type": "moderate", "condition": "Moderate Rain", "icon": "🌧️"}
    return {"type": "light", "condition": "Light Rain", "icon": "🌦️"}

# Helper function to get weather icon based on weather code
def get_weather_icon_from_code(weathercode: int):
    if weathercode is None: return '❓'
    if weathercode >= 95: return '⛈️'
    if weathercode >= 80: return '🌧️'
    if weathercode >= 60: return '🌧️'
    if weathercode >= 51: return '🌦️'
    if weathercode >= 1: return '🌤️'
    return '☀️'

# 2. API Endpoint for Weather Data
@app.get("/api/weather-data")
async def get_all_weather_data():
    current_time = datetime.now()

    # Check if cached data is still fresh
    if weather_cache["last_updated"] and \
       (current_time - weather_cache["last_updated"]) < timedelta(minutes=CACHE_DURATION_MINUTES):
        print("Serving weather data from cache.")
        return weather_cache["data"]

    print("Fetching new weather data from OpenMeteo...")
    processed_municipalities = []

    # Use httpx.AsyncClient for efficient asynchronous HTTP requests
    async with httpx.AsyncClient() as client:
        # Prepare all API calls as asynchronous tasks (coroutines)
        tasks = []
        for muni_info in pampanga_municipalities_data:
            lat, lon = muni_info["coords"]
            url = f"{OPEN_METEO_API_BASE_URL}?latitude={lat}&longitude={lon}&daily=precipitation_sum,weathercode&timezone=auto"
            tasks.append(client.get(url))

        # Run all tasks concurrently (Python's equivalent of Promise.allSettled)
        # return_exceptions=True ensures that even if one request fails, others still complete
        all_responses = await asyncio.gather(*tasks, return_exceptions=True)

        for i, response_or_exception in enumerate(all_responses):
            muni_data = pampanga_municipalities_data[i].copy() # Copy original data

            if isinstance(response_or_exception, httpx.Response):
                try:
                    data = response_or_exception.json()
                    if data.get("daily") and data["daily"].get("precipitation_sum") and len(data["daily"]["precipitation_sum"]) > 0:
                        current_rainfall = round(data["daily"]["precipitation_sum"][0])
                        muni_data.update(get_weather_classification(current_rainfall)) # Add type, condition, icon
                        muni_data["rainfall"] = current_rainfall # Current day's rainfall

                        # Store 7-day forecast
                        muni_data["forecast"] = [
                            {
                                "date": data["daily"]["time"][j],
                                "rain": round(data["daily"]["precipitation_sum"][j]),
                                "weathercode": data["daily"]["weathercode"][j] if data["daily"].get("weathercode") else None,
                                "icon": get_weather_icon_from_code(data["daily"]["weathercode"][j] if data["daily"].get("weathercode") else None)
                            }
                            for j in range(len(data["daily"]["precipitation_sum"]))
                        ]
                    else:
                        # Handle cases with no valid daily data
                        muni_data.update({"rainfall": 0, "condition": "No Data", "icon": "❓", "type": "unknown", "forecast": []})
                except Exception as e:
                    # Handle JSON parsing or data access errors
                    print(f"Error processing data for {muni_data['name']}: {e}")
                    muni_data.update({"error": str(e), "rainfall": 0, "condition": "Data Error", "icon": "⚠️", "type": "error", "forecast": []})
            else:
                # Handle network or HTTP request errors
                print(f"Network error for {muni_data['name']}: {response_or_exception}")
                muni_data.update({"error": str(response_or_exception), "rainfall": 0, "condition": "Network Error", "icon": "📡", "type": "error", "forecast": []})

            processed_municipalities.append(muni_data)

    # Update cache with new data and timestamp
    weather_cache["data"] = processed_municipalities
    weather_cache["last_updated"] = current_time

    return processed_municipalities