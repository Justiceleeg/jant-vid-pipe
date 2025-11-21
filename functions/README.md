# Cloud Functions - Deployment Guide

This directory contains Firebase Cloud Functions (Python 2nd Gen) for handling async tasks in the Jant Video Pipeline.

## Overview

Cloud Functions automatically process jobs when they're created in Firestore:

1. **Image Generation** (`image_generation_jobs` collection)
2. **Video Generation** (`video_generation_jobs` collection)
3. **Multi-Video Generation** (`multi_video_jobs` collection)
4. **Video Composition** (`composition_jobs` collection)

## Architecture

```
Backend API (FastAPI)
    ↓ Creates job document
Firestore Collection
    ↓ Triggers Cloud Function
Cloud Function
    ↓ Calls Replicate/OpenAI
    ↓ Updates Firestore
Frontend (Firestore Listener)
    ↓ Shows real-time updates
```

## Prerequisites

1. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Python 3.11+**
   ```bash
   python --version  # Should be 3.11 or higher
   ```

3. **Environment Variables**
   - Copy `.env.example` to `.env`
   - Fill in your API keys (Replicate, OpenAI)

## Local Testing

### 1. Install Dependencies

```bash
cd functions/
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Start Firebase Emulators

```bash
# From project root
firebase emulators:start --only functions,firestore
```

### 3. Test Functions Locally

The emulators will start on:
- **Functions:** http://localhost:5001
- **Firestore:** http://localhost:8080
- **Firestore UI:** http://localhost:4000

Create test job documents in the Firestore UI to trigger functions locally.

## Deployment

### 1. Set Environment Variables

```bash
# Set Replicate API key
firebase functions:config:set replicate.api_token="YOUR_REPLICATE_TOKEN"

# Set OpenAI API key
firebase functions:config:set openai.api_key="YOUR_OPENAI_KEY"

# Optional: Feature flags
firebase functions:config:set features.use_kontext_composite="false"
firebase functions:config:set features.composite_method="pil"
```

### 2. Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:handle_image_generation
```

### 3. Verify Deployment

```bash
# View function logs
firebase functions:log

# Or in Firebase Console
# https://console.firebase.google.com/project/YOUR_PROJECT/functions
```

## Function Descriptions

### handle_image_generation

**Trigger:** Firestore document created in `image_generation_jobs/{job_id}`

**What it does:**
1. Reads scene data from job document
2. Calls Replicate Flux model for image generation
3. Updates scene document with generated image URL
4. Marks job as complete or error

**Job Document Schema:**
```json
{
  "job_id": "uuid",
  "scene_id": "scene_id",
  "storyboard_id": "storyboard_id",
  "user_id": "clerk_user_id",
  "text": "Scene description",
  "style_prompt": "Visual style keywords",
  "use_product_composite": false,
  "product_id": null,
  "status": "pending",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### handle_video_generation

**Trigger:** Firestore document created in `video_generation_jobs/{job_id}`

**What it does:**
1. Reads scene and image data from job
2. Calls Replicate SeeDance model for video generation
3. Updates scene document with generated video URL
4. Marks job as complete or error

**Job Document Schema:**
```json
{
  "job_id": "uuid",
  "scene_id": "scene_id",
  "storyboard_id": "storyboard_id",
  "user_id": "clerk_user_id",
  "image_url": "https://...",
  "text": "Scene description",
  "duration": 5.0,
  "status": "pending"
}
```

### handle_multi_video_generation

**Trigger:** Firestore document created in `multi_video_jobs/{job_id}`

**What it does:**
1. Processes multiple scenes in sequence
2. Generates video for each scene
3. Updates progress percentage
4. Returns array of generated clips

**Job Document Schema:**
```json
{
  "job_id": "uuid",
  "user_id": "clerk_user_id",
  "scenes": [
    {
      "scene_number": 1,
      "seed_image_url": "https://...",
      "duration": 5.0,
      "description": "Scene text"
    }
  ],
  "audio_url": null,
  "status": "pending",
  "progress_percent": 0,
  "clips": []
}
```

### handle_composition

**Trigger:** Firestore document created in `composition_jobs/{job_id}`

**What it does:**
1. Downloads all video clips
2. Stitches them together with ffmpeg
3. Adds audio track if provided
4. Uploads final video to Firebase Storage
5. Returns final video URL

**Job Document Schema:**
```json
{
  "job_id": "uuid",
  "user_id": "clerk_user_id",
  "clips": [
    {
      "scene_number": 1,
      "video_url": "https://...",
      "duration": 5.0
    }
  ],
  "audio_url": null,
  "include_crossfade": true,
  "optimize_size": false,
  "status": "pending",
  "video_url": null
}
```

## Monitoring

### View Logs

```bash
# Real-time logs
firebase functions:log --only handle_image_generation

# Or in Firebase Console
# https://console.firebase.google.com/project/YOUR_PROJECT/logs
```

### Common Log Patterns

```bash
# Function started
[Image Generation] Function triggered for job abc123

# Success
[Image Generation] Successfully generated image for scene xyz789

# Error
[Image Generation] Error: No image URL returned from Replicate
```

### Metrics

Monitor in Firebase Console:
- **Invocations**: How many times functions ran
- **Execution time**: Average duration
- **Memory usage**: Peak memory per invocation
- **Error rate**: Percentage of failed executions

## Error Handling

Functions automatically retry on failure (up to 3 attempts).

**Common Errors:**

1. **Replicate API Error**
   - Check API token is set correctly
   - Verify Replicate account has credits
   - Check model names are correct

2. **Firestore Permission Error**
   - Ensure service account has Firestore permissions
   - Check security rules allow Cloud Functions access

3. **Timeout Error**
   - Functions have 9-minute timeout
   - Long-running jobs (> 9 min) need alternative approach

## Cost Optimization

1. **Memory Allocation**: Functions use 1GB by default
   - Reduce to 512MB if possible
   - Monitor memory usage in logs

2. **Timeout**: Functions have 540s (9 min) timeout
   - Reduce if jobs finish faster
   - Saves costs for idle time

3. **Max Instances**: Set to 10 by default
   - Adjust based on traffic
   - Prevents runaway costs

## Rollback

If a deployment fails:

```bash
# View deployment history
firebase functions:list

# Rollback to previous version
# (Not directly supported - need to redeploy previous code)
```

## Troubleshooting

### Functions Not Triggering

1. Check Firestore collection names match exactly
2. Verify document is being created (not updated)
3. Check Firebase Console logs for errors

### Functions Timing Out

1. Increase timeout in `main.py`:
   ```python
   opts = options.Options(timeout_sec=540)
   ```
2. Consider breaking into smaller jobs

### API Errors

1. Verify API keys are set:
   ```bash
   firebase functions:config:get
   ```
2. Test APIs directly with curl
3. Check API rate limits

## Development Workflow

1. **Make Changes**: Edit functions in `functions/main.py`
2. **Test Locally**: Run emulators
3. **Deploy to Dev**: `firebase use dev && firebase deploy --only functions`
4. **Test in Dev**: Create test jobs
5. **Deploy to Prod**: `firebase use prod && firebase deploy --only functions`

## Security Notes

- Functions run with Firebase Admin privileges
- No authentication needed (Firestore triggers are internal)
- User ID stored in job documents for audit trail
- Secrets managed via Firebase Functions Config

## Next Steps

- [ ] Add Firebase Storage integration for composition
- [ ] Implement product compositing in Cloud Functions
- [ ] Add video composition logic (ffmpeg)
- [ ] Set up monitoring alerts
- [ ] Configure staging environment

## Support

- Firebase Docs: https://firebase.google.com/docs/functions
- Replicate Docs: https://replicate.com/docs
- OpenAI Docs: https://platform.openai.com/docs

