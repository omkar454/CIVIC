# utils/geo_utils.py
import requests
import time

# 🧠 Shared Geospatial Cache (Prevents Nominatim Rate-Limiting & Speeds up UI)
_ADDRESS_CACHE = {}
_CACHE_TTL = 86400  # 24 Hours

def get_human_address(lat, lng):
    """
    Utility to convert coordinates to a human-readable address via Nominatim.
    Includes a 24-hour cache to respect OSM rate limits and improve performance.
    """
    cache_key = f"{round(float(lat), 4)}_{round(float(lng), 4)}"
    
    # 🏎️ Check Cache first
    if cache_key in _ADDRESS_CACHE:
        entry = _ADDRESS_CACHE[cache_key]
        if time.time() - entry["timestamp"] < _CACHE_TTL:
            return entry["address"]

    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}"
        headers = {"User-Agent": "CivicIssueTracker/1.0"}
        res = requests.get(url, headers=headers, timeout=5)
        
        if res.status_code == 200:
            address = res.json().get("display_name", f"Lat: {lat}, Lng: {lng}")
            
            # 💾 Store in Cache
            _ADDRESS_CACHE[cache_key] = {
                "address": address,
                "timestamp": time.time()
            }
            return address
    except Exception as e:
        print(f"Reverse Geocoding Error: {e}")
        
    return f"Lat: {lat}, Lng: {lng}"
