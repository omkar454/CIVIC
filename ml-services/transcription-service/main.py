import os
import tempfile
import whisper
import warnings
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Suppress FP16 warnings on CPU
warnings.filterwarnings("ignore", message="FP16 is not supported on CPU; using FP32 instead")

app = FastAPI(title="CIVIC Transcription Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading Whisper small model... (Better for Indian Scripts)")
try:
    model = whisper.load_model("small")
    print("Whisper model loaded successfully.")
except Exception as e:
    print(f"Error loading Whisper model: {e}")
    model = None

@app.get("/")
def health_check():
    return {"status": "Transcription Service is running", "module": "Voice-to-Text"}

@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=500, detail="Transcription model is not initialized.")

    if not audio.filename:
        raise HTTPException(status_code=400, detail="No selected file.")

    try:
        # Save the blob to a temporary file
        fd, tmp_path = tempfile.mkstemp(suffix=".wav")
        with os.fdopen(fd, 'wb') as tmp:
            tmp.write(await audio.read())

        # Custom Language Detection (Restricted to 4 Languages)
        audio_data = whisper.load_audio(tmp_path)
        audio_data = whisper.pad_or_trim(audio_data)
        mel = whisper.log_mel_spectrogram(audio_data).to(model.device)
        
        # Detect all language probabilities
        _, probs = model.detect_language(mel)
        
        # Restrict AI to only consider these specific language codes
        allowed_langs = ["en", "hi", "mr", "gu"]
        filtered_probs = {lang: prob for lang, prob in probs.items() if lang in allowed_langs}
        
        # Pick the most likely language from our allowed list
        best_language = max(filtered_probs, key=filtered_probs.get)

        # Dynamic GPU / CPU checking for optimal math precision
        import torch
        # If they have a dedicated GPU, use fp16=True for blindingly fast speeds. On CPU, False to prevent hallucination.
        use_fp16 = torch.cuda.is_available()

        # Transcribe using Whisper (forcing the chosen language)
        result = model.transcribe(tmp_path, task="transcribe", language=best_language, fp16=use_fp16)
        
        detected_language = best_language
        transcribed_text = result.get("text", "").strip()

        os.remove(tmp_path)

        return {
            "text": transcribed_text,
            "language": detected_language,
            "success": True
        }

    except Exception as e:
        print(f"Transcription error: {e}")
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8005))
    uvicorn.run(app, host="0.0.0.0", port=port)
