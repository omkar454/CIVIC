# utils/weather_service.py
import os
import requests
from datetime import datetime, timedelta

class WeatherIntelligence:
    def __init__(self):
        self.api_key = os.getenv("OPENWEATHER_API_KEY")
        self.city = "Mumbai,IN"
        
    def get_7day_forecast(self):
        """
        Fetches or Simulates weather for the next 7 days.
        If no API key is found, it returns a simulated 'Rainy/Hot' cycle to demonstrate the AI spikes.
        """
        if self.api_key and self.api_key != "your_openweather_api_key_here":
            try:
                # 📡 LIVE API ATTEMPT
                url = f"https://api.openweathermap.org/data/2.5/forecast?q={self.city}&appid={self.api_key}&units=metric"
                res = requests.get(url, timeout=5)
                
                if res.status_code == 200:
                    data = res.json()
                    parsed = self._parse_real_weather(data)
                    
                    # 📡 TERMINAL LOG: CONFIRMING LIVE FEED
                    current_weather = parsed[0] if parsed else {}
                    print(f"\n[WEATHER RECON] >>> LIVE MODE ACTIVE <<<")
                    print(f"Bandra Forecast Synced via OpenWeatherMap API")
                    print(f"Current: {current_weather.get('condition')} | {current_weather.get('temperature')}°C")
                    print(f"Timestamp: {datetime.now().strftime('%H:%M:%S')}\n")
                    
                    return parsed
                else:
                    print(f"[WEATHER RECON] API returned status {res.status_code}. Using Simulator fallback.")
            except Exception as e:
                print(f"[WEATHER RECON] API Connection Error: {e}. Using Simulator fallback.")

        # 🤖 SIMULATION FALLBACK (Stress-Testing Mode)
        print(f"\n[WEATHER RECON] >>> SIMULATION MODE ACTIVE <<<")
        print(f"No active API feed detected. Using AI Stress-Test Cycle (Monsoon/Heatwave Scenarios).")
        print(f"Location: Bandra (Simulated) | Timestamp: {datetime.now().strftime('%H:%M:%S')}\n")
        
        return self._simulate_weather()

    def _parse_real_weather(self, data):
        """
        Parses the 5-day/3-hour forecast from OpenWeatherMap.
        Aggregates chunks into daily peak risks for the AI model.
        """
        daily_peaks = {}
        
        for entry in data.get("list", []):
            date_str = datetime.fromtimestamp(entry["dt"]).strftime("%Y-%m-%d")
            temp = entry["main"]["temp"]
            rain = entry.get("rain", {}).get("3h", 0)
            condition = entry["weather"][0]["main"]
            
            if date_str not in daily_peaks:
                daily_peaks[date_str] = {"temp": temp, "rain": rain, "cond": condition}
            else:
                # Keep the peak values for risk assessment
                daily_peaks[date_str]["temp"] = max(daily_peaks[date_str]["temp"], temp)
                daily_peaks[date_str]["rain"] = max(daily_peaks[date_str]["rain"], rain)
                if "Rain" in condition or "Storm" in condition:
                    daily_peaks[date_str]["cond"] = condition

        parsed_data = []
        for date, peaks in daily_peaks.items():
            parsed_data.append({
                "date": date,
                "condition": peaks["cond"],
                "temperature": peaks["temp"],
                "precipitation_mm": peaks["rain"]
            })
            
        return sorted(parsed_data, key=lambda x: x["date"])[:7]

    def _simulate_weather(self):
        """
        A high-fidelity simulator representing a typical Mumbai Monsoon transition.
        Ensures the user can see the AI 'Why there is a spike' logic immediately.
        """
        today = datetime.utcnow().date()
        simulation = []
        
        # Scenario: Day 2 and Day 3 have significant rainfall
        # 🤖 ACCURACY ENFORCED FALLBACK
        # If API fails or is missing, we now return a Standard/Stable feed 
        # instead of fake 'Stress-Test' spikes to ensure truth-in-data.
        print(f"\n[WEATHER RECON] >>> STANDBY MODE ACTIVE <<<")
        print(f"Bandra Live Feed unavailable. Using Standard City Baseline.")
        print(f"Location: Bandra | Timestamp: {datetime.now().strftime('%H:%M:%S')}\n")
        
        stable_fallback = []
        for i in range(7):
            date = today + timedelta(days=i)
            stable_fallback.append({
                "date": date.strftime("%Y-%m-%d"),
                "condition": "Cloudy",
                "temperature": 32,
                "precipitation_mm": 0
            })
        return stable_fallback

def get_forecast_multipliers(weather_forecast: list):
    """
    Translates weather conditions into operational intensity multipliers.
    """
    multipliers = []
    for day in weather_forecast:
        m = {
            "date": day["date"], 
            "Pothole": 1.0, 
            "Drainage": 1.0, 
            "Water": 1.0, 
            "Garbage": 1.0, 
            "reason": None
        }
        
        # Heavy Rain Logic
        if day["precipitation_mm"] > 50:
            m["Pothole"] = 2.5
            m["Drainage"] = 3.0
            m["Garbage"] = 1.5
            m["reason"] = f"Monsoon Spike: {day['condition']} Alert; risk of water-clogged waste and collection delays."
        elif day["precipitation_mm"] > 10:
            m["Pothole"] = 1.4
            m["Drainage"] = 1.8
            m["reason"] = "Rain Impact: Pavement erosion and drainage clogging risk."
            
        # Heatwave Logic
        if day["temperature"] > 35:
            m["Water"] = 1.6
            m["Garbage"] = 1.6
            m["reason"] = "Heatwave Impact: High demand on water systems and rapid waste decomposition alert."
            
        multipliers.append(m)
    return multipliers
