import os
from pymongo import MongoClient
import urllib.parse

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
        # Check if a database name is explicitly given in the URI
        db = client.get_default_database()
    except Exception as e:
        # Fallback if no default database provided in URI (it assumes a "civic" database)
        print(f"Fallback to default DB due to: {e}")
        db = client.get_database("test") # Assuming "test" or change to your specific db if needed
        
    return db["reports"]
