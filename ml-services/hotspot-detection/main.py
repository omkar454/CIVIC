from fastapi import FastAPI, HTTPException
import os
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv

from utils.db_connector import get_db_collection
from models.clustering import compute_hotspots, predict_infrastructure_failures

# Load env variables (important for MONGO_URI)
load_dotenv()

app = FastAPI(title="CIVIC Hotspot Detection & Trend Analytics API", version="4.0.0")

@app.get("/")
def read_root():
    return {"status": "Hotspot Detection Service is running", "module": "Module 4"}

def _fetch_reports_dataframe(time_window_days: int = None, department: str = None):
    collection = get_db_collection()
    if collection is None:
        raise HTTPException(status_code=500, detail="Database connection not configured. Check MONGO_URI in .env")

    # Clustering logic: Fast Reactivity. Cluster all active problems (including Open).
    # Ignore spam/rejected and already-fixed (Resolved) issues.
    query = {"status": {"$nin": ["Resolved", "Rejected"]}}
    if time_window_days:
        cutoff_date = datetime.utcnow() - timedelta(days=time_window_days)
        query["createdAt"] = {"$gte": cutoff_date}
        
    if department:
        # Case-insensitive match on the actual MONGODB 'department' field, not 'category'
        import re
        query["department"] = {"$regex": f"^{re.escape(department)}$", "$options": "i"}
        
    # Fetch reports (only those with valid coordinates)
    reports_cursor = collection.find(query, {"location": 1, "severity": 1, "category": 1, "createdAt": 1})
    
    data = []
    for r in reports_cursor:
        loc = r.get("location", {})
        coords = loc.get("coordinates", [])
        
        # Ensure it's a valid Point with [lng, lat]
        if loc.get("type") == "Point" and len(coords) == 2:
            data.append({
                "id": str(r["_id"]),
                # MongoDB stores location coordinates as [longitude, latitude] by default
                "lng": float(coords[0]),
                # Adding some safety fallback parsing logic in case order is flipped, 
                # but standard geoJSON is [lng, lat]
                "lat": float(coords[1]),
                "severity": r.get("severity", 0) or 0,
                "category": r.get("category", "other"),
                "created_at": r.get("createdAt")
            })

    return pd.DataFrame(data)

@app.get("/api/hotspots/current")
def get_current_hotspots(epsilon_km: float = 2.0, min_samples: int = 3, days: int = 30, department: str = None):
    """
    Returns spatial hotspots by running DBSCAN clustering over recent reports.
    """
    df = _fetch_reports_dataframe(time_window_days=days, department=department)
    if df.empty:
        return {"hotspots": []}
        
    hotspots = compute_hotspots(df, epsilon_km=epsilon_km, min_samples=min_samples)
    return {"hotspots": hotspots}

@app.get("/api/predict/infrastructure")
def get_failure_predictions(days: int = 90, department: str = None):
    """
    Forecasts future major issues based on historical spatial density and failure rates.
    """
    # Fetch a longer historical context for predictions
    df = _fetch_reports_dataframe(time_window_days=days, department=department)
    if df.empty:
        return {"predictions": []}
        
    predictions = predict_infrastructure_failures(df)
    
    # Sort by highest risk first
    predictions = sorted(predictions, key=lambda x: x["risk_score"], reverse=True)
    return {"predictions": predictions}

if __name__ == "__main__":
    import uvicorn
    # Make sure this runs on port 8002 to avoid collision with Vision (8000) and Predictive (8001)
    uvicorn.run(app, host="0.0.0.0", port=8002)
