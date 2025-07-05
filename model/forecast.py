def forecast_model_dummy(muni_data: dict, weather_api_data: dict) -> list:
    forecast_list = []

    if (weather_api_data.get("daily") and
        weather_api_data["daily"].get("precipitation_sum") and
        weather_api_data["daily"].get("time")):

        preprocessed_data = preprocessing_data(weather_api_data)

        num_days = len(preprocessed_data["daily"]["precipitation_sum"])
        for j in range(num_days):
            forecast_list.append({
                "date": preprocessed_data["daily"]["time"][j],
                "rain": round(preprocessed_data["daily"]["precipitation_sum"][j]),
                "weathercode": preprocessed_data["daily"]["weathercode"][j] if preprocessed_data["daily"].get("weathercode") else None,
                "icon": get_weather_icon_from_code(preprocessed_data["daily"]["weathercode"][j] if weather_api_data["daily"].get("weathercode") else None)
            })

    return denormalization(forecast_list)

# Preparation of input data for trained model
def preprocessing_data(weather_api_data: dict) -> list:

    # Requires the trained imputation model and normalization scaler

    return weather_api_data

# Function using Min-Max scaler to get original values
def denormalization(forecast_list: dict) -> list:
    
    # Requires the trained normalization scaler

    return forecast_list

# Helper function to get weather icon based on weather code
def get_weather_icon_from_code(weathercode: int):
    """Returns an emoji icon based on the OpenMeteo weathercode."""
    if weathercode is None: return '❓'
    if weathercode >= 95: return '⛈️'
    if weathercode >= 80: return '🌧️'
    if weathercode >= 60: return '🌧️'
    if weathercode >= 51: return '🌦️'
    if weathercode >= 1: return '🌤️'
    return '☀️'