"""Quick test for audio generation endpoints."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_audio_generation_endpoint():
    """Test POST /api/audio/generate endpoint."""
    # Sample request data - energetic mood
    request_data = {
        "mood_name": "Energetic",
        "mood_description": "Vibrant and dynamic energy that captures attention. Bold movements and bright colors.",
        "emotional_tone": ["exciting", "upbeat", "dynamic"],
        "aesthetic_direction": "modern and bold",
        "style_keywords": ["energetic", "vibrant", "bold", "modern"],
        "duration": 30
    }

    # Test endpoint
    print("Testing audio generation with energetic mood...")
    response = client.post("/api/audio/generate", json=request_data)

    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["audio_url"] is not None
    assert data["duration"] == 30
    assert "prompt" in data

    print(f"\n✓ Audio generated successfully!")
    print(f"  Prompt: {data['prompt']}")
    print(f"  Audio URL: {data['audio_url']}")
    print(f"  Duration: {data['duration']}s")

    return data["audio_url"]


def test_audio_generation_calm_mood():
    """Test audio generation with calm mood."""
    # Sample request data - calm mood
    request_data = {
        "mood_name": "Calm",
        "mood_description": "Peaceful and serene atmosphere. Soft tones and gentle transitions.",
        "emotional_tone": ["peaceful", "relaxing", "soothing"],
        "aesthetic_direction": "minimalist and elegant",
        "style_keywords": ["calm", "minimalist", "elegant", "soft"],
        "duration": 30
    }

    # Test endpoint
    print("\nTesting audio generation with calm mood...")
    response = client.post("/api/audio/generate", json=request_data)

    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["audio_url"] is not None

    print(f"\n✓ Audio generated successfully!")
    print(f"  Prompt: {data['prompt']}")
    print(f"  Audio URL: {data['audio_url']}")

    return data["audio_url"]


def test_audio_generation_cinematic_mood():
    """Test audio generation with cinematic mood."""
    # Sample request data - cinematic mood
    request_data = {
        "mood_name": "Cinematic",
        "mood_description": "Epic and dramatic storytelling. Sweeping visuals and powerful emotions.",
        "emotional_tone": ["dramatic", "powerful", "epic"],
        "aesthetic_direction": "cinematic and bold",
        "style_keywords": ["cinematic", "epic", "dramatic", "orchestral"],
        "duration": 30
    }

    # Test endpoint
    print("\nTesting audio generation with cinematic mood...")
    response = client.post("/api/audio/generate", json=request_data)

    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["audio_url"] is not None

    print(f"\n✓ Audio generated successfully!")
    print(f"  Prompt: {data['prompt']}")
    print(f"  Audio URL: {data['audio_url']}")

    return data["audio_url"]


if __name__ == "__main__":
    print("="*60)
    print("AUDIO GENERATION ENDPOINT TESTS")
    print("="*60)

    try:
        # Test 1: Energetic mood
        audio_url_1 = test_audio_generation_endpoint()

        # Test 2: Calm mood
        audio_url_2 = test_audio_generation_calm_mood()

        # Test 3: Cinematic mood
        audio_url_3 = test_audio_generation_cinematic_mood()

        print("\n" + "="*60)
        print("ALL TESTS PASSED!")
        print("="*60)
        print(f"\nGenerated audio URLs:")
        print(f"1. Energetic: {audio_url_1}")
        print(f"2. Calm: {audio_url_2}")
        print(f"3. Cinematic: {audio_url_3}")

    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
