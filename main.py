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
    { "post_id": 2000, "name": "San Fernando", "coords": [15.079086, 120.61683]},
    { "post_id": 2001, "name": "Bacolor", "coords": [15.008787, 120.67227]},
    { "post_id": 2002, "name": "Santa Rita", "coords": [15.008787, 120.58824]},
    { "post_id": 2003, "name": "Guagua", "coords": [14.938489, 120.72761]},
    { "post_id": 2004, "name": "Sasmuan", "coords": [14.938489, 120.72761]},
    { "post_id": 2005, "name": "Lubao", "coords": [14.938489, 120.5597]},
    { "post_id": 2006, "name": "Floridablanca", "coords": [15.008787, 120.58824]},
    { "post_id": 2008, "name": "Porac", "coords": [15.079086, 120.532715]},
    { "post_id": 2009, "name": "Angeles", "coords": [15.1493845, 120.56127]},
    { "post_id": 2010, "name": "Mabalacat", "coords": [15.219684, 120.58989]},
    { "post_id": 2011, "name": "Magalang", "coords": [15.219684, 120.674164]},
    { "post_id": 2012, "name": "Arayat", "coords": [15.1493845, 120.72965]},
    { "post_id": 2013, "name": "Candaba", "coords": [15.079086, 120.78505]},
    { "post_id": 2014, "name": "San Luis", "coords": [15.008787, 120.75631]},
    { "post_id": 2015, "name": "San Simon", "coords": [15.008787, 120.75631]},
    { "post_id": 2016, "name": "Apalit", "coords": [14.938489, 120.81156]},
    { "post_id": 2017, "name": "Masantol", "coords": [14.86819, 120.78285]},
    { "post_id": 2018, "name": "Macabebe", "coords": [14.938489, 120.72761]},
    { "post_id": 2019, "name": "Minalin", "coords": [14.938489, 120.72761]},
    { "post_id": 2020, "name": "Santo Tomas", "coords": [15.008787, 120.84034]},
    { "post_id": 2021, "name": "Mexico", "coords": [15.079086, 120.700935]},
    { "post_id": 2022, "name": "Santa Ana", "coords": [15.079086, 120.78505]}
]

# Initialize services, scheduler, and fastAPI server
forecast_service = ForecastService()
scheduler = AsyncIOScheduler()
app = FastAPI(title="Rainfall Forecast API")

@app.on_event("startup")
async def startup_event():
    print("FastAPI Startup: Loading All Models...")
    
    # Load all models into the models registry
    try:
        forecast_service.load_all_models()
    except Exception as e:
        print(f"FATAL ERROR during model loading: {e}")
    
    # Schedule the daily forecast job (12:00 AM)
    DAILY_UPDATE_HOUR = 0
    DAILY_UPDATE_MINUTE = 0
    
    scheduler.add_job(
        forecast_service.run_forecasting_pipeline, 
        'cron', 
        hour=DAILY_UPDATE_HOUR, 
        minute=DAILY_UPDATE_MINUTE, 
        args=[pampanga_municipalities_data],
        name="Daily_Forecast_Update"
    )
    
    scheduler.start()
    print(f"Daily forecast job scheduled for {DAILY_UPDATE_HOUR:02}:{DAILY_UPDATE_MINUTE:02}.")

    # Run the forecast once immediately on startup for fresh data
    asyncio.create_task(
        forecast_service.run_forecasting_pipeline(pampanga_municipalities_data)
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