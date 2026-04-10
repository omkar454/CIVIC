from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import os
from utils import get_live_weather, get_area_density, get_population_density, get_nearest_landmark
from config import CATEGORIES
from datetime import datetime, timedelta

app = FastAPI(title="CIVIC Predictive Analytics API", version="3.0.0")

# Load the trained Model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models/priority_model.pkl")

class PriorityRequest(BaseModel):
    lat: float
    lng: float
    severity: int
    votes: int
    category: str

@app.get("/")
def read_root():
    return {"status": "Predictive Analytics is running", "module": "Module 3"}

@app.post("/api/predict/priority")
async def predict_priority(request: PriorityRequest):
    """
    Combines AI Model + Live Environment Data to calculate Smart Priority.
    """
    if not os.path.exists(MODEL_PATH):
        raise HTTPException(status_code=503, detail="AI Model not trained yet. Deploy training/train_priority.py first.")
        
    model = joblib.load(MODEL_PATH)
    
    # 1. Fetch Live Context (Dual Density + Weather + Landmarks)
    is_raining = get_live_weather(request.lat, request.lng)
    area_density = get_area_density(request.lat, request.lng)
    population_density = get_population_density(request.lat, request.lng)
    nearest_landmark = get_nearest_landmark(request.lat, request.lng)
    
    # 2. Encode Category
    try:
        cat_index = CATEGORIES.index(request.category.lower())
    except ValueError:
        cat_index = CATEGORIES.index("other")
        
    # 3. Prepare Feature Vector
    features = pd.DataFrame([{
        "lat": request.lat,
        "lng": request.lng,
        "severity": request.severity,
        "votes": request.votes,
        "category": cat_index,
        "is_raining": int(is_raining),
        "population_density": population_density,
        "area_density": area_density
    }])
    
    # 4. Predict Smart Score
    raw_score = model.predict(features)[0]
    final_score = min(1.0, max(0.0, float(raw_score)))
    
    # 5. Calculate Predicted ETA
    days_to_add = 7
    if final_score >= 0.8: days_to_add = 2
    elif final_score >= 0.5: days_to_add = 4
    
    predicted_eta = datetime.now() + timedelta(days=days_to_add)
    
    # 6. Generate Explanatory Factors
    factors = []
    if is_raining: factors.append("Active weather impact (Rain)")
    if nearest_landmark: factors.append(f"Proximity to critical zone: {nearest_landmark}")
    if population_density > 50000: factors.append("High human impact index")
    if area_density > 0.7: factors.append("High urban infrastructure density")
    if request.severity >= 4: factors.append("Critical visual severity")
    if request.votes > 20: factors.append("Significant community demand")

    final_smart_score = round(final_score * 100, 2)

    return {
        "smartPriorityScore": final_smart_score,
        "predictedETA": predicted_eta.isoformat(),
        "isRaining": bool(is_raining),
        "areaDensity": round(area_density, 2),
        "populationDensity": round(population_density, 0),
        "nearestLandmark": nearest_landmark,
        "priorityFactors": factors
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
