from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, time
import os
import asyncio
import pandas as pd

# Used as solution to joblib model loading error
from model.forecast import ForecastService 
from sklearn.preprocessing import MinMaxScaler
class CustomMinMaxScaler(MinMaxScaler):
    def fit(self, X, y=None):
        super().fit(X)
        if isinstance(X, pd.DataFrame):
            self.feature_names_in_ = X.columns.tolist()
        else:
            self.feature_names_in_ = [f"x{i}" for i in range(X.shape[1])]

pampanga_municipalities_data = [
    { "post_id": 2000, "name": "Angeles City", "coords": [15.14336011, 120.59051810]},
    { "post_id": 2001, "name": "Apalit", "coords": [14.94997653, 120.75675619]},
    { "post_id": 2002, "name": "Arayat", "coords": [15.16593002, 120.78159403]},
    { "post_id": 2003, "name": "Bacolor", "coords": [15.03378028, 120.62071385]},
    { "post_id": 2004, "name": "Candaba", "coords": [15.10580611, 120.87269784]},
    { "post_id": 2005, "name": "Floridablanca", "coords": [14.93617972, 120.48914087]},
    { "post_id": 2006, "name": "Guagua", "coords": [14.9661957, 120.63310490]},
    { "post_id": 2007, "name": "Lubao", "coords": [14.90217987, 120.55094493]},
    { "post_id": 2008, "name": "Mabalacat", "coords": [15.22089063, 120.57105409]},
    { "post_id": 2009, "name": "Macabebe", "coords": [14.91324103, 120.67347402]},
    { "post_id": 2010, "name": "Magalang", "coords": [15.2478282, 120.68086630]},
    { "post_id": 2011, "name": "Masantol", "coords": [14.85194769, 120.67746495]},
    { "post_id": 2012, "name": "Mexico", "coords": [15.06633515, 120.71217193]},
    { "post_id": 2013, "name": "Minalin", "coords": [14.95365406, 120.70039268]},
    { "post_id": 2014, "name": "Porac", "coords": [15.1241602, 120.45899588]},
    { "post_id": 2015, "name": "San Fernando", "coords": [15.05961285, 120.65646538]},
    { "post_id": 2016, "name": "San Luis", "coords": [15.01880145, 120.81164009]},
    { "post_id": 2017, "name": "San Simon", "coords": [14.9940879, 120.77563412]},
    { "post_id": 2018, "name": "Santa Ana", "coords": [15.10942466, 120.77008266]},
    { "post_id": 2019, "name": "Santa Rita", "coords": [15.00866765, 120.60767406]},
    { "post_id": 2020, "name": "Santo Tomas", "coords": [15.00884912, 120.71039539]},
    { "post_id": 2021, "name": "Sasmuan", "coords": [14.88693929, 120.61290981]}
]

# Initialize services, scheduler, and fastAPI server
forecast_service = ForecastService()
scheduler = AsyncIOScheduler()
app = FastAPI(title="Rainfall Forecast API")

@app.on_event("startup")
async def startup_event():
    print("FastAPI Startup: Loading All Models...")
    
    # Load all models into the service registry
    try:
        forecast_service.load_all_models()
    except Exception as e:
        print(f"FATAL ERROR during model loading: {e}")
    
    # Schedule the daily forecast job (1:00 AM)
    DAILY_UPDATE_HOUR = 1
    DAILY_UPDATE_MINUTE = 0
    
    scheduler.add_job(
        forecast_service.run_batch_forecast_and_cache, 
        'cron', 
        hour=DAILY_UPDATE_HOUR, 
        minute=DAILY_UPDATE_MINUTE, 
        args=[pampanga_municipalities_data],
        name="Daily_Forecast_Update"
    )
    
    scheduler.start()
    print(f"✅ Daily forecast job scheduled for {DAILY_UPDATE_HOUR:02}:{DAILY_UPDATE_MINUTE:02}.")

    # Run the forecast once immediately on startup for fresh data
    asyncio.create_task(
        forecast_service.run_batch_forecast_and_cache(pampanga_municipalities_data)
    )
    print("Initial forecast task started in background.")

@app.on_event("shutdown")
def shutdown_event():
    print("Shutting down scheduler...")
    scheduler.shutdown()
    print("Scheduler stopped.")

@app.get("/api/weather-data", response_class=JSONResponse)
async def get_all_weather_data():
    
    cached_data = forecast_service.get_cached_forecasts()
    
    if not cached_data:
        raise HTTPException(
            status_code=503, 
            detail="Forecast data is not yet available. Please wait for the initial forecast job to complete."
        )

    last_update = forecast_service.last_update.isoformat() if forecast_service.last_update else "N/A"
    print(f"Serving weather data from cache. Last updated: {last_update}")
    
    return cached_data

# Serve everything under /static/ from the static folder
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    html_file_path = os.path.join("static", "html/index.html")
    if not os.path.exists(html_file_path):
        raise HTTPException(status_code=404, detail="index.html not found in static directory")
    with open(html_file_path, "r") as f:
        return f.read()

@app.get("/report", response_class=HTMLResponse)
async def read_report():
    html_file_path = os.path.join("static", "html/report.html")
    if not os.path.exists(html_file_path):
        raise HTTPException(status_code=404, detail="report.html not found")
    with open(html_file_path, "r") as f:
        return f.read()

@app.get("/about", response_class=HTMLResponse)
async def read_about():
    html_file_path = os.path.join("static", "html/about.html")
    if not os.path.exists(html_file_path):
        raise HTTPException(status_code=404, detail="about.html not found")
    with open(html_file_path, "r") as f:
        return f.read()