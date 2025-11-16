"""Integration test for video generation with mocked Replicate service."""
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_video_generation_flow_with_mock():
    """Test complete video generation flow with mocked Replicate service."""

    # Sample request data with seed images
    request_data = {
        "scenes": [
            {
                "scene_number": 1,
                "duration": 4.0,
                "description": "Opening scene with product showcase",
                "style_prompt": "cinematic, professional",
                "seed_image_url": "https://example.com/seed1.jpg"
            },
            {
                "scene_number": 2,
                "duration": 5.0,
                "description": "Close-up of product features",
                "style_prompt": "detailed, bright",
                "seed_image_url": "https://example.com/seed2.jpg"
            },
            {
                "scene_number": 3,
                "duration": 4.0,
                "description": "Final brand reveal",
                "style_prompt": "elegant, minimal",
                "seed_image_url": "https://example.com/seed3.jpg"
            }
        ],
        "mood_style_keywords": ["modern", "sleek"],
        "mood_aesthetic_direction": "minimalist luxury"
    }

    # Mock the ReplicateVideoService to avoid actual API calls
    with patch('app.routers.video.get_video_service') as mock_get_service:
        # Create mock video service
        mock_service = MagicMock()

        # Mock the generate_videos_parallel method
        async def mock_generate_videos(scenes, progress_callback=None):
            """Mock parallel video generation."""
            results = []

            for scene in scenes:
                scene_num = scene["scene_number"]

                # Simulate progress callback
                if progress_callback:
                    await progress_callback(scene_num, "processing", None, None)

                # Simulate successful video generation
                video_url = f"https://replicate.delivery/mock-video-{scene_num}.mp4"

                if progress_callback:
                    await progress_callback(scene_num, "completed", video_url, None)

                results.append({
                    "success": True,
                    "scene_number": scene_num,
                    "video_url": video_url,
                    "duration": scene["duration"],
                    "error": None
                })

            return results

        mock_service.generate_videos_parallel = mock_generate_videos
        mock_get_service.return_value = mock_service

        # Step 1: Initiate video generation
        print("Step 1: Initiating video generation...")
        response = client.post("/api/video/generate", json=request_data)

        print(f"Status Code: {response.status_code}")
        assert response.status_code == 200

        data = response.json()
        print(f"Response: {data}")

        assert data["success"] is True
        assert "job_id" in data
        assert data["total_scenes"] == 3

        job_id = data["job_id"]
        print(f"✓ Job created with ID: {job_id}")

        # Step 2: Wait a moment for background task (in real scenario, would poll)
        import time
        print("\nStep 2: Waiting for background processing...")
        time.sleep(0.5)  # Give background task time to start

        # Step 3: Check job status
        print("\nStep 3: Checking job status...")
        status_response = client.get(f"/api/video/status/{job_id}")

        print(f"Status Code: {status_response.status_code}")
        assert status_response.status_code == 200

        status_data = status_response.json()
        print(f"Job Status: {status_data['job_status']['status']}")
        print(f"Progress: {status_data['job_status']['progress_percent']}%")
        print(f"Completed: {status_data['job_status']['completed_scenes']}/{status_data['job_status']['total_scenes']}")

        # Check clips
        for clip in status_data['job_status']['clips']:
            print(f"  Clip {clip['scene_number']}: {clip['status']} - {clip.get('video_url', 'N/A')}")

        print("\n✓ Video generation flow completed successfully!")

        return job_id


def test_video_generation_error_handling():
    """Test video generation with error scenarios."""

    # Test with missing seed image
    request_data = {
        "scenes": [
            {
                "scene_number": 1,
                "duration": 4.0,
                "description": "Scene without seed image",
                "style_prompt": "cinematic",
                "seed_image_url": ""  # Missing!
            }
        ]
    }

    print("\nTesting error handling for missing seed image...")
    response = client.post("/api/video/generate", json=request_data)

    print(f"Status Code: {response.status_code}")
    assert response.status_code == 400

    data = response.json()
    print(f"Error: {data['detail']}")
    assert "missing seed images" in data["detail"].lower()

    print("✓ Error handling works correctly!")


def test_video_status_polling():
    """Test the polling mechanism."""

    # Create a job first
    request_data = {
        "scenes": [
            {
                "scene_number": 1,
                "duration": 4.0,
                "description": "Test scene",
                "style_prompt": "test",
                "seed_image_url": "https://example.com/test.jpg"
            }
        ]
    }

    with patch('app.routers.video.get_video_service') as mock_get_service:
        mock_service = MagicMock()
        mock_service.generate_videos_parallel = AsyncMock(return_value=[])
        mock_get_service.return_value = mock_service

        print("\nTesting polling mechanism...")

        # Create job
        response = client.post("/api/video/generate", json=request_data)
        job_id = response.json()["job_id"]

        # Poll multiple times (simulate real client behavior)
        for i in range(3):
            status_response = client.get(f"/api/video/status/{job_id}")
            assert status_response.status_code == 200
            print(f"  Poll {i+1}: Status = {status_response.json()['job_status']['status']}")

        print("✓ Polling works correctly!")


if __name__ == "__main__":
    print("Testing Video Generation System")
    print("=" * 60)

    # Test 1: Complete flow with mock
    print("\n" + "=" * 60)
    print("TEST 1: Complete Video Generation Flow")
    print("=" * 60)
    test_video_generation_flow_with_mock()

    # Test 2: Error handling
    print("\n" + "=" * 60)
    print("TEST 2: Error Handling")
    print("=" * 60)
    test_video_generation_error_handling()

    # Test 3: Polling
    print("\n" + "=" * 60)
    print("TEST 3: Status Polling")
    print("=" * 60)
    test_video_status_polling()

    print("\n" + "=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)
