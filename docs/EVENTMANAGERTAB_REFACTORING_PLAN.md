# EventManagerTab Refactoring Plan

**Date:** October 12, 2025
**Current File Size:** 2,584 lines
**Objective:** Split into smaller, maintainable components with better performance

## Current File Structure Analysis

### Components (Already Memoized)
1. **DraggableTeam** (lines 52-138) - 87 lines ✅ Already extracted and memoized
2. **GameScoreBox** (lines 139-435) - 297 lines ✅ Already memoized
3. **InlineLineupEditor** (lines 438-835) - 398 lines

### Main Component
- **EventManagerTab** (lines 837-2584) - 1,748 lines
  - 15+ state variables
  - Multiple useEffect hooks
  - Complex nested rendering logic
  - Drag-and-drop management
  - API calls mixed with UI logic

## Refactoring Strategy

### Phase 1: Extract Existing Memoized Components ✅ Low Risk
These components are already self-contained and memoized, making them easy to extract:

#### 1.1 GameScoreBox Component
**New File:** `src/app/manager/components/EventManagerTab/GameScoreBox.tsx`
- **Lines:** 139-435 (297 lines)
- **Dependencies:**
  - None (fully self-contained)
- **Props:**
  ```typescript
  {
    game: any;
    match: any;
    lineups: Record<string, Record<string, any[]>>;
    startGame: (gameId: string) => Promise<void>;
    endGame: (gameId: string) => Promise<void>;
    updateGameScore: (gameId: string, teamAScore: number | null, teamBScore: number | null) => Promise<void>;
    updateGameCourtNumber: (gameId: string, courtNumber: string) => Promise<void>;
  }
  ```
- **Internal Functions:**
  - `getGameStatus`
  - `getGameTitle`
  - `getTeamALineup`
  - `getTeamBLineup`

#### 1.2 DraggableTeam Component
**New File:** `src/app/manager/components/EventManagerTab/DraggableTeam.tsx`
- **Lines:** 52-138 (87 lines)
- **Dependencies:**
  - `@dnd-kit/core`
  - `@dnd-kit/sortable`
  - `@dnd-kit/utilities`
- **Props:**
  ```typescript
  {
    team: any;
    teamPosition: 'A' | 'B';
    roundId: string;
    matchIndex: number;
    bracketName: string;
    isDragging?: boolean;
    dragPreview?: any;
  }
  ```

#### 1.3 InlineLineupEditor Component
**New File:** `src/app/manager/components/EventManagerTab/InlineLineupEditor.tsx`
- **Lines:** 438-835 (398 lines)
- **Dependencies:**
  - `@dnd-kit/core` (for drag and drop)
  - `expectedGenderForIndex` from `@/lib/lineupSlots`
- **Props:**
  ```typescript
  {
    matchId: string;
    teamAId: string;
    teamBId: string;
    teamARoster: PlayerLite[];
    teamBRoster: PlayerLite[];
    currentLineup: Record<string, PlayerLite[]>;
    onSaveLineups: (matchId: string, teamALineup: PlayerLite[], teamBLineup: PlayerLite[]) => Promise<void>;
    onCancelEdit: () => void;
  }
  ```

---

### Phase 2: Extract Utility Functions ⚠️ Medium Risk
Create shared utility modules for helper functions:

#### 2.1 Game Status Utilities
**New File:** `src/app/manager/components/EventManagerTab/utils/gameStatus.ts`
- **Functions:**
  ```typescript
  export function getGameStatus(game: any): 'not_started' | 'in_progress' | 'completed'
  export function getGameTitle(slot: string): string
  export function deriveMatchStatus(match: any): MatchStatus
  export function isMatchComplete(match: any, games: Record<string, any[]>): boolean
  ```

#### 2.2 Tiebreaker Utilities
**New File:** `src/app/manager/components/EventManagerTab/utils/tiebreaker.ts`
- **Functions:**
  ```typescript
  export function normalizeTiebreakerStatus(status?: string | null): MatchStatus | null
  export function getTiebreakerBanner(status: MatchStatus, matchLabel: string, winnerName?: string | null, totals?: { teamA: number | null; teamB: number | null })
  export function gatherRoundTiebreakerAlerts(roundMatches: any[], statusResolver: (match: any) => MatchStatus)
  ```

#### 2.3 Lineup Utilities
**New File:** `src/app/manager/components/EventManagerTab/utils/lineup.ts`
- **Functions:**
  ```typescript
  export function getTeamLineup(game: any, match: any, lineups: Record<string, Record<string, any[]>>, teamPosition: 'A' | 'B'): string
  export function validateLineup(lineup: PlayerLite[]): { valid: boolean; errors: string[] }
  ```

#### 2.4 Date Formatting Utilities
**New File:** `src/app/manager/components/EventManagerTab/utils/dateFormat.ts`
- **Functions:**
  ```typescript
  export function formatDate(dateStr: string | null): string
  export function formatDateRange(startAt: string | null, endAt: string | null): string
  ```

---

### Phase 3: Extract Custom Hooks 🔥 High Risk
Move state management and side effects into custom hooks:

#### 3.1 useSchedule Hook
**New File:** `src/app/manager/components/EventManagerTab/hooks/useSchedule.ts`
- **Purpose:** Manage schedule data loading and state
- **State:**
  - `scheduleData: Record<string, any[]>`
  - `loading: Record<string, boolean>`
- **Functions:**
  - `loadScheduleForStop(stopId: string): Promise<void>`
  - `refreshSchedule(stopId: string): Promise<void>`
- **Returns:**
  ```typescript
  {
    scheduleData: Record<string, any[]>;
    loading: Record<string, boolean>;
    loadScheduleForStop: (stopId: string) => Promise<void>;
    refreshSchedule: (stopId: string) => Promise<void>;
  }
  ```

#### 3.2 useLineups Hook
**New File:** `src/app/manager/components/EventManagerTab/hooks/useLineups.ts`
- **Purpose:** Manage lineup editing state and operations
- **State:**
  - `editingMatch: string | null`
  - `lineups: Record<string, Record<string, PlayerLite[]>>`
  - `teamRosters: Record<string, PlayerLite[]>`
- **Functions:**
  - `loadLineupsForStop(stopId: string): Promise<void>`
  - `saveLineups(matchId: string, teamALineup: PlayerLite[], teamBLineup: PlayerLite[]): Promise<void>`
  - `startEditingMatch(matchId: string): void`
  - `cancelEditingMatch(): void`
  - `swapTeamsInMatch(roundId: string, bracketName: string, matchIndex: number, sourceTeam: any, targetTeam: any): Promise<void>`
- **Returns:**
  ```typescript
  {
    editingMatch: string | null;
    lineups: Record<string, Record<string, PlayerLite[]>>;
    teamRosters: Record<string, PlayerLite[]>;
    loadLineupsForStop: (stopId: string) => Promise<void>;
    saveLineups: (matchId: string, teamALineup: PlayerLite[], teamBLineup: PlayerLite[]): Promise<void>;
    startEditingMatch: (matchId: string) => void;
    cancelEditingMatch: () => void;
    swapTeamsInMatch: (...) => Promise<void>;
  }
  ```

#### 3.3 useGames Hook
**New File:** `src/app/manager/components/EventManagerTab/hooks/useGames.ts`
- **Purpose:** Manage game state and scoring operations
- **State:**
  - `games: Record<string, any[]>`
  - `resolvingMatch: string | null`
- **Functions:**
  - `startGame(gameId: string): Promise<void>`
  - `endGame(gameId: string): Promise<void>`
  - `updateGameScore(gameId: string, teamAScore: number | null, teamBScore: number | null): Promise<void>`
  - `updateGameCourtNumber(gameId: string, courtNumber: string): Promise<void>`
  - `addTiebreakerGame(matchId: string): Promise<void>`
  - `decideTiebreakerByPoints(matchId: string): Promise<void>`
- **Returns:**
  ```typescript
  {
    games: Record<string, any[]>;
    resolvingMatch: string | null;
    startGame: (gameId: string) => Promise<void>;
    endGame: (gameId: string) => Promise<void>;
    updateGameScore: (gameId: string, teamAScore: number | null, teamBScore: number | null) => Promise<void>;
    updateGameCourtNumber: (gameId: string, courtNumber: string) => Promise<void>;
    addTiebreakerGame: (matchId: string) => Promise<void>;
    decideTiebreakerByPoints: (matchId: string) => Promise<void>;
  }
  ```

#### 3.4 useExpandedRounds Hook
**New File:** `src/app/manager/components/EventManagerTab/hooks/useExpandedRounds.ts`
- **Purpose:** Manage round expansion state with smart defaults
- **State:**
  - `expandedRounds: Set<string>`
- **Functions:**
  - `toggleRound(roundId: string): void`
  - `autoExpandIncompleteRound(rounds: any[]): void`
- **Returns:**
  ```typescript
  {
    expandedRounds: Set<string>;
    toggleRound: (roundId: string) => void;
    autoExpandIncompleteRound: (rounds: any[]) => void;
  }
  ```

---

### Phase 4: Extract View Components 🔥 High Risk
Break down the massive render function into smaller view components:

#### 4.1 TournamentStopTabs Component
**New File:** `src/app/manager/components/EventManagerTab/TournamentStopTabs.tsx`
- **Purpose:** Render stop tabs for navigation
- **Props:**
  ```typescript
  {
    stops: Array<{ stopId: string; stopName: string; locationName?: string | null; startAt?: string | null; endAt?: string | null }>;
    selectedStopId: string | null;
    onSelectStop: (stopId: string) => void;
  }
  ```

#### 4.2 RoundView Component
**New File:** `src/app/manager/components/EventManagerTab/RoundView.tsx`
- **Purpose:** Render a single round with its matches
- **Props:**
  ```typescript
  {
    round: any;
    games: Record<string, any[]>;
    lineups: Record<string, Record<string, PlayerLite[]>>;
    teamRosters: Record<string, PlayerLite[]>;
    editingMatch: string | null;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onStartGame: (gameId: string) => Promise<void>;
    onEndGame: (gameId: string) => Promise<void>;
    onUpdateGameScore: (gameId: string, teamAScore: number | null, teamBScore: number | null) => Promise<void>;
    onUpdateGameCourtNumber: (gameId: string, courtNumber: string) => Promise<void>;
    onStartEditingMatch: (matchId: string) => void;
    onCancelEditingMatch: () => void;
    onSaveLineups: (matchId: string, teamALineup: PlayerLite[], teamBLineup: PlayerLite[]) => Promise<void>;
  }
  ```

#### 4.3 MatchCard Component
**New File:** `src/app/manager/components/EventManagerTab/MatchCard.tsx`
- **Purpose:** Render a single match with its games
- **Props:**
  ```typescript
  {
    match: any;
    games: any[];
    lineups: Record<string, Record<string, PlayerLite[]>>;
    teamRosters: Record<string, PlayerLite[]>;
    isEditing: boolean;
    onStartGame: (gameId: string) => Promise<void>;
    onEndGame: (gameId: string) => Promise<void>;
    onUpdateGameScore: (gameId: string, teamAScore: number | null, teamBScore: number | null) => Promise<void>;
    onUpdateGameCourtNumber: (gameId: string, courtNumber: string) => Promise<void>;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onSaveLineups: (matchId: string, teamALineup: PlayerLite[], teamBLineup: PlayerLite[]) => Promise<void>;
  }
  ```

#### 4.4 TiebreakerBanner Component
**New File:** `src/app/manager/components/EventManagerTab/TiebreakerBanner.tsx`
- **Purpose:** Display tiebreaker status messages
- **Props:**
  ```typescript
  {
    status: MatchStatus;
    matchLabel: string;
    winnerName?: string | null;
    totals?: { teamA: number | null; teamB: number | null };
    onAddTiebreaker?: () => void;
    onDecideByPoints?: () => void;
  }
  ```

---

### Phase 5: Refactor Main Component 🔥 High Risk
Simplify the main EventManagerTab component to orchestrate the extracted pieces:

#### 5.1 New EventManagerTab Structure
**File:** `src/app/manager/components/EventManagerTab/index.tsx`
- **Lines:** ~150-250 lines (down from 2,584!)
- **Responsibilities:**
  - Accept props from parent
  - Initialize custom hooks
  - Manage selectedStopId state
  - Pass data and callbacks to child components
  - Handle drag-and-drop context (DndContext)

**Simplified Structure:**
```typescript
export function EventManagerTab({ tournaments, onError, onInfo }: Props) {
  // State
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [lineupDeadlines, setLineupDeadlines] = useState<Record<string, string>>({});

  // Custom Hooks
  const { scheduleData, loading, loadScheduleForStop, refreshSchedule } = useSchedule(onError);
  const {
    editingMatch,
    lineups,
    teamRosters,
    loadLineupsForStop,
    saveLineups,
    startEditingMatch,
    cancelEditingMatch,
    swapTeamsInMatch
  } = useLineups(onError, onInfo);
  const {
    games,
    resolvingMatch,
    startGame,
    endGame,
    updateGameScore,
    updateGameCourtNumber,
    addTiebreakerGame,
    decideTiebreakerByPoints
  } = useGames(onError, onInfo, refreshSchedule);
  const { expandedRounds, toggleRound, autoExpandIncompleteRound } = useExpandedRounds();

  // Effects
  useEffect(() => {
    // Auto-select first stop, load schedule and lineups
  }, [tournaments, selectedStopId]);

  // Drag handlers
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    // Call swapTeamsInMatch from useLineups hook
  }, [swapTeamsInMatch]);

  // Render
  const tournament = tournaments[0];
  if (!tournament) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <TournamentStopTabs
        stops={tournament.stops}
        selectedStopId={selectedStopId}
        onSelectStop={setSelectedStopId}
      />

      {selectedStopId && (
        <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
          {scheduleData[selectedStopId]?.map((round) => (
            <RoundView
              key={round.id}
              round={round}
              games={games}
              lineups={lineups}
              teamRosters={teamRosters}
              editingMatch={editingMatch}
              isExpanded={expandedRounds.has(round.id)}
              onToggleExpand={() => toggleRound(round.id)}
              onStartGame={startGame}
              onEndGame={endGame}
              onUpdateGameScore={updateGameScore}
              onUpdateGameCourtNumber={updateGameCourtNumber}
              onStartEditingMatch={startEditingMatch}
              onCancelEditingMatch={cancelEditingMatch}
              onSaveLineups={saveLineups}
            />
          ))}
        </DndContext>
      )}
    </div>
  );
}
```

---

## File Structure After Refactoring

```
src/app/manager/components/EventManagerTab/
├── index.tsx                    (~200 lines) - Main orchestrator
├── GameScoreBox.tsx             (297 lines) - Game display and scoring
├── DraggableTeam.tsx            (87 lines) - Draggable team component
├── InlineLineupEditor.tsx       (398 lines) - Lineup editing UI
├── TournamentStopTabs.tsx       (~100 lines) - Stop navigation tabs
├── RoundView.tsx                (~200 lines) - Round container
├── MatchCard.tsx                (~250 lines) - Match display
├── TiebreakerBanner.tsx         (~80 lines) - Tiebreaker messages
├── hooks/
│   ├── useSchedule.ts           (~150 lines) - Schedule management
│   ├── useLineups.ts            (~250 lines) - Lineup management
│   ├── useGames.ts              (~200 lines) - Game operations
│   └── useExpandedRounds.ts     (~50 lines) - Round expansion state
├── utils/
│   ├── gameStatus.ts            (~80 lines) - Game status functions
│   ├── tiebreaker.ts            (~120 lines) - Tiebreaker logic
│   ├── lineup.ts                (~100 lines) - Lineup utilities
│   └── dateFormat.ts            (~30 lines) - Date formatting
└── types.ts                     (~100 lines) - Shared types

Total: ~2,644 lines (similar total, but much more maintainable!)
Average per file: ~150 lines
```

---

## Benefits of This Refactoring

### Performance
- **Code Splitting:** Each component can be lazy-loaded
- **Better Memoization:** Smaller components are easier to optimize
- **Reduced Re-renders:** Custom hooks prevent unnecessary updates
- **Tree-shakeable:** Unused utilities won't be bundled

### Maintainability
- **Single Responsibility:** Each file has one clear purpose
- **Easier Testing:** Small, focused components are easier to test
- **Better Code Organization:** Clear file structure
- **Easier Debugging:** Smaller stack traces, clearer error locations

### Developer Experience
- **Faster IDE Performance:** Smaller files load faster
- **Better IntelliSense:** Type inference works better on smaller files
- **Easier Collaboration:** Multiple developers can work on different components
- **Clearer Git History:** Changes are localized to specific components

---

## Migration Strategy

### Step 1: Create Directory Structure ✅
```bash
mkdir -p src/app/manager/components/EventManagerTab/{hooks,utils}
```

### Step 2: Extract Low-Risk Components (Phase 1)
1. Extract GameScoreBox.tsx
2. Extract DraggableTeam.tsx
3. Extract InlineLineupEditor.tsx
4. Update imports in main file
5. **Test thoroughly**

### Step 3: Extract Utilities (Phase 2)
1. Create utils/gameStatus.ts
2. Create utils/tiebreaker.ts
3. Create utils/lineup.ts
4. Create utils/dateFormat.ts
5. Update imports in components
6. **Test thoroughly**

### Step 4: Extract Custom Hooks (Phase 3)
1. Create hooks/useSchedule.ts
2. Create hooks/useLineups.ts
3. Create hooks/useGames.ts
4. Create hooks/useExpandedRounds.ts
5. Update main component to use hooks
6. **Test thoroughly**

### Step 5: Extract View Components (Phase 4)
1. Create TournamentStopTabs.tsx
2. Create RoundView.tsx
3. Create MatchCard.tsx
4. Create TiebreakerBanner.tsx
5. Update main component to use view components
6. **Test thoroughly**

### Step 6: Finalize Main Component (Phase 5)
1. Simplify EventManagerTab/index.tsx
2. Move types to types.ts
3. Update exports
4. **Final integration testing**

---

## Testing Checklist

After each phase, verify:
- ✅ Page loads without errors
- ✅ Schedule displays correctly
- ✅ Round expansion/collapse works
- ✅ Lineup editing works
- ✅ Team swapping (drag-and-drop) works
- ✅ Game scoring works
- ✅ Game start/finish works
- ✅ Court number updates work
- ✅ Tiebreaker logic works
- ✅ No TypeScript errors
- ✅ No console errors

---

## Risk Assessment

### Low Risk ✅
- Extracting already-memoized components (GameScoreBox, DraggableTeam)
- Creating utility functions
- Adding types file

### Medium Risk ⚠️
- Extracting InlineLineupEditor (has internal state)
- Creating custom hooks (state management changes)
- Extracting view components (prop drilling complexity)

### High Risk 🔥
- Refactoring drag-and-drop logic
- Moving API calls to hooks
- Changing state management patterns

---

## Rollback Plan

If issues occur:
1. Keep original file as `EventManagerTab.tsx.backup`
2. Can quickly restore by renaming
3. Git history provides full rollback capability

---

## Next Steps

1. ✅ Review this plan with team
2. Start with Phase 1 (low-risk extractions)
3. Test thoroughly after each phase
4. Proceed incrementally through phases 2-5
5. Document any issues or deviations from plan

---

**Estimated Time:** 8-12 hours for full refactoring
**Recommended Approach:** Do over 2-3 days with testing between phases
**Priority:** High (impacts performance and maintainability)
