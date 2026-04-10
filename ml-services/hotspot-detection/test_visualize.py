import os
import json
from dotenv import load_dotenv

load_dotenv()

from main import _fetch_reports_dataframe
from models.clustering import compute_hotspots, predict_infrastructure_failures

def generate_leaflet_map():
    print("--------------------------------------------------")
    print("🗺️ GENERATING INTERACTIVE LEAFLET TEST MAP")
    print("--------------------------------------------------\n")
    
    try:
        df = _fetch_reports_dataframe(time_window_days=180)
    except Exception as e:
        print(f"Error fetching DB: {e}")
        return

    if df.empty:
        print("No valid location data found in DB.")
        return
        
    print("Running DBSCAN and Predictive Logic...")
    hotspots = compute_hotspots(df, epsilon_km=2.0, min_samples=3)
    predictions = predict_infrastructure_failures(df)
    
    # Generate HTML string with embedded Leaflet JS
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>CIVIC - ML Hotspot Visualizer</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
            body {{ margin: 0; padding: 0; font-family: sans-serif; }}
            #map {{ width: 100vw; height: 100vh; }}
            .legend {{ background: white; padding: 10px; border-radius: 5px; box-shadow: 0 0 15px rgba(0,0,0,0.2); position: absolute; top: 10px; right: 10px; z-index: 1000; }}
        </style>
    </head>
    <body>
        <div class="legend">
            <h3>AI Analytics Engine</h3>
            <div><span style="color:red; font-size:20px;">■</span> Critical Predictions</div>
            <div><span style="color:orange; font-size:20px;">■</span> Warning Zones</div>
            <div><span style="color:blue; font-size:20px;">■</span> DBSCAN Cluster Bounds</div>
        </div>
        <div id="map"></div>

        <script>
            // Initialize map to a generic Mumbai center, will be dynamically bounded later
            var map = L.map('map').setView([19.0760, 72.8777], 11);
            
            L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }}).addTo(map);

            const hotspots = {json.dumps(hotspots)};
            const predictions = {json.dumps(predictions)};
            
            // 1. Draw DBSCAN Bounds
            hotspots.forEach(h => {{
                let bounds = [[h.bounds.min_lat, h.bounds.min_lng], [h.bounds.max_lat, h.bounds.max_lng]];
                L.rectangle(bounds, {{color: "#3388ff", weight: 2, fillOpacity: 0.1}}).addTo(map)
                 .bindPopup(`<b>Cluster ${{h.cluster_id}}</b><br>Total Issues: ${{h.point_count}}<br>Avg Severity: ${{h.average_severity.toFixed(2)}}`);
            }});

            // 2. Draw Predictive Zones (Circles)
            predictions.forEach(p => {{
                let color = p.trend_status === "CRITICAL" ? "red" : (p.trend_status === "WARNING" ? "orange" : "green");
                
                L.circle([p.zone.lat, p.zone.lng], {{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.4,
                    radius: p.radius_km * 1000 // Convert KM to Meters
                }}).addTo(map).bindPopup(
                    `<b>${{p.trend_status}} ZONE</b><br>` +
                    `Failure Risk Score: ${{p.risk_score.toFixed(2)}}<br>` +
                    `Predicted to fail in: ${{p.predicted_failure_days}} days<br>` +
                    `Primary Causes: ${{p.primary_issues.join(', ')}}`
                );
            }});
        </script>
    </body>
    </html>
    """

    filename = "hotspot_test_map.html"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    print(f"✅ MAP GENERATED SUCCESSFULLY!")
    print(f"📂 Open this file in your browser to view the Leaflet Map: ")
    print(f"   -> {os.path.abspath(filename)}")
    print("--------------------------------------------------")

if __name__ == "__main__":
    generate_leaflet_map()
