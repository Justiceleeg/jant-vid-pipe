"""Quick test for video generation endpoints."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_video_generation_endpoint():
    """Test POST /api/video/generate endpoint."""
    # Sample request data
    request_data = {
        "scenes": [
            {
                "scene_number": 1,
                "duration": 5.0,
                "description": "Opening scene with product showcase",
                "style_prompt": "cinematic, professional",
                "seed_image_url": "https://example.com/image1.jpg"
            },
            {
                "scene_number": 2,
                "duration": 5.0,
                "description": "Close-up of product features",
                "style_prompt": "detailed, bright",
                "seed_image_url": "https://example.com/image2.jpg"
            }
        ],
        "mood_style_keywords": ["modern", "sleek"],
        "mood_aesthetic_direction": "minimalist luxury"
    }

    # Test endpoint
    response = client.post("/api/video/generate", json=request_data)

    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "job_id" in data
    assert data["total_scenes"] == 2

    return data["job_id"]


def test_video_status_endpoint(job_id: str):
    """Test GET /api/video/status/{job_id} endpoint."""
    response = client.get(f"/api/video/status/{job_id}")

    print(f"\nStatus Check - Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["job_status"] is not None
    assert data["job_status"]["job_id"] == job_id
    assert data["job_status"]["total_scenes"] == 2


def test_video_status_not_found():
    """Test GET /api/video/status/{job_id} with invalid job ID."""
    response = client.get("/api/video/status/invalid-job-id")

    print(f"\nInvalid Job - Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

    assert response.status_code == 404


def test_jobs_list_endpoint():
    """Test GET /api/video/jobs endpoint."""
    response = client.get("/api/video/jobs")

    print(f"\nJobs List - Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

    assert response.status_code == 200
    data = response.json()
    assert "total_jobs" in data
    assert "jobs" in data


if __name__ == "__main__":
    print("Testing Video Generation Endpoints")
    print("=" * 50)

    # Test generate endpoint
    print("\n1. Testing POST /api/video/generate")
    job_id = test_video_generation_endpoint()
    print("✓ Generate endpoint works!")

    # Test status endpoint
    print("\n2. Testing GET /api/video/status/{job_id}")
    test_video_status_endpoint(job_id)
    print("✓ Status endpoint works!")

    # Test invalid job ID
    print("\n3. Testing GET /api/video/status/{job_id} with invalid ID")
    test_video_status_not_found()
    print("✓ Error handling works!")

    # Test jobs list
    print("\n4. Testing GET /api/video/jobs")
    test_jobs_list_endpoint()
    print("✓ Jobs list endpoint works!")

    print("\n" + "=" * 50)
    print("All tests passed! ✓")
