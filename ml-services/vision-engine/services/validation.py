import torch
import torch.nn.functional as F
from transformers import CLIPProcessor, CLIPModel
import requests
from PIL import Image, ImageOps
from io import BytesIO
import os
import numpy as np

# ---------------------------------------------------------
# Feature 4: Officer Work Validation (CLIP + Strict Pixel Audit)
# ---------------------------------------------------------

print("🔍 Initializing CLIP Vision Validation Engine (Zero-Touch)...")

# Use the same CLIP model as intelligence.py for consistency
device = "cuda" if torch.cuda.is_available() else "cpu"

try:
    print(f"🔍 Loading CLIP Vision Engine on {device}...", flush=True)
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    print(f"✅ Loaded CLIP Vision Transformer (Transformers) on {device}!", flush=True)
except Exception as e:
    print(f"❌ Failed to load CLIP Network: {e}", flush=True)
    model = None

def calculate_pixel_duplicity(img1: Image, img2: Image) -> bool:
    """
    Catch literal file duplicates by comparing normalized grayscale grids.
    Extremely robust against compression and metadata changes.
    """
    try:
        # Resize to tiny 32x32 grayscale grids
        size = (32, 32)
        grid1 = np.array(img1.convert("L").resize(size))
        grid2 = np.array(img2.convert("L").resize(size))
        
        # Calculate Mean Squared Error
        mse = np.mean((grid1 - grid2) ** 2)
        print(f"🏁 [PIXEL AUDIT] Identity Drift (MSE): {mse:.2f}", flush=True)
        
        # Threshold: MSE < 30.0 is unmistakably a duplicate/screenshot attempt
        is_dub = bool(mse < 30.0)
        return is_dub
    except Exception as e:
        print(f"Pixel Audit Warn: {e}")
        return False

def get_image_embedding(image_url: str):
    """
    Downloads image and extracts a semantic CLIP fingerprint.
    Returns both the embedding and the raw PIL image for pixel audit.
    """
    response = requests.get(image_url, timeout=5)
    response.raise_for_status()
    
    img = Image.open(BytesIO(response.content))
    img = ImageOps.exif_transpose(img).convert("RGB")
    
    # Process and MOVE TO DEVICE
    inputs = processor(images=img, return_tensors="pt").to(device)
    
    with torch.no_grad():
        # Extract features
        outputs = model.get_image_features(**inputs)
        
        # FIX: Unwrap the tensor
        image_features = outputs.pooler_output if hasattr(outputs, "pooler_output") else outputs
        
        # Normalize the embedding
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        
    return image_features, img

def validate_work_resolution(before_url: str, after_url: str) -> dict:
    """
    Compares the 'Before' and 'After' photos via CLIP + Strict Pixel Audit.
    """
    if model is None:
        return {"officerValidationPass": False, "similarityScore": 0.0, "status": "AI Offline - Manual Review Required"}
        
    try:
        # Get embeddings and raw images
        vec1, img1 = get_image_embedding(before_url)
        vec2, img2 = get_image_embedding(after_url)
        
        # 1. Strict Pixel Duplicity Check (Fraud Gate)
        is_strict_duplicate = calculate_pixel_duplicity(img1, img2)
        
        # 2. CLIP Semantic Similarity
        similarity = F.cosine_similarity(vec1, vec2).item()
        print(f"📊 [CLIP AUDIT] Raw Scene Similarity: {similarity:.4f}", flush=True)
        
        # THRESHOLD CALIBRATION:
        passed = similarity >= 0.55
        
        return {
            "officerValidationPass": passed,
            "similarityScore": round(similarity, 3),
            "isStrictDuplicate": is_strict_duplicate,
            "status": "Verified Location" if passed else "Low Location Similarity"
        }
        
    except Exception as e:
        print(f"❌ CLIP Validation Error: {str(e)}", flush=True)
        return {"officerValidationPass": False, "similarityScore": 0.0, "status": f"AI Fail: {str(e)}"}
