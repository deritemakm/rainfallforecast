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

def forecast_model_dummy(muni_data: dict, weather_api_data: dict) -> list:
    forecast_list = []
    if (weather_api_data.get("daily") and
        weather_api_data["daily"].get("precipitation_sum") and
        weather_api_data["daily"].get("time")):

        num_days = len(weather_api_data["daily"]["precipitation_sum"])
        for j in range(num_days):
            forecast_list.append({
                "date": weather_api_data["daily"]["time"][j],
                "rain": round(weather_api_data["daily"]["precipitation_sum"][j]),
                "weathercode": weather_api_data["daily"]["weathercode"][j] if weather_api_data["daily"].get("weathercode") else None,
                "icon": get_weather_icon_from_code(weather_api_data["daily"]["weathercode"][j] if weather_api_data["daily"].get("weathercode") else None)
            })
    return forecast_list