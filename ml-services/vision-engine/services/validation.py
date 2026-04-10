import torch
import torchvision.transforms as transforms
from torchvision.models import resnet18, ResNet18_Weights
import requests
from PIL import Image
from io import BytesIO
import torch.nn.functional as F

# ---------------------------------------------------------
# Feature 4: Officer Work Validation (Siamese Similarity)
# ---------------------------------------------------------

print("🔍 Initializing Siamese Validation Engine...")

try:
    # A true Siamese network consists of twin networks sharing weights.
    # Here we use ResNet-18 as the twin backbone to extract feature vectors (embeddings).
    weights = ResNet18_Weights.DEFAULT
    backbone = resnet18(weights=weights)
    
    # Remove the final classification layer to get the raw 512-dimension embedding vector
    modules = list(backbone.children())[:-1]
    siamese_twin = torch.nn.Sequential(*modules)
    siamese_twin.eval() # Turn off learning mode
    
    preprocess = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    print("✅ Loaded Siamese comparison twin network!")
except Exception as e:
    print(f"❌ Failed to load Siamese Network: {e}")
    siamese_twin = None

def get_image_embedding(image_url: str):
    response = requests.get(image_url, timeout=5)
    response.raise_for_status()
    img = Image.open(BytesIO(response.content)).convert("RGB")
    tensor = preprocess(img).unsqueeze(0)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    siamese_twin.to(device)
    tensor = tensor.to(device)
    
    with torch.no_grad():
        embedding = siamese_twin(tensor)
    return embedding.view(-1) # Flatten to 1D array

def validate_work_resolution(before_url: str, after_url: str) -> dict:
    """
    Compares the 'Before' and 'After' photos submitted by an officer.
    Calculates Cosine Similarity between their structural architectural embeddings.
    """
    if siamese_twin is None:
        # If model is offline, we must flag it for manual review (False)
        return {"officerValidationPass": False, "similarityScore": 0.0, "status": "AI Offline - Manual Review Required"}
        
    try:
        vec1 = get_image_embedding(before_url)
        vec2 = get_image_embedding(after_url)
        
        # Calculate Cosine Similarity (1 means identical image, 0 means unrelated)
        similarity = F.cosine_similarity(vec1.unsqueeze(0), vec2.unsqueeze(0)).item()
        print(f"🧠 [SIAMESE ENGINE] Raw Cosine Similarity Score: {similarity:.3f}")
        
        # In a Civic context, "Before" and "After" photos shouldn't be EXACTLY identical 
        # (because the pothole was filled!). But they should share environmental structure.
        # Threshold 0.50 ensures they are in the same physical location while providing more leeway for visual differences post-fixing.
        passed = similarity >= 0.67
        
        return {
            "officerValidationPass": passed,
            "similarityScore": round(similarity, 3),
            "status": "Verified Location" if passed else "Location Mismatch Detected"
        }
        
    except Exception as e:
        print(f"Siamese Validation Error: {str(e)}")
        # SECURITY FIX: Default to False (Mismatch) if we can't verify the location.
        return {"officerValidationPass": False, "similarityScore": 0.0, "status": f"AI Verification Fail: {str(e)}"}
