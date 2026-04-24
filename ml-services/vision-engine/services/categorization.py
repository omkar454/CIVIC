import os
from pathlib import Path
from ultralytics import YOLO
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
import cv2
import numpy as np
import io
from PIL import Image

# Load .env from the vision-engine directory
load_dotenv()

# ---------------------------------------------------------
# Feature 1: Automated Categorization Engine
# ---------------------------------------------------------

# Resolve paths
BASE_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_PATH = BASE_DIR / "runs" / "civic_vision_model" / "weights" / "best.pt"

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

print("🔍 Initializing YOLOv8 Categorization Engine...")

# Load the model once when the FastAPI server starts
try:
    if WEIGHTS_PATH.exists():
        model = YOLO(str(WEIGHTS_PATH))
        print("✅ Loaded Custom YOLO Weights!")
    else:
        model = YOLO("yolov8n.pt") 
        print("⚠️ Custom weights not found. Using fallback yolov8n.pt!")
except Exception as e:
    print(f"❌ Failed to load YOLO model: {e}")
    model = None

def detect_objects_yolo(image_url: str, text_hint: str = None) -> dict:
    """
    Downloads an image URL and runs YOLOv8 object detection on it.
    Generates an annotated image and uploads to Cloudinary.
    """
    if model is None:
        return {"tags": ["Vision Engine Offline"], "primary_box": None, "img_dims": (0, 0), "annotatedImageUrl": None}

    target_conf = 0.25
    if text_hint == "pothole":
        target_conf = 0.55 # Increased to be stricter, avoiding shadows/noise being marked as potholes
    elif text_hint == "garbage":
        target_conf = 0.10 # Lowered to be more sensitive to scattered garbage

    try:
        # Run YOLO
        results = model.predict(source=image_url, conf=target_conf, save=False)
        
        detected_classes = []
        total_bbox_area = 0.0
        img_dims = (1, 1)
        annotated_url = None

        for result in results:
            img_dims = result.orig_shape # (height, width)
            
            # Generate Annotated Image if boxes exist
            if len(result.boxes) > 0:
                # results.plot() returns BGR numpy array
                annotated_img_bgr = result.plot()
                # Convert BGR to RGB
                annotated_img_rgb = cv2.cvtColor(annotated_img_bgr, cv2.COLOR_BGR2RGB)
                # Convert to PIL Image
                pil_img = Image.fromarray(annotated_img_rgb)
                
                # Save to buffer
                img_byte_arr = io.BytesIO()
                pil_img.save(img_byte_arr, format='JPEG')
                img_byte_arr.seek(0)
                
                # Upload to Cloudinary
                upload_result = cloudinary.uploader.upload(
                    img_byte_arr,
                    folder="civic-ai-annotated",
                    resource_type="image"
                )
                annotated_url = upload_result.get("secure_url")

            for box in result.boxes:
                class_id = int(box.cls[0].item())
                class_name = model.names[class_id].lower()
                detected_classes.append(class_name)
                
                coords = box.xyxy[0].tolist()
                w = coords[2] - coords[0]
                h = coords[3] - coords[1]
                total_bbox_area += (w * h)
                
        return {
            "tags": list(set(detected_classes)),
            "total_area_ratio": total_bbox_area / (img_dims[0] * img_dims[1]) if (img_dims[0] * img_dims[1]) > 0 else 0,
            "img_dims": (img_dims[1], img_dims[0]),
            "annotatedImageUrl": annotated_url
        }
    except Exception as e:
        print(f"Vision Engine Prediction Error: {str(e)}")
        return {"tags": [], "total_area_ratio": 0, "img_dims": (0, 0), "annotatedImageUrl": None}
