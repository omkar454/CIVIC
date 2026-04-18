import os
import re
from embedding import generate_embedding
from db import get_pinecone_index

faq_path = os.path.join(os.path.dirname(__file__), "CITIZEN_FAQ_GUIDE.md")

if not os.path.exists(faq_path):
    print(f"❌ Could not find FAQ artifact at {faq_path}")
    print("Please ensure CITIZEN_FAQ_GUIDE.md is present in the same directory.")
    exit(1)

with open(faq_path, "r", encoding="utf-8") as f:
    text = f.read()

# Chunking strategy: split by '### ', '## ', or '**Q:'
chunks = re.split(r'\n(### |## |\*\*Q:)', text)

parsed_chunks = []
current_chunk = ""

for part in chunks:
    if part in ['### ', '## ', '**Q:']:
        if current_chunk.strip():
            parsed_chunks.append(current_chunk.strip())
        current_chunk = part
    else:
        current_chunk += part

if current_chunk.strip():
    parsed_chunks.append(current_chunk.strip())

# Filter out very small chunks
valid_chunks = [c for c in parsed_chunks if len(c) > 30]

print(f"📦 Extracted {len(valid_chunks)} chunks from FAQ.")

index = get_pinecone_index()
vectors_to_upsert = []

for i, chunk in enumerate(valid_chunks):
    chunk_text = chunk[:2000] # Avoid Pinecone metadata limits if it's too big
    emb = generate_embedding(chunk_text)
    
    doc_id = f"faq_chunk_{i}"
    metadata = {
        "title": "Citizen FAQ Guide",
        "description": chunk_text,
        "category": "faq"
    }
    vectors_to_upsert.append((doc_id, emb, metadata))

# Upsert to 'faq' namespace
batch_size = 100
for i in range(0, len(vectors_to_upsert), batch_size):
    batch = vectors_to_upsert[i:i+batch_size]
    index.upsert(vectors=batch, namespace="faq")

print(f"✅ Successfully upserted {len(vectors_to_upsert)} chunks to the 'faq' namespace.")
