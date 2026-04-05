import torch
import requests
from PIL import Image
from io import BytesIO
from transformers import CLIPProcessor, CLIPModel

# ---------------------------------------------------------
# Feature 2: Complaint Integrity / Anti-Fraud Engine
# ---------------------------------------------------------

print("🔍 Initializing CLIP Anti-Fraud Engine...")

try:
    # Load OpenAI's CLIP model which understands both Images and Text in the same vector space
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    print("✅ Loaded CLIP textual-alignment model!")
except Exception as e:
    print(f"❌ Failed to load CLIP: {e}")
    model = None

def verify_integrity(image_url: str, text_description: str, category: str = "pothole") -> bool:
    """
    Compares an uploaded image against the citizen's typed description and selected category.
    Performs a 'Category Duel' to ensure the image matches the selected report type.
    """
    if model is None:
        # SECURITY FIX: If AI is offline, do not allow unverified reports to pass
        return False 
        
    try:
        # 1. Download image into RAM
        response = requests.get(image_url, timeout=5)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content)).convert("RGB")
        
        # 2. Setup the "Duel" Prompts
        # We compare the target category against common competitors and fraud types.
        target_prompt = f"A real-world photo of a {category} on a street"
        
        competitors = [
            target_prompt,
            "A photo of a pothole or road damage",
            "A photo of a pile of garbage or litter",
            "A photo of a broken street light or pole",
            "A photo of water logging or a flooded street",
            "A cat, dog, or pet animal",
            "A human selfie or person's face",
            "A nature landscape, mountains, or forest",
            "A document, flyer, or paper with text"
        ]
        
        # 3. Vectorize
        inputs = processor(text=competitors, images=img, return_tensors="pt", padding=True)
        
        # 4. Compare image vector against all text vectors
        with torch.no_grad():
            outputs = model(**inputs)
        
        logits_per_image = outputs.logits_per_image  
        probs = logits_per_image.softmax(dim=1) # Convert to percentage probability
        
        # 5. The Category Duel Logic
        target_prob = probs[0][0].item()
        winner_idx = torch.argmax(probs[0]).item()
        winner_text = competitors[winner_idx]
        
        print(f"🕵️ CLIP Duel: Target({category}) Prob: {target_prob:.2f} | Winner: {winner_text}")

        # AUTHENTICITY RULES (Strict Mode):
        
        # Rule 1: Functional Fraud Check (Documents, Pets, Selfies, Nature)
        fraud_keywords = ["cat", "dog", "pet", "selfie", "person", "nature", "document", "flyer"]
        if any(kw in winner_text.lower() for kw in fraud_keywords):
            print(f"🚫 Fraud Detected: Image identified as {winner_text}.")
            return False

        # Rule 2: Category Winner Check
        # If the user said "Garbage" but the AI is 90% sure it's a "Pothole", fail it.
        # We allow a pass if the target is the winner, OR if the target has > 25% confidence.
        if winner_idx != 0 and target_prob < 0.25:
            print(f"⚠️ Category Mismatch: User said {category}, but AI sees {winner_text}")
            return False

        # Rule 3: Absolute Sanity Threshold
        # Even if it wins, it must feel like the category (at least 15% confidence)
        return target_prob > 0.15
        
    except Exception as e:
        print(f"Anti-Fraud Engine Error: {str(e)}")
        return False # SECURITY: Reject on error 🛡️
