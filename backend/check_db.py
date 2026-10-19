from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance


# -------------------------
# 1. Connect to local DB
# -------------------------

client = QdrantClient(path="./qdrant_data")


# -------------------------
# 2. Create collection
# -------------------------

collection_name = "documents"

client.create_collection(
    collection_name=collection_name,
    vectors_config=VectorParams(
        size=3,
        distance=Distance.COSINE
    )
)


# -------------------------
# 3. Insert vectors
# -------------------------

client.upsert(
    collection_name=collection_name,
    points=[
        PointStruct(
            id=1,
            vector=[0.9, 0.1, 0.0],
            payload={
                "text": "Python is a programming language",
                "page": 1
            }
        ),
        PointStruct(
            id=2,
            vector=[0.8, 0.2, 0.1],
            payload={
                "text": "Python is used for machine learning",
                "page": 2
            }
        ),
        PointStruct(
            id=3,
            vector=[0.0, 0.1, 0.9],
            payload={
                "text": "Delhi is the capital of India",
                "page": 5
            }
        )
    ]
)


# -------------------------
# 4. Similarity search
# -------------------------

query_vector = [0.85, 0.15, 0.05]

results = client.query_points(
    collection_name=collection_name,
    query=query_vector,
    limit=2
)


# -------------------------
# 5. Print results
# -------------------------

for result in results.points:
    print("ID:", result.id)
    print("Score:", result.score)
    print("Payload:", result.payload)
    print("----------------")
