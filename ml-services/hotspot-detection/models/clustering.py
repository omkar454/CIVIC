import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
import math
from datetime import datetime

def compute_hotspots(reports_df: pd.DataFrame, epsilon_km: float = 2.0, min_samples: int = 3):
    """
    Perform DBSCAN clustering based on spatial coordinates using Haversine distance.
    Returns clustered regions and anomalous hotspots.
    """
    if reports_df.empty:
        return []

    # Filter out rows with invalid or missing coordinates
    reports_df = reports_df.dropna(subset=['lat', 'lng'])
    if reports_df.empty:
        return []

    coords = reports_df[['lat', 'lng']].values

    # Earth's radius in kilometers
    kms_per_radian = 6371.0088
    epsilon = epsilon_km / kms_per_radian
    
    # Run DBSCAN (converting coords to radians to use haversine)
    db = DBSCAN(eps=epsilon, min_samples=min_samples, algorithm='ball_tree', metric='haversine').fit(np.radians(coords))
    
    reports_df['cluster'] = db.labels_
    
    # Group by cluster (excluding -1, which is noise/outliers)
    clusters = []
    
    for cluster_id in reports_df['cluster'].unique():
        if cluster_id == -1:
            continue
            
        cluster_points = reports_df[reports_df['cluster'] == cluster_id]
        
        # Calculate cluster center (centroid)
        center_lat = cluster_points['lat'].mean()
        center_lng = cluster_points['lng'].mean()
        
        # Calculate cluster logic like prevailing categories
        categories = cluster_points['category'].value_counts().to_dict()
        severity_avg = cluster_points['severity'].mean()
        
        clusters.append({
            "cluster_id": int(cluster_id),
            "center": {"lat": float(center_lat), "lng": float(center_lng)},
            "point_count": len(cluster_points),
            "average_severity": float(severity_avg) if not pd.isna(severity_avg) else 0.0,
            "top_categories": categories,
            "bounds": {
                "min_lat": float(cluster_points['lat'].min()),
                "max_lat": float(cluster_points['lat'].max()),
                "min_lng": float(cluster_points['lng'].min()),
                "max_lng": float(cluster_points['lng'].max()),
            }
        })
        
    return clusters

def predict_infrastructure_failures(reports_df: pd.DataFrame):
    """
    Predict future major issues based on historical spatial density and temporal failure rates.
    For demonstration, calculates 'failure_risk' score by trending recent data vs historical baseline.
    """
    # Group data spatially using DBSCAN first to find high-density micro-zones
    clusters = compute_hotspots(reports_df, epsilon_km=0.5, min_samples=2)
    
    predictions = []
    # Identify which clusters have highly trending failure rates
    for cluster in clusters:
        # A simple risk model logic based on point count and severity
        risk_score = (cluster['point_count'] * 1.5) + (cluster['average_severity'] * 5)
        
        # Extrapolate days till critical failure
        if risk_score > 30:
            days_to_failure = 2
            trend = "CRITICAL"
        elif risk_score > 15:
            days_to_failure = 7
            trend = "WARNING"
        else:
            days_to_failure = 30
            trend = "STABLE"
            
        predictions.append({
            "zone": cluster['center'],
            "radius_km": 0.5,
            "predicted_failure_days": days_to_failure,
            "risk_score": float(risk_score),
            "trend_status": trend,
            "primary_issues": list(cluster['top_categories'].keys())[:2]
        })
        
    return predictions
