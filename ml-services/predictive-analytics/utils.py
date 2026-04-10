import requests
import overpy
import math
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("OPENWEATHER_API_KEY")

def get_live_weather(lat, lng):
    """
    Fetches real-time weather from OpenWeatherMap.
    Returns: 1 if Rainy/Stormy, 0 otherwise.
    """
    if not API_KEY:
        print("⚠️ Warning: OPENWEATHER_API_KEY not found. Defaulting to Clear weather.")
        return 0
        
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lng}&appid={API_KEY}"
        res = requests.get(url, timeout=5)
        data = res.json()
        
        main_weather = data.get("weather", [{}])[0].get("main", "Clear")
        # If it's raining, snowing, or stormy, we return 1 (High Impact)
        if main_weather in ["Rain", "Thunderstorm", "Drizzle", "Snow"]:
            return 1
        return 0
    except Exception as e:
        print(f"❌ Weather API Error: {e}")
        return 0

def get_population_density(lat, lng):
    """
    Fetches real-time demographic data from WorldPop API.
    Returns estimated people count in the vicinity.
    """
    from config import BANDRA_HOTSPOTS
    
    # 📍 PRE-EMPTIVE CHECK: Get nearest landmark info
    landmark_name = get_nearest_landmark(lat, lng)
    landmark_data = BANDRA_HOTSPOTS.get(landmark_name) if landmark_name else None
    
    # WorldPop stats API (Dataset wpgppop = WorldPop Global Project Population)
    url = f"https://api.worldpop.org/v1/services/stats?dataset=wpgppop&year=2020&geojson={{'type':'Point','coordinates':[{lng},{lat}]}}"
    
    try:
        res = requests.get(url, timeout=3)
        res.raise_for_status()
        data = res.json()
        
        # Extract total population
        pop = data.get('data', {}).get('total_population', 0)
        
        # 🧠 INTELLIGENT FALLBACK: If WorldPop returns 0 (or async 'created' status), 
        # use Landmark-specific pop or Bandra baseline.
        if pop == 0:
            if landmark_data:
                print(f"🧠 AI Memory: WorldPop unavailable. Using {landmark_name} baseline pop: {landmark_data['pop']}")
                return float(landmark_data['pop'])
            print(f"⚠️ WorldPop returned 0 for {lat},{lng}. Using Bandra average fallback.")
            return 12000.0 
            
        return float(pop)
    except Exception as e:
        if landmark_data:
            print(f"🧠 AI Memory: WorldPop Error. Using {landmark_name} baseline pop: {landmark_data['pop']}")
            return float(landmark_data['pop'])
        print(f"❌ WorldPop API Error: {e}")
        return 10000.0

def get_area_density(lat, lng):
    """
    Uses OpenStreetMap (Overpass API) to calculate urban infrastructure density.
    Counts buildings and amenities within 500m radius.
    Includes failover to multiple servers if load is high.
    """
    from config import BANDRA_HOTSPOTS
    landmark_name = get_nearest_landmark(lat, lng)
    landmark_data = BANDRA_HOTSPOTS.get(landmark_name) if landmark_name else None

    # List of reliable public Overpass instances
    OVERPASS_SERVERS = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter"
    ]
    
    query = f"""
    [out:json][timeout:5];
    (
      node["building"](around:500, {lat}, {lng});
      node["amenity"](around:500, {lat}, {lng});
      node["shop"](around:500, {lat}, {lng});
    );
    out;
    """
    
    last_error = ""
    for server_url in OVERPASS_SERVERS:
        try:
            api = overpy.Overpass(url=server_url)
            result = api.query(query)
            count = len(result.nodes) + len(result.ways)
            
            score = min(1.0, max(0.1, (math.log10(count + 1) / 3.0)))
            return score
        except Exception as e:
            last_error = str(e)
            print(f"⚠️ OSM Server ({server_url.split('/')[2]}) busy or error. Trying next...")
            continue 

    # 🧠 INTELLIGENT FALLBACK: If OSM is down, use Landmark infra proxy
    if landmark_data:
        print(f"🧠 AI Memory: OSM Servers down. Using {landmark_name} infra proxy: {landmark_data['infra_proxy']}")
        return float(landmark_data['infra_proxy'])

    print(f"❌ All OSM Overpass Servers failed. Last error: {last_error}")
    return 0.6 

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Haversine distance between two points in meters.
    """
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def get_nearest_landmark(lat, lng):
    """
    Identifies if a coordinate is near a critical Bandra hotspot.
    Returns the landmark name if within 500m.
    """
    from config import BANDRA_HOTSPOTS
    nearest_name = None
    min_dist = float('inf')
    
    for name, hub in BANDRA_HOTSPOTS.items():
        h_lat, h_lng = hub["coords"]
        dist = calculate_distance(lat, lng, h_lat, h_lng)
        if dist < min_dist:
            min_dist = dist
            nearest_name = name
            
    if min_dist <= 500:
        return nearest_name
    return None
