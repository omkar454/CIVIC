import os
from pathlib import Path
from ultralytics import YOLO

# ---------------------------------------------------------
# Feature 1: Automated Categorization Engine
# ---------------------------------------------------------

# Resolve paths
BASE_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_PATH = BASE_DIR / "runs" / "civic_vision_model" / "weights" / "best.pt"

print("🔍 Initializing YOLOv8 Categorization Engine...")

# Load the model once when the FastAPI server starts
# It is extremely inefficient to load the model on every single API request.
try:
    if WEIGHTS_PATH.exists():
        model = YOLO(str(WEIGHTS_PATH))
        print("✅ Loaded Custom YOLO Weights!")
    else:
        # Graceful fallback: If training hasn't finished, use the base pretrained model.
        # This allows the API to run without crashing.
        model = YOLO("yolov8n.pt") 
        print("⚠️ Custom weights not found. Using fallback yolov8n.pt!")
except Exception as e:
    print(f"❌ Failed to load YOLO model: {e}")
    model = None

def detect_objects_yolo(image_url: str, text_hint: str = None) -> dict:
    """
    Downloads an image URL and runs YOLOv8 object detection on it.
    Uses 'text_hint' (Step 1: Text Brain) to prime the vision brain with a context-aware threshold.
    """
    if model is None:
        return {"tags": ["Vision Engine Offline"], "primary_box": None, "img_dims": (0, 0)}

    # 🧠 DYNAMIC THRESHOLD LOGIC (Context-Aware Vision) 🧠
    # If the user says Pothole, we be strict. If they say Garbage, we be sensitive.
    target_conf = 0.25 # Standard baseline
    if text_hint == "pothole":
        target_conf = 0.35 # Strict Mode: Prevent shadows/noise from being holes
    elif text_hint == "garbage":
        target_conf = 0.08 # Sensitive Mode: Catch even small litter/trash pieces

    try:
        # Run YOLO with the dynamic 'hint-driven' threshold
        results = model.predict(source=image_url, conf=target_conf, save=False)
        
        detected_classes = []
        total_bbox_area = 0.0
        img_dims = (1, 1)
        
        for result in results:
            img_dims = result.orig_shape # (height, width)
            
            for box in result.boxes:
                class_id = int(box.cls[0].item())
                class_name = model.names[class_id].lower()
                confidence = float(box.conf[0].item())
                
                # Since 'conf' filter was applied in .predict(), any box here is valid
                detected_classes.append(class_name)
                # Add to the total area calculation
                coords = box.xyxy[0].tolist()
                w = coords[2] - coords[0]
                h = coords[3] - coords[1]
                total_bbox_area += (w * h)
                
        # Return results with the TOTAL Area Ratio (all filtered boxes combined)
        return {
            "tags": list(set(detected_classes)),
            "total_area_ratio": total_bbox_area / (img_dims[0] * img_dims[1]) if (img_dims[0] * img_dims[1]) > 0 else 0,
            "img_dims": (img_dims[1], img_dims[0]) # (width, height)
        }
    except Exception as e:
        print(f"Vision Engine Prediction Error: {str(e)}")
        return {"tags": [], "total_area_ratio": 0, "img_dims": (0, 0)}
