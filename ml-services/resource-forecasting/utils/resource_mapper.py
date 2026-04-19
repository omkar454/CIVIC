# utils/resource_mapper.py

RESOURCE_RATIOS = {
    "Pothole": {
        "materials": [
            {"name": "Bitumen Mix", "qty": 2.0, "unit": "bags"},
            {"name": "Sealant", "qty": 0.5, "unit": "liters"},
            {"name": "Traffic Cones", "qty": 0.1, "unit": "units"}
        ],
        "workforce": [
            {"role": "Road Crew", "hours": 1.5}
        ]
    },
    "Garbage": {
        "materials": [
            {"name": "Industrial Bags", "qty": 5.0, "unit": "packs"},
            {"name": "Disinfectant Spray", "qty": 1.0, "unit": "liters"}
        ],
        "workforce": [
            {"role": "Sanitation Staff", "hours": 2},
            {"role": "Truck Driver", "hours": 1}
        ]
    },
    "Water Supply": {
        "materials": [
            {"name": "Pipe Sealant", "qty": 0.2, "unit": "kg"},
            {"name": "Emergency Valves", "qty": 0.1, "unit": "units"}
        ],
        "workforce": [
            {"role": "Plumber", "hours": 4}
        ]
    },
    "Drainage": {
        "materials": [
            {"name": "De-clogging Agent", "qty": 2.5, "unit": "liters"},
            {"name": "Safety Mesh", "qty": 1, "unit": "meters"}
        ],
        "workforce": [
            {"role": "Drainage Specialist", "hours": 5}
        ]
    },
    "Streetlight": {
        "materials": [
            {"name": "LED Bulb (75W)", "qty": 1, "unit": "units"},
            {"name": "Wiring Kit", "qty": 0.5, "unit": "units"}
        ],
        "workforce": [
            {"role": "Electrician", "hours": 2}
        ]
    }
}

def map_volume_to_resources(category_forecasts: dict):
    """
    Translates predicted report volumes into specific material and workforce requirements.
    """
    integrated_resources = {}

    for category, data in category_forecasts.items():
        volume = data.get("total_demand_forecast", 0)
        
        # Determine mapping key (partial match)
        cat_str = str(category) if category else "other"
        mapping_key = next((k for k in RESOURCE_RATIOS.keys() if k.lower() in cat_str.lower()), None)
        
        if not mapping_key:
            continue

        ratios = RESOURCE_RATIOS[mapping_key]
        
        category_resources = {
            "materials": [],
            "workforce": []
        }

        # 🔧 Calculate Material Quantities
        for m in ratios["materials"]:
            category_resources["materials"].append({
                "name": m["name"],
                "total_needed": round(m["qty"] * volume, 1),
                "unit": m["unit"]
            })

        # 👷 Calculate Labor Hours
        for w in ratios["workforce"]:
            category_resources["workforce"].append({
                "role": w["role"],
                "total_man_hours": round(w["hours"] * volume, 1)
            })

        integrated_resources[category] = category_resources

    return integrated_resources

def aggregate_resources(integrated_resources: dict):
    """
    Merges multiple departmental resource plans into a single 'City-Wide' aggregate.
    Useful for Admin 'General' view.
    """
    if not integrated_resources:
        return {}

    total_materials = {}
    total_workforce = {}

    for cat, res in integrated_resources.items():
        # Aggregate Materials
        for m in res.get("materials", []):
            m_key = f"{m['name']}|{m['unit']}"
            if m_key not in total_materials:
                total_materials[m_key] = {
                    "name": m["name"], 
                    "total_needed": 0, 
                    "unit": m["unit"]
                }
            total_materials[m_key]["total_needed"] += m["total_needed"]

        # Aggregate Workforce
        for w in res.get("workforce", []):
            w_role = w["role"]
            if w_role not in total_workforce:
                total_workforce[w_role] = {
                    "role": w_role, 
                    "total_man_hours": 0
                }
            total_workforce[w_role]["total_man_hours"] += w["total_man_hours"]

    return {
        "City-Wide": {
            "materials": [v for v in total_materials.values()],
            "workforce": [v for v in total_workforce.values()]
        }
    }
