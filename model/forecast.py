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
    # More accurate approach
    # data['day_of_year'] = pd.to_datetime(data[['Year', 'Month', 'Day']]).dt.dayofyear
    data['day_sin'] = np.sin(2 * np.pi * data['day_of_year'] / 365)
    data['day_cos'] = np.cos(2 * np.pi * data['day_of_year'] / 365)
    data = data.drop(columns=['day_of_year'])
    return data
    
def get_rainfall_classification(rainfall: float) -> dict:
    if rainfall == 0: 
        return {"type": "none", "condition": "No Rain"}
    if rainfall <= 5: 
        return {"type": "light", "condition": "Light Rain"}
    if rainfall <= 25: 
        return {"type": "moderate", "condition": "Moderate Rain"}
    if rainfall <= 50:
        return {"type": "heavy", "condition": "Heavy Rain"}
    if rainfall <= 100:
        return {"type": "intense", "condition": "Intense Rain"}
    return {"type": "torrential", "condition": "Torrential Rain"}

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
    
    def load_all_models(self):
        print("Starting Model Loading...")
        base_dir = os.path.dirname(__file__)
        
        full_model_dir = base_dir
        
        print(f"Loading models from: {full_model_dir}")
        
        sys.modules['__main__'].CustomMinMaxScaler = CustomMinMaxScaler

        # Load SHARED Imputer and Scaler
        try:
            shared_imputer_path = os.path.join(full_model_dir, "model_imputer.pkl")
            shared_scaler_path = os.path.join(full_model_dir, "model_scaler.pkl")
            
            shared_imputer = joblib.load(shared_imputer_path)
            shared_scaler = joblib.load(shared_scaler_path)  
            
            print("  ✅ Loaded SHARED Imputer and Scaler.")
        except FileNotFoundError as e:
            print(f"  FATAL: Shared assets not found. Check if 'model_imputer.pkl' and 'model_scaler.pkl' are in {full_model_dir}")
            raise e


        # Iterate and load individual PyTorch models (2000 - 2022)
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
                    # Assign SHARED models to the registry entry
                    'imputer': shared_imputer, 
                    'scaler': shared_scaler,
                    'config': config
                }
                print(f"  ✅ Loaded Model for Post ID {post_id}.")
                
            except Exception as e:
                print(f"  Failed to load model for Post ID {post_id}: {e}")

        if not self.model_registry:
             print("No models were successfully loaded.")

    # Fetch yesterday's data to forecast 7-day ahead (today + 6 days)
    def fetch_yesterday_weather(self, lat: float, lon: float) -> Dict[str, Any]:
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
                }
            }
        except Exception as e:
            print(f"  Error fetching weather data for ({lat}, {lon}): {e}")
            raise

    # Preprocessing    
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

    # Main forecasting process
    def generate_single_forecast(self, post_id: int, lat: float, lon: float) -> list:        
        # Get Model Assets
        if post_id not in self.model_registry:
            raise ValueError(f"Model for Post ID {post_id} not loaded/found.")
            
        assets = self.model_registry[post_id]
        model, imputer, scaler, config = assets['model'], assets['imputer'], assets['scaler'], assets['config']

        # Fetch Data (Yesterday's historical data)
        weather_api_data = self.fetch_yesterday_weather(lat, lon)
        
        # Preprocess
        preprocessed_df = self._preprocessing_data(weather_api_data, imputer, scaler, config)
        input_tensor = torch.tensor(preprocessed_df.values, dtype=torch.float32)

        # Run Model
        with torch.no_grad():
            normalized_predictions = model(input_tensor)
        
        predictions_np = normalized_predictions.numpy()
        
        # Denormalize forecasts
        final_forecast_rain_raw = self._denormalization(predictions_np, scaler).flatten()

        # Clamping negative values
        final_forecast_rain = np.maximum(0, final_forecast_rain_raw) 
        
        # Start date of the forecast is TODAY
        start_date = datetime.date.today()
        num_forecast_days = config.output_size 

        forecast_list = []
        
        # Iterate over the N prediction days
        for i in range(num_forecast_days):
            forecast_date = start_date + datetime.timedelta(days=i)
            rain_value = float(final_forecast_rain[i])
            
            classification = get_rainfall_classification(rain_value)
            
            forecast_list.append({
                "date": forecast_date.isoformat(),
                "rain": round(rain_value, 2),
                "condition": classification['condition'],
                "type": classification['type']
            })

        return forecast_list

    #  MAIN FORECAST PROCESSING AND CACHING (TO BE CALLED BY main.py SCRIPT)
    async def run_batch_forecast_and_cache(self, municipalities: List[Dict[str, Any]]):
        print("\n=== Starting Daily Batch Forecast ===")
        new_cache = {}
        successful_count = 0
        
        for muni in municipalities:
            post_id = muni.get('post_id') # Assume post_id is now in your muni data
            lat, lon = muni['coords'][0], muni['coords'][1]
            
            if post_id not in self.model_registry:
                print(f"  Skipping {muni['name']}: No model found for Post ID {post_id}.")
                continue
                
            try:
                # Get the N-day forecast list (Day 0 to Day N-1)
                forecast_list = await asyncio.to_thread(
                    self.generate_single_forecast, post_id, lat, lon
                )
                
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
        print(f"\nBatch Forecast Complete. {successful_count}/{len(municipalities)} municipalities updated.")
        return list(self.cache.values())

    def get_cached_forecasts(self) -> List[Dict[str, Any]]:
        return list(self.cache.values())

    def generate_forecast_manual_data(self, post_id: int, custom_weather_data: Dict[str, Any]) -> list:
        if post_id not in self.model_registry:
            raise ValueError(f"Model for Post ID {post_id} not loaded/found.")
            
        assets = self.model_registry[post_id]
        model, imputer, scaler, config = assets['model'], assets['imputer'], assets['scaler'], assets['config']

        # Use manual input data
        preprocessed_df = self._preprocessing_data(custom_weather_data, imputer, scaler, config)
        input_tensor = torch.tensor(preprocessed_df.values, dtype=torch.float32)

        # Run Model
        with torch.no_grad():
            normalized_predictions = model(input_tensor)
        
        predictions_np = normalized_predictions.numpy()
        
        # Denormalize forecasts
        final_forecast_rain_raw = self._denormalization(predictions_np, scaler).flatten()

        # Clamping negative values
        final_forecast_rain = np.maximum(0, final_forecast_rain_raw) 
        
        # Start date of the forecast is TODAY
        start_date = datetime.date.today()
        num_forecast_days = config.output_size 

        forecast_list = []
        
        for i in range(num_forecast_days):
            forecast_date = start_date + datetime.timedelta(days=i)
            rain_value = float(final_forecast_rain[i])
            
            classification = get_rainfall_classification(rain_value)
            
            forecast_list.append({
                "date": forecast_date.isoformat(),
                "rain": round(rain_value, 2),
                "condition": classification['condition'],
                "type": classification['type']
            })   
        return forecast_list


# TEST FORECASTING
if __name__ == "__main__":
    print("MANUAL TESTING")

    # Instantiate Service
    service = ForecastService()
    
    # Load all models 
    service.load_all_models() 

    TEST_POST_ID = 2000
    yesterday_date = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    
    sample_weather_data = {
        "daily": {
            "time": [yesterday_date],
            "temperature_2m_mean": [32.0],
            "temperature_2m_max": [35.5],
            "temperature_2m_min": [28.0],
            "rain_sum": [0.0],                
            "cloud_cover_mean": [10.0],
            "relative_humidity_2m_mean": [50.0],
            "wind_speed_10m_max": [15.0],
            "wind_direction_10m_dominant": [250.0],
        }
    }

    final_data = service.generate_forecast_manual_data(
            post_id=TEST_POST_ID, 
            custom_weather_data=sample_weather_data
        )
    
    # Display the final cached data structure
    print("\n=== Final Cached Data for Frontend ===")
    print(json.dumps(final_data, indent=2))
    print("\nTest complete.")