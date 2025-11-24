# 🔥 Firebase Configuration Recovery Guide

This guide shows you how to recover your Firebase configuration from the Firebase Console. These are the values you need for deployment.

---

## 📱 Frontend Firebase Config (Public - Safe to Expose)

### Where to Find These Values:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `jant-vid-pipe-fire`
3. Click the gear icon ⚙️ → **Project settings**
4. Scroll down to **Your apps** section
5. Select your web app (or create one if it doesn't exist)
6. You'll see the Firebase SDK configuration

### What You Need:

```javascript
// Firebase SDK Configuration
const firebaseConfig = {
  apiKey: "AIza***",                    // → NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain: "jant-vid-pipe-fire.firebaseapp.com",  // → NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId: "jant-vid-pipe-fire",      // → NEXT_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket: "jant-vid-pipe-fire.firebasestorage.app",  // → NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "***",             // → NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:***:web:***"                // → NEXT_PUBLIC_FIREBASE_APP_ID
};
```

### Export for Frontend Deployment:

```bash
export NEXT_PUBLIC_FIREBASE_API_KEY="AIza***"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="jant-vid-pipe-fire.firebaseapp.com"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="jant-vid-pipe-fire"
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="jant-vid-pipe-fire.firebasestorage.app"
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="***"
export NEXT_PUBLIC_FIREBASE_APP_ID="1:***:web:***"
```

---

## 🔐 Service Account Key (Private - NEVER Expose!)

### Where to Download:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `jant-vid-pipe-fire`
3. Click the gear icon ⚙️ → **Project settings**
4. Click **Service accounts** tab
5. Click **Generate new private key**
6. Save as `serviceAccountKey.json` in the `backend/` directory

⚠️ **CRITICAL:**
- This file contains private keys - NEVER commit to Git!
- NEVER share this file publicly
- Keep it secure on your local machine
- This file MUST exist in `backend/` before building the Docker image

---

## 🛡️ Recovering Firestore & Storage Rules

### Option 1: From Firebase Console (Manual)

#### Firestore Rules:
1. Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore/rules
2. Click **Rules** tab
3. Copy the currently deployed rules
4. Paste into `firestore.rules` in project root

#### Firestore Indexes:
1. Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore/indexes
2. Click the three dots menu (⋮) next to any index
3. Click **Export indexes**
4. Save as `firestore.indexes.json` in project root

#### Storage Rules:
1. Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/storage/rules
2. Copy the currently deployed rules
3. Paste into `storage.rules` in project root

### Option 2: Use Firebase CLI (Automatic)

```bash
# Login to Firebase
firebase login

# Pull current rules from Firebase
firebase firestore:rules get > firestore.rules
firebase firestore:indexes get > firestore.indexes.json

# Note: Storage rules must be copied manually from console
```

---

## 🔍 Verifying Your Firebase Config

### Check if Firebase is Set Up Correctly:

#### 1. Authentication Enabled:
Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/authentication/providers

Should see:
- ✅ Email/Password - **Enabled**
- (Optional) Google, GitHub, etc.

#### 2. Firestore Database Created:
Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/firestore

Should see:
- ✅ Firestore Database in **Native mode**
- ✅ Rules tab shows deployed rules
- ✅ Indexes tab shows composite indexes (with green checkmarks when built)

#### 3. Firebase Storage Enabled:
Go to: https://console.firebase.google.com/project/jant-vid-pipe-fire/storage

Should see:
- ✅ Default storage bucket: `jant-vid-pipe-fire.firebasestorage.app`
- ✅ Rules tab shows deployed rules

---

## 🎯 Quick Recovery Checklist

If you lost your Firebase config files, recover them in this order:

1. **Service Account Key (CRITICAL):**
   - [ ] Download from Firebase Console → Project settings → Service accounts
   - [ ] Save as `backend/serviceAccountKey.json`
   - [ ] Verify file exists: `ls -la backend/serviceAccountKey.json`

2. **Frontend Config (Public values):**
   - [ ] Get from Firebase Console → Project settings → Your apps
   - [ ] Export as environment variables (see above)

3. **Firestore Rules:**
   - [ ] Copy from Firebase Console → Firestore → Rules
   - [ ] Save as `firestore.rules` in project root
   - [ ] OR use the auto-generated rules we created ✅

4. **Firestore Indexes:**
   - [ ] Export from Firebase Console → Firestore → Indexes
   - [ ] Save as `firestore.indexes.json` in project root
   - [ ] OR use the auto-generated indexes we created ✅

5. **Storage Rules:**
   - [ ] Copy from Firebase Console → Storage → Rules
   - [ ] Save as `storage.rules` in project root
   - [ ] OR use the auto-generated rules we created ✅

---

## ✅ Already Done For You!

**Good news:** We've already created proper Firebase config files for you:

- ✅ **`firestore.rules`** - Secure, user-scoped access control
- ✅ **`firestore.indexes.json`** - Optimized composite indexes
- ✅ **`storage.rules`** - Secure, user-scoped file access
- ✅ **`.firebaserc`** - Project configuration
- ✅ **`firebase.json`** - Deployment configuration

These files are ready to deploy! You only need to:
1. Download the service account key
2. Get your frontend config values
3. Deploy!

---

## 🚀 Deploy Firebase Config

Once you have all config files, deploy them:

```bash
# Deploy everything
firebase deploy --only firestore,storage

# Or deploy individually
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

Wait for indexes to build (check console for green checkmarks) ✅

---

## 📚 Documentation Links

- [Firebase Console](https://console.firebase.google.com/project/jant-vid-pipe-fire)
- [Firestore Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Storage Rules](https://firebase.google.com/docs/storage/security)
- [Firebase Auth](https://firebase.google.com/docs/auth)
- [Service Accounts](https://firebase.google.com/docs/admin/setup#initialize-sdk)

---

**Need the full deployment guide? See `DEPLOYMENT_GUIDE.md`**

