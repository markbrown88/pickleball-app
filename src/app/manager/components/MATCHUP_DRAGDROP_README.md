# MatchupDragDrop Component

A separated drag-and-drop component for managing team matchups in the pickleball tournament manager.

## Overview

This component was extracted from the large EventManagerTab.tsx file (2,584 lines) to isolate and fix a critical bug in the drag-and-drop functionality.

## The Bug

### Problem Description

When dragging Team A over Team B within the same matchup, both positions would become Team B, losing Team A entirely.

**Example:**
- Initial state: Team A vs Team B
- Drag Team A over Team B
- Result (BUG): Team B vs Team B ❌
- Expected: Team B vs Team A ✓

However, dragging teams between different matchups worked correctly:
- Initial: (Match 1: Team A vs Team B) and (Match 2: Team C vs Team D)
- Drag Team B over Team C
- Result: (Match 1: Team A vs Team C) and (Match 2: Team B vs Team D) ✓

### Root Cause

In the original EventManagerTab.tsx implementation (lines 1797-1815), the bug occurred because:

1. When finding the source and target matches, the code created references:
   ```typescript
   const sourceMatch = { ...currentMatches[sourceGlobalIndex] };
   const targetMatch = { ...currentMatches[targetGlobalIndex] };
   ```

2. When dragging within the same match, `sourceGlobalIndex === targetGlobalIndex`, so both `sourceMatch` and `targetMatch` referenced the same object in memory.

3. The swap logic then overwrote both positions:
   ```typescript
   if (sourceTeamPosition === 'A' && targetTeamPosition === 'B') {
     sourceMatch.teamA = targetTeam;  // Sets to Team B
     targetMatch.teamB = sourceTeam;  // Also sets to Team B (same object!)
   }
   ```

4. Since both variables pointed to the same object, the second assignment overwrote the first, resulting in both positions having Team B.

### The Fix

In [MatchupDragDrop.tsx](./MatchupDragDrop.tsx) (lines 214-226), we added a check for same-match swaps:

```typescript
// Check if we're swapping within the same match
if (sourceLocalMatchIndex === targetLocalMatchIndex) {
  // BUG FIX: When dragging within the same match (e.g., Team A over Team B),
  // we need to swap the teams properly without overwriting both positions
  const match = newMatches[sourceLocalMatchIndex];
  const tempTeamA = match.teamA;
  const tempTeamB = match.teamB;

  // Swap the teams
  match.teamA = tempTeamB;
  match.teamB = tempTeamA;
} else {
  // Original logic for swapping between different matches
  // ...
}
```

This ensures that when swapping within the same match, we properly exchange the teams using temporary variables instead of trying to assign to what would be the same object reference.

## Component API

### Props

```typescript
interface MatchupDragDropProps {
  roundId: string;           // ID of the round
  bracketName: string;        // Name of the bracket (e.g., "A", "B")
  matches: Match[];           // Array of matches to display
  onMatchesUpdate: (matches: Match[]) => void;  // Callback when matches change
  onSave?: () => Promise<void>;  // Optional auto-save callback
}
```

### Match Type

```typescript
type Match = {
  id: string;
  teamA?: Team | null;
  teamB?: Team | null;
  [key: string]: any;
};

type Team = {
  id: string;
  name: string;
  bracketName?: string | null;
  [key: string]: any;
};
```

## Usage

See [MatchupDragDrop.example.tsx](./MatchupDragDrop.example.tsx) for a complete integration example.

### Basic Integration

```typescript
import { MatchupDragDrop } from './components/MatchupDragDrop';

function MyComponent() {
  const [matches, setMatches] = useState([/* your matches */]);

  const handleMatchesUpdate = (updatedMatches) => {
    setMatches(updatedMatches);
  };

  const handleSave = async () => {
    await fetch('/api/save-matches', {
      method: 'POST',
      body: JSON.stringify({ matches })
    });
  };

  return (
    <MatchupDragDrop
      roundId="round-1"
      bracketName="A"
      matches={matches}
      onMatchesUpdate={handleMatchesUpdate}
      onSave={handleSave}
    />
  );
}
```

## Features

- **Drag and drop teams** between any positions
- **Visual feedback** during drag operations
- **Same-match swapping** now works correctly (bug fixed!)
- **Cross-match swapping** between different matchups
- **Bracket isolation** - only swap within the same bracket
- **Auto-save support** - optional callback for persistence
- **Performance optimized** - memoized components to reduce re-renders

## Integration with EventManagerTab

To integrate this component into the existing EventManagerTab:

1. Import the component:
   ```typescript
   import { MatchupDragDrop } from './MatchupDragDrop';
   ```

2. Replace the existing drag-and-drop section (around lines 2156-2260) with:
   ```typescript
   <MatchupDragDrop
     roundId={round.id}
     bracketName={bracketName}
     matches={bracketMatches}
     onMatchesUpdate={(updatedMatches) => {
       const newMatches = [...(roundMatchups[round.id] || [])];
       updatedMatches.forEach((updated) => {
         const idx = newMatches.findIndex(m => m.id === updated.id);
         if (idx !== -1) newMatches[idx] = updated;
       });
       setRoundMatchups(prev => ({ ...prev, [round.id]: newMatches }));
     }}
     onSave={() => autoSaveRoundMatchups(round.id)}
   />
   ```

3. Remove the old drag handlers (handleDragStart, handleDragOver, handleDragEnd) and related state (activeId, isDragging, dragPreview) from EventManagerTab.

## Testing

To test the fix:

1. **Same-match swap:**
   - Create a matchup: Team A vs Team B
   - Drag Team A over Team B
   - ✓ Expected: Team B vs Team A (both teams swap positions)

2. **Cross-match swap:**
   - Create matchups: (Team A vs Team B) and (Team C vs Team D)
   - Drag Team B over Team C
   - ✓ Expected: (Team A vs Team C) and (Team B vs Team D)

3. **Cross-position swap:**
   - Create matchups: (Team A vs Team B) and (Team C vs Team D)
   - Drag Team A (position A) over Team D (position B)
   - ✓ Expected: (Team D vs Team B) and (Team C vs Team A)

## Benefits of Separation

1. **Easier debugging** - isolated functionality
2. **Better testing** - can test drag-and-drop in isolation
3. **Reusability** - can be used in other parts of the app
4. **Reduced complexity** - EventManagerTab is now simpler
5. **Performance** - can be lazy-loaded if needed
6. **Maintainability** - changes to drag-and-drop don't affect other features

## Files

- [MatchupDragDrop.tsx](./MatchupDragDrop.tsx) - Main component with bug fix
- [MatchupDragDrop.example.tsx](./MatchupDragDrop.example.tsx) - Usage examples
- [MATCHUP_DRAGDROP_README.md](./MATCHUP_DRAGDROP_README.md) - This file

## Dependencies

- `@dnd-kit/core` - Core drag-and-drop functionality
- `@dnd-kit/sortable` - Sortable items support
- `@dnd-kit/utilities` - Utility functions for transforms

These are already installed in the project as they were used in EventManagerTab.
