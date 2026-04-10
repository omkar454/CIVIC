import os
import sys
from utils import get_live_weather, get_area_density
from dotenv import load_dotenv

# Load ENV
load_dotenv()

def run_external_source_tests():
    print("\n" + "="*50)
    print("🚀 CIVIC EXTERNAL DATA ENGINE TEST")
    print("="*50 + "\n")

    # 1. API Key Status
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if api_key:
        print(f"✅ OpenWeather API Key: FOUND (Ends in ...{api_key[-4:]})")
    else:
        print("❌ OpenWeather API Key: MISSING in .env")

    # 2. Test Locations (Bandra Hotspots)
    locations = [
        {"name": "Lilavati Hospital (Emergency Hub)", "lat": 19.0511, "lng": 72.8272},
        {"name": "Bandra Station (High Density Hub)", "lat": 19.0543, "lng": 72.8397},
        {"name": "Bandra Reclamation (Residential)", "lat": 19.0494, "lng": 72.8222}
    ]

    for loc in locations:
        print(f"\n📍 Testing Location: {loc['name']}")
        print(f"   Coords: {loc['lat']}, {loc['lng']}")
        print("-" * 30)

        # A. Test Weather API
        print("☁️ Checking Weather API...")
        rain_impact = get_live_weather(loc['lat'], loc['lng'])
        status = "🌧️ RAINY/STORM (Priority Boost applied)" if rain_impact == 1 else "☀️ CLEAR/NORMAL"
        print(f"   Result: {status}")

        # B. Test OSM Overpass API
        print("🏢 Checking OSM Density API...")
        density = get_area_density(loc['lat'], loc['lng'])
        
        # Interpret result
        density_label = "NORMAL"
        if density > 0.8: density_label = "EXTREMELY DENSE (High Risk)"
        elif density > 0.6: density_label = "MODERATE DENSE"
        
        print(f"   Density Score: {density:.2f} ({density_label})")

    print("\n" + "="*50)
    print("🏁 TEST COMPLETE")
    print("="*50 + "\n")

if __name__ == "__main__":
    run_external_source_tests()
