import torch
import torchvision.transforms as transforms
from torchvision.models import resnet50, ResNet50_Weights
from PIL import Image
import requests
from io import BytesIO
import math # <-- NEW: Added for the hybrid rounding logic

# ---------------------------------------------------------
# Feature 3: Dynamic Severity Engine (CPU Optimized)
# Supports: "pothole" and "garbage" with Hybrid Rounding
# ---------------------------------------------------------

print("🔍 Initializing ResNet50 Severity Engine (CPU Mode)...")

try:
    # 1. Load the base model ONCE globally
    weights = ResNet50_Weights.DEFAULT
    model = resnet50(weights=weights)
    model.eval() # Set to evaluation mode
    
    # 2. Standard ResNet image transformations
    preprocess = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    print("✅ Loaded ResNet50 Severity inference graph on CPU!")
except Exception as e:
    print(f"❌ Failed to load ResNet50: {e}")
    model = None

def estimate_severity(
    image_url: str, 
    area_ratio: float = 0.0,
    detected_class: str = "pothole" # <-- Tells the engine what it's looking at
) -> int: # <-- Now outputs a clean integer
    """
    Analyzes an image and returns a Risk-Weighted Geometric Severity score.
    Dynamically adjusts math based on the detected_class.
    Returns an integer from 1 (Low) to 5 (Critical) using Gatekeeper/Escalator logic.
    """
    if model is None:
        return 3 # Default mock score
        
    # Clean up the input string just in case
    detected_category = detected_class.lower().strip()
        
    try:
        # Fetch and load the image
        response = requests.get(image_url, timeout=5)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content)).convert("RGB")
        
        # Process the image into a Tensor
        input_tensor = preprocess(img)
        input_batch = input_tensor.unsqueeze(0)

        # Run the AI "Eyeball Test"
        with torch.no_grad():
            output = model(input_batch)
            
        variance = torch.var(output).item()
        
        # ---------------------------------------------------------
        # DYNAMIC PROFILING LOGIC
        # ---------------------------------------------------------
        
        if detected_category in ["garbage", "trash", "litter", "dumping"]:
            # GARBAGE PROFILE
            chaos_threshold = 2.8      # Needs massive visual chaos to max out
            size_threshold = 0.40      # Max risk requires 40% screen coverage
            weight_geometry = 0.60     # Size gets 60% of the voting power
            weight_chaos = 0.40        # Texture gets 40% of the voting power
            apply_synergy_bump = False # Garbage doesn't get emergency scaling
            
        else:
            # POTHOLE PROFILE (Default)
            chaos_threshold = 1.2      # Highly sensitive to dark shadows/edges
            size_threshold = 0.20      # Max risk requires only 20% screen coverage
            weight_geometry = 0.30     # Size gets 30% of the voting power
            weight_chaos = 0.70        # Texture gets 70% of the voting power
            apply_synergy_bump = True  # Give a 15% boost if size & texture are high

        # ---------------------------------------------------------
        # APPLY THE MATH BASED ON THE PROFILE
        # ---------------------------------------------------------
        
        # 1. Calculate Chaos Risk
        chaos_risk = min(variance / chaos_threshold, 1.0) 
        
        # 2. Calculate Geometric Risk
        # Now uses the pre-calculated multi-object area ratio!
        geometric_risk = min(area_ratio / size_threshold, 1.0) if area_ratio > 0 else 0.5

        # 3. Combine using the dynamic voting power
        matrix_score = (geometric_risk * weight_geometry) + (chaos_risk * weight_chaos)
        
        # 4. Apply emergency synergy bump (only for potholes)
        if apply_synergy_bump and geometric_risk > 0.4 and chaos_risk > 0.4:
             matrix_score = min(matrix_score * 1.15, 1.0)

        # 5. Scale to 1.0 - 5.0 range
        final_score = (matrix_score * 4.0) + 1.0
        
        # ---------------------------------------------------------
        # HYBRID ROUNDING LOGIC (Gatekeeper / Escalator)
        # ---------------------------------------------------------
        if final_score < 3.0:
            # Strict categorization: 2.9 becomes 2
            return math.floor(final_score)
        else:
            # Escalation rounding: 3.4 becomes 3, 3.5 becomes 4
            return math.floor(final_score + 0.5)
        
    except Exception as e:
        print(f"Severity Engine Error: {str(e)}")
        return 3 # Fallback