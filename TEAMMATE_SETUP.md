# Teammate Setup - Get Running in 10 Minutes


## Step 2: Get Secrets (from Tom or 1Password)

You need TWO secret files. Ask Tom to share via 1Password/secure method:

1. **`backend/serviceAccountKey.json`** - Firebase credentials
2. **`backend/.env`** - API keys

Place these files in the `backend/` directory.



## Step 3: Backend Setup

```bash
cd backend

# Create Python virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # Mac/Linux
# OR
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

## Step 4: Frontend Setup

```bash
cd frontend

# Install dependencies (choose one)
npm install
# OR
pnpm install
```

## Step 5: Login to Firebase

```bash
# Login with Google (one-time)
firebase login

# Select the shared project
firebase use jant-vid-pipe-fire
```

## Step 6: Run Everything

### Terminal 1: Backend

```bash
cd backend
source venv/bin/activate  # if not already activated
uvicorn app.main:app --reload
```

**Should see:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Firestore initialized successfully
```

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

**Should see:**
```
Ready on http://localhost:3000
```

### Terminal 3: Firebase Emulators (Optional - for local testing)

```bash
# From project root
firebase emulators:start --only firestore,functions
```

## Step 7: Verify It Works

1. Open http://localhost:3000
2. Sign in with Clerk
3. Try creating a storyboard
4. Check backend logs for any errors

## Troubleshooting

### Backend won't start?
- **Error: "No module named 'firebase_admin'"**
  - Did you activate the venv? (`source venv/bin/activate`)
  - Did you run `pip install -r requirements.txt`?

- **Error: "Could not find serviceAccountKey.json"**
  - Ask Tom for the file
  - Place in `backend/serviceAccountKey.json`

- **Error: "REPLICATE_API_TOKEN not found"**
  - Ask Tom for `backend/.env` file
  - Check it's in the right location: `backend/.env` (not root)

### Frontend won't start?
- **Error: "Module not found"**
  - Run `npm install` or `pnpm install`

### Firestore connection issues?
- Run `firebase use jant-vid-pipe-fire` to select the project
- Check you're logged in: `firebase login`

## What You Don't Need to Set Up

- ❌ Firebase project (already exists, you just connect to it)
- ❌ Clerk account (already configured)
- ❌ Database schema (Firestore auto-creates collections)
- ❌ Storage buckets (Firebase Storage auto-creates)

## Questions?

Ask Tom or check:
- `DEPLOYMENT_PLAN.md` - Overall architecture
- `QUICK_START.md` - Deployment instructions
- `functions/README.md` - Cloud Functions details

## File You Should NEVER Commit

If you see these in `git status`, DO NOT commit them:
- `backend/serviceAccountKey.json`
- `backend/.env`
- `frontend/.env.local`

They're already in `.gitignore`, but just in case.

## Daily Workflow

```bash
# Pull latest changes
git pull

# Start backend (Terminal 1)
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Start frontend (Terminal 2)
cd frontend && npm run dev

# Code away! 🚀
```

