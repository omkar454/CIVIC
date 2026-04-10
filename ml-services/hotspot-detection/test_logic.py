import os
import json
from dotenv import load_dotenv
from pprint import pprint

load_dotenv()

from main import _fetch_reports_dataframe
from models.clustering import compute_hotspots, predict_infrastructure_failures

def run_detailed_test():
    print("==========================================================")
    print("🧠 HOTSPOT DETECTION & PREDICTIVE ANALYTICS DIAGNOSTIC RUN")
    print("==========================================================\n")
    
    print("[1] FETCHING HISTORICAL DATA")
    try:
        df = _fetch_reports_dataframe(time_window_days=180)
        print(f" -> Connected to MongoDB successfully.")
        print(f" -> Pulled {len(df)} active/resolved reports with valid geographical coordinates.\n")
    except Exception as e:
        print(f" -> ERROR: Connection failed: {str(e)}")
        return

    if df.empty:
        print(" -> ERROR: No valid location data found in DB.")
        return
        
    print("[2] EXECUTING DBSCAN CLUSTERING ALGORITHM")
    print(" -> Epsilon (Radius): 2.0 KM")
    print(" -> Min Samples (Density Threshold): 3 Reports")
    print(" -> Engine: Scikit-Learn (Metric: Haversine - Earth Curvature Adjusted)\n")
    
    hotspots = compute_hotspots(df, epsilon_km=2.0, min_samples=3)
    
    print(f" -> RESULTS: Algorithm isolated {len(hotspots)} distinct neighborhoods (hotspots) while filtering out ambient noise.")
    
    if hotspots:
        biggest_cluster = max(hotspots, key=lambda x: x['point_count'])
        print(f"\n   [Deep Dive] 🚨 Heaviest Density Cluster (ID: {biggest_cluster['cluster_id']})")
        print(f"   - Geometric Center: Lat {biggest_cluster['center']['lat']:.4f}, Lng {biggest_cluster['center']['lng']:.4f}")
        print(f"   - Total Concentrated Issues: {biggest_cluster['point_count']}")
        print(f"   - Average Citizen Severity Rating: {biggest_cluster['average_severity']:.2f} / 5.0")
        print(f"   - Top 3 Underlying Issues:")
        
        # Sort dictionary of categories by count
        top_cats = sorted(biggest_cluster['top_categories'].items(), key=lambda item: item[1], reverse=True)[:3]
        for cat, count in top_cats:
            print(f"      * {cat.upper()}: {count} reports")

    print("\n==========================================================")
    
    print("\n[3] EXECUTING INFRASTRUCTURE FAILURE PREDICTIONS")
    print(" -> Processing clusters through Risk Matrix (Volume vs. Severity).")
    print(" -> Base Formula: (Volume * 1.5) + (Average Severity * 5)\n")
    
    predictions = predict_infrastructure_failures(df)
    predictions = sorted(predictions, key=lambda x: x["risk_score"], reverse=True)
    
    print(f" -> RESULTS: Evaluated {len(predictions)} zones for systemic failure risk.\n")
    
    for idx, p in enumerate(predictions[:3]):
        status_color = "🔴" if p['trend_status'] == "CRITICAL" else "🟠" if p['trend_status'] == "WARNING" else "🟢"
        print(f"   [{idx + 1}] {status_color} {p['trend_status']} ZONE (Score: {p['risk_score']:.2f})")
        print(f"       - Estimated Failure Timeframe: Within {p['predicted_failure_days']} days.")
        print(f"       - Root Causes: {', '.join(p['primary_issues']).title()}")
        print(f"       - Target Area: Lat {p['zone']['lat']:.4f}, Lng {p['zone']['lng']:.4f}\n")
        
    print("==========================================================")
    print("✅ DIAGNOSTICS COMPLETE")
    print("==========================================================")

if __name__ == "__main__":
    run_detailed_test()
