# Backend Startup Fix

## Issue Found
The backend was failing to start with:
```
ModuleNotFoundError: No module named 'app.models.storyboard_models'
```

## Root Cause
The storyboard system was removed in Phase 3, but `backend/app/database.py` was still importing the deleted `storyboard_models`.

## Fix Applied
1. Commented out the import in `database.py`
2. Changed all type hints from `Storyboard` and `StoryboardScene` to `Any`
3. Updated all methods to handle both object and dict formats
4. Marked all methods as legacy since they're only used as a fallback

## Files Modified
- `backend/app/database.py` - Removed storyboard model imports, updated to use Any types

## Next Steps
1. Start the backend server again
2. Check for any other import errors
3. Continue with testing the full flow
