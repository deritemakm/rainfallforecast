import os
import sys
import json
import asyncio
import datetime

# For model configuration setup and usage
import torch
import joblib
import numpy as np
import pandas as pd
import warnings
from typing import Optional, List, Dict, Any 

from torch import nn
from dataclasses import dataclass
from typing import Optional, List, Dict
from sklearn.preprocessing import MinMaxScaler
from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer
from sklearn.ensemble import RandomForestRegressor

# For OPEN-METEO API calls
import openmeteo_requests
import requests_cache
from retry_requests import retry
from requests import Session

# Suppress the InconsistentVersionWarning from scikit-learn/pandas
warnings.filterwarnings("ignore", category=UserWarning)

# MLP CONFIGS
@dataclass
class MLPConfig:
    training_data_percentage: float = 50.0
    apply_seasonality: bool = True
    input_size: int = 11
    hidden_layers: Optional[List[int]] = None
    output_size: int = 7
    activation_function: str = 'tanh'
    use_grokking: bool = False
    alpha: float = 0.98
    lamb: float = 2.0
    optimizer_type: str = 'sgd'
    learning_rate: float = 0.001
    momentum: float = 0.9
    weight_decay: float = 0.0
    num_epochs: int = 1000
    batch_size: int = 32
    save_best_model: bool = True
    model_save_path: str = "best_model.pth"
    weight_init: str = 'xavier_uniform'

    def __post_init__(self):
        if self.hidden_layers is None:
            self.hidden_layers = [50] * 1

# MODEL ARCHITECTURE 
class FlexibleMLP(nn.Module):
    def __init__(self, config: MLPConfig):
        super(FlexibleMLP, self).__init__()
        self.config = config

        layers = []
        in_features = config.input_size

        for hidden_size in config.hidden_layers:
            layers.append(nn.Linear(in_features, hidden_size))
            if config.activation_function.lower() == 'relu':
                layers.append(nn.ReLU())
            elif config.activation_function.lower() == 'tanh':
                layers.append(nn.Tanh())
            else:
                raise ValueError("Unsupported activation function")

            in_features = hidden_size
        layers.append(nn.Linear(in_features, config.output_size))
        self.network = nn.Sequential(*layers)
        self.apply(self._init_weights)

    def _init_weights(self, m):
        if isinstance(m, nn.Linear):
            if self.config.weight_init == 'xavier_uniform':
                nn.init.xavier_uniform_(m.weight)
            elif self.config.weight_init == 'kaiming_uniform':
                nn.init.kaiming_uniform_(m.weight, mode='fan_in', nonlinearity='relu')
            if m.bias is not None:
                nn.init.zeros_(m.bias)

    def forward(self, x):
        return self.network(x)

class CustomMinMaxScaler(MinMaxScaler):
    def fit(self, X, y=None):
        super().fit(X)
        if isinstance(X, pd.DataFrame):
            self.feature_names_in_ = X.columns.tolist()
        else:
            self.feature_names_in_ = [f"x{i}" for i in range(X.shape[1])]

# API WEATHER DATA PREPARATION 
def clean_data(df):
    df = df.copy()
    if 'date' in df.columns:
        df = df.drop(columns=['date'])
    df.columns = [col.replace(' (°C)', '').replace(' (°)', '').replace(' (mm)', '').replace(' (%)', '').replace(' (km/h)', '') for col in df.columns]

    df = df.rename(columns={
        'temperature_2m_mean': 'avg_temp',
        'temperature_2m_max': 'max_temp',
        'temperature_2m_min': 'min_temp',
        'rain_sum': 'total_rain',
        'cloud_cover_mean': 'mean_cloud_cover',
        'relative_humidity_2m_mean': 'mean_humidity',
        'wind_speed_10m_max': 'mean_wind_speed',
        'wind_direction_10m_dominant': 'wind_direction'
    })
    return df

def add_seasonality_features(data):
    data = data.copy()
    data['month_sin'] = np.sin(2 * np.pi * data['Month'] / 12)
    data['month_cos'] = np.cos(2 * np.pi * data['Month'] / 12)
    data['day_of_year'] = data['Month'] * 30 + data['Day'] # Approximate
    data['day_sin'] = np.sin(2 * np.pi * data['day_of_year'] / 365)
    data['day_cos'] = np.cos(2 * np.pi * data['day_of_year'] / 365)
    data = data.drop(columns=['day_of_year'])
    return data
    
# Helper function to get weather icon based on weather code
def get_weather_icon_from_code(weathercode: int):
    if weathercode is None: return '❓'
    if weathercode >= 95: return '⛈️'
    if weathercode >= 80: return '🌧️'
    if weathercode >= 60: return '🌧️'
    if weathercode >= 51: return '🌦️'
    if weathercode >= 1: return '🌤️'
    return '☀️'

def get_rainfall_classification(rainfall: float) -> dict:
    """Classifies rainfall amount into a type and condition."""
    if rainfall >= 40: 
        return {"type": "extreme", "condition": "Torrential Rain"}
    if rainfall >= 30: 
        return {"type": "heavy", "condition": "Heavy Rain"}
    if rainfall >= 20: 
        return {"type": "moderate", "condition": "Moderate Rain"}
    if rainfall >= 10:
        return {"type": "light", "condition": "Light Rain"}
    return {"type": "none", "condition": "No Significant Rain"}

class ForecastService:
    def __init__(self):
        # Dictionary to hold all loaded models, imputers, and scalers
        self.model_registry = {}  # Key: post_id (e.g., 2000), Value: {model, imputer, scaler, config}
        self.cache = {}  # Key: post_id, Value: last successful forecast result (list)
        self.last_update = None
        
        # Open-Meteo API setup
        cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
        retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
        self.openmeteo = openmeteo_requests.Client(session=retry_session)

    # --- 1. MODEL LOADING AND MANAGEMENT ---
    
    def load_all_models(self):
        print("Starting Model Loading...")
        base_dir = os.path.dirname(__file__)
        
        full_model_dir = base_dir
        
        print(f"Loading models from: {full_model_dir}") # Add this to verify the path
        
        sys.modules['__main__'].CustomMinMaxScaler = CustomMinMaxScaler

        # --- 2.1. Load SHARED Imputer and Scaler FIRST ---
        try:
            shared_imputer_path = os.path.join(full_model_dir, "model_imputer.pkl")
            shared_scaler_path = os.path.join(full_model_dir, "model_scaler.pkl")
            
            shared_imputer = joblib.load(shared_imputer_path)
            shared_scaler = joblib.load(shared_scaler_path)
            
            print("  ✅ Loaded SHARED Imputer and Scaler.")
        except FileNotFoundError as e:
            print(f"  ❌ FATAL: Shared assets not found. Check if 'model_imputer.pkl' and 'model_scaler.pkl' are in {full_model_dir}")
            raise e


        # 2.2. Iterate and load individual PyTorch models
        model_files = [f for f in os.listdir(full_model_dir) if f.endswith(".pth") and f.startswith("model_")]

        for model_file in model_files:
            post_id = None 
            try:
                # Extracts the post_id from 'model_2000.pth'
                post_id = int(model_file.split('_')[1].split('.')[0])
                
                model_path = os.path.join(full_model_dir, model_file)
                
                # Load PyTorch Model
                checkpoint = torch.load(model_path, map_location='cpu')
                config = MLPConfig(**checkpoint['config_dict'])
                
                actual_input_size = checkpoint['model_state_dict']['network.0.weight'].shape[1]
                config.input_size = actual_input_size
                
                model = FlexibleMLP(config)
                model.load_state_dict(checkpoint['model_state_dict'])
                model.eval()

                self.model_registry[post_id] = {
                    'model': model,
                    # --- 2.3. Assign SHARED assets to the registry entry ---
                    'imputer': shared_imputer, 
                    'scaler': shared_scaler,
                    'config': config
                }
                print(f"  ✅ Loaded Model for Post ID {post_id}.")
                
            except Exception as e:
                print(f"  ❌ Failed to load model for Post ID {post_id}: {e}")

        if not self.model_registry:
             print("⚠️ No models were successfully loaded.")

    # --- 2. DATA ACQUISITION ---
    def fetch_yesterday_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        """Fetches yesterday's daily weather data using Open-Meteo Archive API."""
        end_date = datetime.date.today() - datetime.timedelta(days=1)
        start_date = end_date # Fetching just one day

        url = "https://archive-api.open-meteo.com/v1/archive"
        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "daily": [
                "temperature_2m_mean", "temperature_2m_max", "temperature_2m_min", 
                "rain_sum", "cloud_cover_mean", "relative_humidity_2m_mean", 
                "wind_speed_10m_max", "wind_direction_10m_dominant"
            ],
            "timezone": "auto",
        }

        try:
            responses = self.openmeteo.weather_api(url, params=params)
            response = responses[0]

            daily = response.Daily()
            
            # Convert NumPy arrays to lists for JSON serialization later
            return {
                "daily": {
                    "time": [pd.to_datetime(daily.Time(), unit="s", utc=True).isoformat()],
                    "temperature_2m_mean": daily.Variables(0).ValuesAsNumpy().tolist(),
                    "temperature_2m_max": daily.Variables(1).ValuesAsNumpy().tolist(),
                    "temperature_2m_min": daily.Variables(2).ValuesAsNumpy().tolist(),
                    "rain_sum": daily.Variables(3).ValuesAsNumpy().tolist(),
                    "cloud_cover_mean": daily.Variables(4).ValuesAsNumpy().tolist(),
                    "relative_humidity_2m_mean": daily.Variables(5).ValuesAsNumpy().tolist(),
                    "wind_speed_10m_max": daily.Variables(6).ValuesAsNumpy().tolist(),
                    "wind_direction_10m_dominant": daily.Variables(7).ValuesAsNumpy().tolist(),
                    # Placeholder: Current Open-Meteo does not provide weathercode for archive data
                    # Use a sensible default, like 3 (Partly Cloudy)
                    "weathercode": [3] 
                }
            }
        except Exception as e:
            print(f"  ❌ Error fetching weather data for ({lat}, {lon}): {e}")
            raise

    # --- 3. PREPROCESSING AND DENORMALIZATION ---
    
    def _preprocessing_data(self, weather_api_data: dict, imputer: IterativeImputer, scaler: CustomMinMaxScaler, config: MLPConfig) -> pd.DataFrame:
        df = pd.DataFrame(weather_api_data["daily"])
        
        # The input data is for yesterday, but we need features for TODAY (the day to be forecasted)
        df['date'] = pd.to_datetime(df['time']).dt.normalize() + datetime.timedelta(days=1)
        
        df['Year'] = df['date'].dt.year
        df['Month'] = df['date'].dt.month
        df['Day'] = df['date'].dt.day
        
        df = clean_data(df)
        
        input_features = list(imputer.feature_names_in_)
        df_selected = df[input_features]
        
        df_imputed = pd.DataFrame(imputer.transform(df_selected), columns=input_features)

        # Assuming seasonality features are part of the trained scaler's features
        if config.apply_seasonality:
            df_seasonality = add_seasonality_features(df_imputed)
            df_final_input = df_seasonality
        else:
            df_final_input = df_imputed
        
        # Ensure final features match what the scaler was trained on
        df_final_input = df_final_input[scaler.feature_names_in_]

        df_normalized = scaler.transform(df_final_input)

        return pd.DataFrame(df_normalized, columns=scaler.feature_names_in_)

    def _denormalization(self, predictions: np.ndarray, scaler: CustomMinMaxScaler) -> np.ndarray:
        if scaler is None:
            raise ValueError("Scaler not available.")
            
        rainfall_idx = list(scaler.feature_names_in_).index('total_rain')
        denorm_predictions = np.zeros_like(predictions)
        num_samples, num_days = predictions.shape

        for day in range(num_days):
            dummy = np.zeros((num_samples, scaler.n_features_in_))
            dummy[:, rainfall_idx] = predictions[:, day]
            denorm = scaler.inverse_transform(dummy)
            denorm_predictions[:, day] = denorm[:, rainfall_idx]
            
        return denorm_predictions

    # --- 4. THE CORE FORECASTING METHOD ---

    def generate_single_forecast(self, post_id: int, lat: float, lon: float) -> list:
        """Runs the prediction pipeline for a single municipality/post_id."""
        
        # 1. Get Model Assets
        if post_id not in self.model_registry:
            raise ValueError(f"Model for Post ID {post_id} not loaded/found.")
            
        assets = self.model_registry[post_id]
        model, imputer, scaler, config = assets['model'], assets['imputer'], assets['scaler'], assets['config']

        # 2. Fetch Data (Yesterday's historical data)
        weather_api_data = self.fetch_yesterday_weather(lat, lon)
        
        # 3. Preprocess (to get features for Today)
        preprocessed_df = self._preprocessing_data(weather_api_data, imputer, scaler, config)
        input_tensor = torch.tensor(preprocessed_df.values, dtype=torch.float32)

        # 4. Run Model
        with torch.no_grad():
            normalized_predictions = model(input_tensor)
        
        predictions_np = normalized_predictions.numpy()
        
        # 5. Denormalize
        final_forecast_rain_raw = self._denormalization(predictions_np, scaler).flatten()

        final_forecast_rain = np.maximum(0, final_forecast_rain_raw) 

        # 6. Assemble Final Forecast List
        
        # The input data is for Yesterday (D-1). The model is run with D-1's features 
        # to predict D, D+1, D+2, ..., D+N-1.
        # Since we changed the date in _preprocessing_data to today (D), the model
        # predicts the next N days starting from D.
        
        # Start date of the forecast is TODAY
        start_date = datetime.date.today()
        num_forecast_days = config.output_size 

        forecast_list = []
        
        # Iterate over the N prediction days
        for i in range(num_forecast_days):
            forecast_date = start_date + datetime.timedelta(days=i)
            rain_value = float(final_forecast_rain[i])
            
            classification = get_rainfall_classification(rain_value)
            
            # Using placeholder weathercode for now
            # You would need a separate model to predict the WMO weathercode
            weathercode = 3 # Placeholder for 'Partly Cloudy'
            
            forecast_list.append({
                "date": forecast_date.isoformat(),
                "rain": round(rain_value, 2),
                "weathercode": weathercode,
                "icon": get_weather_icon_from_code(weathercode),
                "condition": classification['condition'],
                "type": classification['type']
            })

        return forecast_list

    # --- 5. BATCH PROCESSING AND CACHING (TO BE CALLED BY main.py SCRIPT) ---
    
    async def run_batch_forecast_and_cache(self, municipalities: List[Dict[str, Any]]):
        """
        Runs the full forecast pipeline for all municipalities and caches the results.
        
        This method should be called periodically (e.g., once a day in the morning) 
        by a background process or FastAPI endpoint.
        """
        print("\n--- Starting Daily Batch Forecast ---")
        new_cache = {}
        successful_count = 0
        
        for muni in municipalities:
            post_id = muni.get('post_id') # Assume post_id is now in your muni data
            lat, lon = muni['coords'][0], muni['coords'][1]
            
            if post_id not in self.model_registry:
                print(f"  ⚠️ Skipping {muni['name']}: No model found for Post ID {post_id}.")
                continue
                
            try:
                # Get the N-day forecast list (Day 0 to Day N-1)
                forecast_list = await asyncio.to_thread(
                    self.generate_single_forecast, post_id, lat, lon
                )
                
                # Construct the final municipality object for the frontend
                # Current data (Day 0) is the first item in the list
                current_day_data = forecast_list[0]
                
                final_muni_data = {
                    "name": muni['name'],
                    "coords": muni['coords'],
                    "rainfall": current_day_data['rain'], # Current day rain amount
                    "condition": current_day_data['condition'], # Current day condition
                    "type": current_day_data['type'], # Current day type
                    "forecast": forecast_list, # Full N-day forecast list
                    "post_id": post_id
                }
                
                new_cache[post_id] = final_muni_data
                successful_count += 1
                
            except Exception as e:
                print(f"  ❌ Forecast failed for {muni['name']} (Post ID {post_id}): {e}")
                # You can choose to keep the old cached value or use a fallback here
                if post_id in self.cache:
                    new_cache[post_id] = self.cache[post_id] 
                
        self.cache = new_cache
        self.last_update = datetime.datetime.now()
        print(f"\n✅ Batch Forecast Complete. {successful_count}/{len(municipalities)} municipalities updated.")
        return list(self.cache.values())

    def get_cached_forecasts(self) -> List[Dict[str, Any]]:
        """Retrieves all cached municipality forecast data."""
        return list(self.cache.values())


# --- ISOLATED TESTING ---
if __name__ == "__main__":
    print("Running ForecastService as a standalone script for testing...")

    # 1. Instantiate Service
    service = ForecastService()
    
    # 2. Load all models (Assuming a directory structure like: model/model_2000.pth, model/model_scaler_2000.pkl, etc.)
    service.load_all_models() 
    
    # 3. Define dummy municipality data (must include 'post_id')
    test_municipalities = [
        {"name": "Angeles City", "coords": [15.14336011, 120.59051810], "post_id": 2000},
        {"name": "Porac", "coords": [15.1241602, 120.45899588], "post_id": 2001},
        # ... add more test data corresponding to your loaded models
    ]
    
    # 4. Run batch forecast (simulating the daily update)
    final_data = service.run_batch_forecast_and_cache(test_municipalities)
    
    # 5. Display the final cached data structure
    print("\n--- Final Cached Data for Frontend ---")
    print(json.dumps(final_data, indent=2))
    print("\nTest complete.")
