"""Test for video composition endpoints."""
from fastapi.testclient import TestClient
from app.main import app
import time

client = TestClient(app)


def test_composition_endpoint():
    """Test POST /api/composition/compose endpoint with real video URLs."""

    # Sample request data with test video clips
    # Using placeholder URLs - in real test, these would be actual video URLs from previous steps
    request_data = {
        "clips": [
            {
                "scene_number": 1,
                "video_url": "https://replicate.delivery/pbxt/example1.mp4",  # Replace with real URL
                "duration": 5.0
            },
            {
                "scene_number": 2,
                "video_url": "https://replicate.delivery/pbxt/example2.mp4",  # Replace with real URL
                "duration": 5.0
            }
        ],
        "audio_url": "https://replicate.delivery/yhqm/example_audio.mp3",  # Replace with real URL
        "include_crossfade": True,
        "optimize_size": True,
        "target_size_mb": 50.0
    }

    # Test endpoint
    print("Testing video composition endpoint...")
    response = client.post("/api/composition/compose", json=request_data)

    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "job_id" in data
    assert data["total_clips"] == 2

    print(f"\n✓ Composition job created!")
    print(f"  Job ID: {data['job_id']}")

    return data["job_id"]


def test_composition_status(job_id: str):
    """Test GET /api/composition/status/{job_id} endpoint."""

    print(f"\nPolling composition status for job: {job_id}")

    max_polls = 60  # Poll for up to 60 seconds
    poll_interval = 2  # Poll every 2 seconds

    for i in range(max_polls):
        response = client.get(f"/api/composition/status/{job_id}")

        assert response.status_code == 200
        data = response.json()

        job_status = data["job_status"]
        status = job_status["status"]
        progress = job_status["progress_percent"]
        current_step = job_status.get("current_step", "")

        print(f"  [{i+1:2d}] Status: {status:12s} | Progress: {progress:3d}% | Step: {current_step}")

        if status == "completed":
            print(f"\n✅ Composition completed successfully!")
            print(f"  Video URL: {job_status.get('video_url')}")
            print(f"  File Size: {job_status.get('file_size_mb'):.2f} MB")
            print(f"  Duration: {job_status.get('duration_seconds'):.1f}s")
            return job_status

        elif status == "failed":
            print(f"\n✗ Composition failed!")
            print(f"  Error: {job_status.get('error')}")
            assert False, f"Composition failed: {job_status.get('error')}"

        # Wait before next poll
        time.sleep(poll_interval)

    # Timeout
    assert False, f"Composition timed out after {max_polls * poll_interval} seconds"


def test_simple_composition_without_audio():
    """Test composition without audio and without crossfade."""

    request_data = {
        "clips": [
            {
                "scene_number": 1,
                "video_url": "https://replicate.delivery/pbxt/example1.mp4",
                "duration": 3.0
            }
        ],
        "audio_url": None,
        "include_crossfade": False,
        "optimize_size": False,
        "target_size_mb": 50.0
    }

    print("\n" + "="*60)
    print("Testing simple composition (1 clip, no audio, no crossfade)...")
    print("="*60)

    response = client.post("/api/composition/compose", json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    print(f"✓ Simple composition job created: {data['job_id']}")


def test_list_jobs():
    """Test GET /api/composition/jobs endpoint."""

    response = client.get("/api/composition/jobs")

    assert response.status_code == 200
    data = response.json()

    print(f"\n📋 Total composition jobs: {data['total_jobs']}")
    for job in data["jobs"]:
        print(f"  - Job {job['job_id'][:8]}: {job['status']} ({job['progress']}%)")


if __name__ == "__main__":
    print("="*60)
    print("VIDEO COMPOSITION ENDPOINT TESTS")
    print("="*60)
    print("\n⚠️  NOTE: This test requires real video and audio URLs")
    print("    Update the test_composition_endpoint() function with")
    print("    actual URLs from previous pipeline steps.\n")

    try:
        # Test 1: Basic composition
        # job_id = test_composition_endpoint()

        # Test 2: Poll status
        # test_composition_status(job_id)

        # Test 3: Simple composition
        # test_simple_composition_without_audio()

        # Test 4: List all jobs
        test_list_jobs()

        print("\n" + "="*60)
        print("TESTS COMPLETED!")
        print("="*60)
        print("\nNote: Main composition tests are commented out")
        print("      Uncomment and add real URLs to run full tests")

    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
