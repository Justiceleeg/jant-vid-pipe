# Project State Management Architecture

## Overview

This document explains how project state is managed in the application to ensure proper isolation between projects and persistence of user work.

## Core Principles

1. **Single Source of Truth**: `projectStore` is the only store with localStorage persistence
2. **Ephemeral Working State**: `appStore` and `storyboardStore` are in-memory only
3. **Project Isolation**: Each project's state is completely isolated from others
4. **Backend-Driven Storyboards**: Storyboards are stored in the database and loaded via API

## Store Hierarchy

```
projectStore (PERSISTED to localStorage)
├── projects[] (array of all projects)
│   ├── id (unique project ID)
│   ├── name (project name)
│   ├── storyboardId (reference to backend storyboard)
│   └── appState (snapshot of appStore state)
│       ├── creativeBrief
│       ├── moods[]
│       ├── selectedMoodId
│       ├── currentStep
│       └── ... (all app state)
└── currentProjectId (active project)

appStore (EPHEMERAL - in memory only)
├── creativeBrief
├── moods[]
├── selectedMoodId
├── currentStep
└── ... (working state for current project)

storyboardStore (EPHEMERAL - in memory only)
├── storyboard (loaded from API via storyboardId)
├── scenes[]
└── sseConnection (real-time updates)
```

## State Flow

### Creating a New Project

```
1. User clicks "Create Project"
2. projectStore.createProject()
   - Generates new project ID
   - Takes snapshot of current appStore state
   - Saves to projects array
   - Sets as currentProjectId
   - Resets appStore and storyboardStore
3. Routes to /project/{newId}/chat
4. User starts fresh with empty state
```

### Working on a Project

```
1. User makes changes (chat, mood selection, etc.)
2. Changes update appStore (in memory)
3. appStore triggers auto-save (1.5s debounce)
4. projectStore.saveCurrentProject()
   - Takes snapshot of current appStore state
   - Updates project in projects array
   - Persists to localStorage
5. User's work is saved!
```

### Switching Projects

```
1. User clicks different project
2. projectStore.loadProject(projectId)
   - Finds project in projects array
   - Resets storyboardStore (clears old storyboard)
   - Restores project's appState to appStore
   - If storyboardId exists, loads from API
3. Routes to /project/{projectId}/chat
4. User sees their previous work restored
```

### Storyboard Lifecycle

```
1. User creates storyboard on scenes page
2. storyboardStore.initializeStoryboard()
   - Calls API to create storyboard in database
   - Receives storyboardId back
   - Stores in storyboardStore (ephemeral)
3. Auto-save triggers
4. projectStore.saveCurrentProject()
   - Saves storyboardId reference in project
5. When project is reloaded:
   - storyboardStore.loadStoryboard(storyboardId)
   - Fetches fresh data from database
   - Establishes SSE connection for real-time updates
```

## Key Functions

### `projectStore.loadProject(id)`

Loads a project and restores its state:

1. Finds project by ID
2. **Resets storyboardStore first** (critical for isolation)
3. Restores appState to appStore
4. Loads storyboard from API if storyboardId exists

### `projectStore.saveCurrentProject()`

Saves current working state to project:

1. Takes snapshot of appStore
2. Gets storyboardId from storyboardStore
3. Updates project in projects array
4. Persists to localStorage automatically

### `createAppStateSnapshot()`

Captures serializable state from appStore:

- creativeBrief
- moods, selectedMoodId
- uploadedProduct
- scenePlan
- videoJobId, generatedClips
- audioUrl
- compositionJobId, finalVideo
- currentStep

**Note**: File objects (productImages) are NOT persisted

### `restoreAppState(snapshot)`

Restores project state to appStore:

- Calls all appStore setters with snapshot data
- Preserves null/undefined values correctly

## Auto-Save

Auto-save is triggered by any change to appStore:

```javascript
useAppStore.subscribe(() => {
  useProjectStore.getState().scheduleAutoSave();
});
```

Debounce: 1.5 seconds (configured via `AUTO_SAVE_DEBOUNCE_MS`)

## Page Load Behavior

On initial page load:

1. Clean up old localStorage keys (migration)
2. projectStore hydrates from localStorage
3. If currentProjectId exists:
   - Restore its appState to appStore
   - Load its storyboard from API
4. User continues where they left off

## Debugging

All state changes are logged to console:

- `[ProjectStore]` - project operations
- `[StoryboardStore]` - storyboard operations
- `[SSE]` - real-time update events

Check console logs to trace:
- Which project is being loaded
- What state is being restored
- Which storyboard is being fetched
- When auto-save occurs

## Common Issues & Solutions

### Issue: Seeing data from wrong project

**Cause**: Old global persistence from appStore or storyboardStore

**Solution**: 
- Removed persist() middleware from both stores
- Added cleanup of old localStorage keys
- Added storyboard reset before loading project

### Issue: Changes not saving

**Cause**: Auto-save not triggering or currentProjectId not set

**Solution**:
- Check console for auto-save logs
- Verify subscription to appStore changes
- Ensure project is loaded before making changes

### Issue: Storyboard not loading

**Cause**: Invalid storyboardId or API error

**Solution**:
- Check console for API errors
- Verify storyboardId exists in project
- Check backend database for storyboard

## Testing Checklist

- [ ] Create new project → routes with fresh state
- [ ] Make changes → auto-save logs appear
- [ ] Switch projects → see different state
- [ ] Return to first project → previous work restored
- [ ] Refresh page → current project restored
- [ ] Create storyboard → storyboardId saved
- [ ] Switch away and back → storyboard reloads
- [ ] Console shows correct project/storyboard names

