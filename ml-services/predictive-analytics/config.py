# 🏆 Bandra LANDMARKS Intelligence (Shared Config)
BANDRA_HOTSPOTS = {
    # Emergency Hubs (High Multiplier + High Pop)
    "Lilavati Hospital": {"coords": (19.0511, 72.8272), "mult": 1.9, "pop": 60000, "infra_proxy": 0.85},
    "Holy Family Hospital": {"coords": (19.0558, 72.8306), "mult": 1.8, "pop": 55000, "infra_proxy": 0.8},
    "Bhabha Hospital": {"coords": (19.0583, 72.8346), "mult": 1.8, "pop": 65000, "infra_proxy": 0.8},
    "Guru Nanak Hospital": {"coords": (19.0573, 72.8485), "mult": 1.8, "pop": 50000, "infra_proxy": 0.75},
    "Asian Heart Institute": {"coords": (19.0621, 72.8647), "mult": 1.9, "pop": 45000, "infra_proxy": 0.9},
    "Bandra Police Station": {"coords": (19.0559, 72.8344), "mult": 2.0, "pop": 40000, "infra_proxy": 0.8},
    "Bandra Fire Station": {"coords": (19.0565, 72.8358), "mult": 2.2, "pop": 40000, "infra_proxy": 0.85},
    "BKC Police Station": {"coords": (19.0655, 72.8658), "mult": 2.0, "pop": 35000, "infra_proxy": 0.9},
    
    # Arteries & Central Junctions (Strategic Flow)
    "SV Road Junction": {"coords": (19.0544, 72.8400), "mult": 1.7, "pop": 80000, "infra_proxy": 0.95},
    "Linking Road Junction": {"coords": (19.0631, 72.8346), "mult": 1.6, "pop": 70000, "infra_proxy": 0.9},
    "Hill Road Junction": {"coords": (19.0553, 72.8322), "mult": 1.6, "pop": 75000, "infra_proxy": 0.85},
    "BWSL Toll": {"coords": (19.0435, 72.8202), "mult": 1.5, "pop": 30000, "infra_proxy": 0.6},
    
    # Flood Hotspots (Critical during Rain)
    "Milan Subway": {"coords": (19.0834, 72.8427), "mult": 2.0, "pop": 50000, "flood": True, "infra_proxy": 0.7},
    "Kherwadi Junction": {"coords": (19.0592, 72.8475), "mult": 1.7, "pop": 55000, "flood": True, "infra_proxy": 0.85},
    
    # High-Density Zones
    "Bandra Station West": {"coords": (19.0544, 72.8400), "mult": 2.2, "pop": 90000, "infra_proxy": 1.0},
    "Behrampada": {"coords": (19.0551, 72.8436), "mult": 1.8, "pop": 100000, "infra_proxy": 0.9},
    "Carter Road": {"coords": (19.0665, 72.8239), "mult": 1.4, "pop": 45000, "infra_proxy": 0.5},
    
    # Schools & Sensitive Zones
    "Mount Mary Area": {"coords": (19.0465, 72.8249), "mult": 1.5, "pop": 35000, "infra_proxy": 0.6},
    "St. Andrews Area": {"coords": (19.0538, 72.8286), "mult": 1.5, "pop": 40000, "infra_proxy": 0.7},
    "DAIS BKC": {"coords": (19.0645, 72.8653), "mult": 1.6, "pop": 30000, "infra_proxy": 0.9}
}

CATEGORIES = [
    "pothole", "garbage", "streetlight", "water-logging", 
    "toilet", "water-supply", "drainage", "waste-management", 
    "park", "other"
]
