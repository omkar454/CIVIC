import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
import joblib
import os
import math
import sys
from pathlib import Path

# Add the parent directory to sys.path to allow importing 'config'
sys.path.append(str(Path(__file__).parent.parent))

# Helper: Simple distance calculation (Haversine-lite for small regions like Bandra)
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# Bandra Landmarks Intelligence (Integrated into Synthetic Generator below)

# Define the Bandra Boundary for Data Generation
BANDRA_POLYGON = [
    (19.0804, 72.8237), (19.0801, 72.8519), (19.0692, 72.8523),
    (19.0624, 72.8571), (19.0443, 72.8539), (19.0369, 72.848),
    (19.0348, 72.8336), (19.0421, 72.8157), (19.0554, 72.8095),
    (19.0707, 72.8168)
]

def is_in_polygon(lat, lng, polygon):
    # Simple bounding box check for training speed
    lats = [p[0] for p in polygon]
    lngs = [p[1] for p in polygon]
    return min(lats) <= lat <= max(lats) and min(lngs) <= lng <= max(lngs)

from config import BANDRA_HOTSPOTS

def generate_synthetic_data(samples=6000):
    data = []
    for _ in range(samples):
        # 1. Random Location in Bandra Polygon
        lat = np.random.uniform(19.034, 19.090)
        lng = np.random.uniform(72.809, 72.870)
        
        # 2. Base Features
        severity = np.random.randint(1, 6)
        votes = np.random.randint(0, 100)
        category = np.random.randint(0, 10)
        is_raining = np.random.choice([0, 1], p=[0.8, 0.2])
        
        # 3. Calculate Hub Boosts (Infrastructure & Population)
        hub_boost = 1.0
        pop_density = np.random.uniform(15000, 30000)
        area_density = np.random.uniform(0.1, 0.3)
        
        for name, hub in BANDRA_HOTSPOTS.items():
            h_lat, h_lng = hub["coords"]
            dist = np.sqrt((lat - h_lat)**2 + (lng - h_lng)**2)
            if dist < 0.005: 
                h_mult = hub["mult"]
                # ⛈️ Weather Sensitivity: Flood zones get extra weight during rain
                if is_raining and hub.get("flood"):
                    h_mult *= 1.5
                
                hub_boost = max(hub_boost, h_mult)
                pop_density = max(pop_density, np.random.normal(hub["pop"], 5000))
                area_density = max(area_density, np.random.uniform(0.6, 0.9))
        
        # 4. Smart Target Calculation (Context-Aware Logic - Calibrated V2)
        # We use a weighted additive model to ensure a better dynamic range.
        
        # Core Components (Scaled to a 0.0 - 1.0 baseline)
        sev_score = (severity / 5.0) * 0.40        # Severity is the primary gatekeeper (40%)
        pop_score = (min(pop_density, 100000) / 100000.0) * 0.15
        infra_score = (area_density) * 0.15
        weather_score = (is_raining) * 0.15
        vote_score = (min(votes, 100) / 100.0) * 0.15
        
        target = sev_score + pop_score + infra_score + weather_score + vote_score

        # 🧠 SMART USE CASES (Refined Synergistic Boosts)
        # These are now smaller additive bonuses to avoid "clumping" at 100.
        
        # Scenario A: Monsoon Crisis (Rain + Drainage/Water-logging)
        if is_raining and (category == 3 or category == 6):
            target += 0.15 
            
        # Scenario B: Public Health Risk (Garbage/Toilets in High-Density Spots)
        if area_density > 0.7 and (category == 1 or category == 4):
            target += 0.08 
            
        # Scenario C: Safety (No Streetlights in Crowded Areas)
        if pop_density > 70000 and category == 2:
            target += 0.10
            
        # Scenario D: Infrastructure Impact (Potholes in Strategic Arteries)
        if hub_boost > 1.5 and category == 0:
            target += 0.08
            
        # 📍 Hub Bonus (Now additive instead of multiplicative)
        # This gives a boost for proximity to critical landmarks without pinning it to 100.
        target += (hub_boost - 1.0) * 0.25 
        
        # Final Clamp
        target = min(1.0, max(0.0, target))
        
        data.append({
            "lat": lat,
            "lng": lng,
            "severity": severity,
            "votes": votes,
            "category": category,
            "is_raining": is_raining,
            "population_density": pop_density,
            "area_density": area_density,
            "target": target
        })
    
    return pd.DataFrame(data)

# Main training block
def train_model():
    print("🚀 Generating Enhanced Synthetic Dataset (Weather + Dual Density)...")
    df = generate_synthetic_data(5000)
    
    features_cols = ["lat", "lng", "severity", "votes", "category", "is_raining", "population_density", "area_density"]
    X = df[features_cols]
    y = df["target"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("🧠 Training XGBoost Priority Model V3.1 (Infrastructure Aware)...")
    model = xgb.XGBRegressor(
        n_estimators=200,
        learning_rate=0.07,
        max_depth=7,
        objective="reg:squarederror"
    )
    
    model.fit(X_train, y_train)
    
    # Save the model
    os.makedirs("models", exist_ok=True)
    joblib.dump(model, "models/priority_model.pkl")
    print("✅ Model trained and saved to models/priority_model.pkl")
    
    # Quick Test Prediction
    test_val = X.iloc[0:1]
    pred = model.predict(test_val)[0]
    print(f"📊 Sample Prediction: {pred:.4f} (Actual: {y.iloc[0]:.4f})")

if __name__ == "__main__":
    train_model()
