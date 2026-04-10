import os
from pymongo import MongoClient

def get_db_collection():
    """
    Connects to MongoDB using the MONGO_URI in environment variables and returns the reports collection.
    """
    uri = os.getenv("MONGO_URI")
    if not uri:
        print("WARNING: MONGO_URI not found in env. Ensure it is set.")
        return None
    
    try:
        client = MongoClient(uri)
        db = client.get_default_database()
    except Exception as e:
        print(f"Fallback to default DB due to: {e}")
        db = client.get_database("test")
        
    return db["reports"]
