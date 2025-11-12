# Phase 2: Tournament Setup UI - Implementation Plan

**Duration**: 1.5 weeks
**Status**: Ready to Begin
**Dependencies**: Phase 1 Complete ✅

---

## Overview

Enhance the tournament admin UI to support the new flexible registration system with pricing models, game type configuration, and capacity management.

---

## Goals

1. **Pricing Configuration** - Allow admins to set tournament-wide, per-stop, or per-bracket pricing
2. **Game Type Management** - Enable/disable specific game types per bracket
3. **Capacity Configuration** - Set player limits at stop/bracket/club level
4. **Stop Settings** - Configure per-stop registration deadlines and settings

---

## Current State Analysis

### Existing File: `RegistrationSettingsTab.tsx`

**Current Features** (330 lines):
- ✅ Registration status (OPEN / INVITE_ONLY / CLOSED)
- ✅ Registration type (FREE / PAID)
- ✅ Single tournament-wide cost
- ✅ Tournament-level max players
- ✅ Waitlist toggle
- ✅ Restriction notes
- ✅ Summary section

**What's Missing**:
- ❌ Pricing model selection (4 options)
- ❌ Per-stop pricing configuration
- ❌ Per-bracket pricing configuration
- ❌ Game type enable/disable grid
- ❌ Capacity limits per stop/bracket/club
- ❌ Per-stop registration deadlines

---

## Implementation Strategy

### Approach: Incremental Enhancement

Rather than replacing the entire component, we'll:
1. Add new sections incrementally
2. Keep existing functionality working
3. Show/hide sections based on tournament type and pricing model
4. Use collapsible sections for complex config

### Component Architecture

```
RegistrationSettingsTab (main)
├── Registration Status (existing)
├── Registration Type (existing)
├── **NEW: Pricing Model Selection**
├── **NEW: Pricing Configuration**
│   ├── Tournament-Wide Pricing (existing, enhanced)
│   ├── Per-Stop Pricing (new)
│   ├── Per-Bracket Pricing (new)
│   └── Per-Stop-Per-Bracket Pricing (new)
├── **NEW: Game Type Configuration**
│   └── BracketGameTypeGrid component
├── **NEW: Capacity Management**
│   └── CapacityConfigTable component
├── Player Limit (existing, enhanced)
└── Restrictions (existing)
```

---

## Task Breakdown

### Task 1: Add Pricing Model Selection (Day 1 - 3 hours)

**File**: `RegistrationSettingsTab.tsx`

**Changes**:
1. Add `pricingModel` to `EditorRowWithRegistration` type
2. Add new section after "Registration Type"
3. Four radio buttons with descriptions
4. Show/hide pricing inputs based on selection

**UI Design**:
```tsx
<div className="border-t border-border-subtle pt-6">
  <h3 className="text-lg font-semibold text-primary mb-4">Pricing Model</h3>
  <p className="text-sm text-muted mb-4">
    Choose how players will be charged for this tournament
  </p>

  <div className="space-y-3">
    <label>
      <input type="radio" name="pricingModel" value="TOURNAMENT_WIDE" />
      <div>
        <div className="font-medium">Tournament-Wide Pricing</div>
        <p className="text-xs text-muted">
          One flat fee covers the entire tournament (all stops, all game types)
        </p>
      </div>
    </label>

    <label>
      <input type="radio" name="pricingModel" value="PER_STOP" />
      <div>
        <div className="font-medium">Per-Stop Pricing</div>
        <p className="text-xs text-muted">
          Players pay separately for each stop they register for
        </p>
      </div>
    </label>

    <label>
      <input type="radio" name="pricingModel" value="PER_BRACKET" />
      <div>
        <div className="font-medium">Per-Bracket Pricing</div>
        <p className="text-xs text-muted">
          Different price for each game type/bracket (individual tournaments)
        </p>
      </div>
    </label>

    <label>
      <input type="radio" name="pricingModel" value="PER_STOP_PER_BRACKET" />
      <div>
        <div className="font-medium">Per-Stop Per-Bracket Pricing</div>
        <p className="text-xs text-muted">
          Maximum flexibility - different price for each stop AND bracket combination
        </p>
      </div>
    </label>
  </div>
</div>
```

**Validation**:
- If `registrationType === 'FREE'`, pricing model is disabled
- Show warning if changing model with existing registrations

---

### Task 2: Create Per-Stop Pricing Component (Day 2 - 4 hours)

**New File**: `src/app/tournaments/components/tabs/PerStopPricingConfig.tsx`

**Purpose**: Configure pricing for each stop individually

**Props**:
```typescript
type PerStopPricingConfigProps = {
  stops: Array<{ id: string; name: string; startAt: Date }>;
  prices: Record<string, number>; // stopId → price in cents
  onPriceChange: (stopId: string, price: number) => void;
};
```

**UI Design**:
```
┌─────────────────────────────────────────────┐
│ Stop Pricing Configuration                  │
├─────────────────────────────────────────────┤
│ Stop 1 - Seattle (Nov 15)                   │
│ $ [   50.00    ]                            │
├─────────────────────────────────────────────┤
│ Stop 2 - Portland (Nov 22)                  │
│ $ [   60.00    ]                            │
├─────────────────────────────────────────────┤
│ Stop 3 - Vancouver (Nov 29)                 │
│ $ [   55.00    ]                            │
└─────────────────────────────────────────────┘
  [Set All to Same Price: $ 50.00 ] [Apply]
```

**Features**:
- Input for each stop
- "Set all to same price" helper
- Validation: must be positive number
- Save button updates database

---

### Task 3: Create Per-Bracket Pricing Component (Day 2-3 - 4 hours)

**New File**: `src/app/tournaments/components/tabs/PerBracketPricingConfig.tsx`

**Purpose**: Configure pricing for each bracket/game type

**Props**:
```typescript
type PerBracketPricingConfigProps = {
  brackets: Array<{ id: string; name: string; gameType: string }>;
  prices: Record<string, number>; // bracketId → price in cents
  onPriceChange: (bracketId: string, price: number) => void;
};
```

**UI Design**:
```
┌─────────────────────────────────────────────┐
│ Bracket Pricing Configuration               │
├─────────────────────────────────────────────┤
│ 3.0 Men's Doubles                           │
│ $ [   45.00    ]                            │
├─────────────────────────────────────────────┤
│ 3.0 Women's Doubles                         │
│ $ [   45.00    ]                            │
├─────────────────────────────────────────────┤
│ 3.0 Mixed Doubles                           │
│ $ [   50.00    ]                            │
├─────────────────────────────────────────────┤
│ 3.5 Men's Doubles                           │
│ $ [   55.00    ]                            │
└─────────────────────────────────────────────┘
  Game Type Pricing:
  Singles: $ [50.00] Doubles: $ [60.00] Mixed: $ [65.00]
  [Apply to All Brackets of Same Type]
```

---

### Task 4: Create Game Type Configuration Grid (Day 3-4 - 6 hours)

**New File**: `src/app/tournaments/components/tabs/GameTypeConfigGrid.tsx`

**Purpose**: Enable/disable game types per bracket

**Props**:
```typescript
type GameTypeConfigGridProps = {
  brackets: Array<{ id: string; name: string; skillLevel: string }>;
  gameTypes: GameType[];
  config: Record<string, Record<GameType, { enabled: boolean; maxPlayers?: number }>>;
  onConfigChange: (bracketId: string, gameType: GameType, config: any) => void;
};
```

**UI Design**:
```
┌────────────────────────────────────────────────────────────────────┐
│ Game Type Configuration                                            │
├────────────────────────────────────────────────────────────────────┤
│                   │ Men's    │ Women's  │ Mixed    │ Men's    │    │
│ Bracket           │ Doubles  │ Doubles  │ Doubles  │ Singles  │... │
├───────────────────┼──────────┼──────────┼──────────┼──────────┼────┤
│ 2.5               │ [✓] (12) │ [✓] (12) │ [✓] (16) │ [ ] --   │    │
│ 3.0               │ [✓] (16) │ [✓] (16) │ [✓] (20) │ [✓] (8)  │    │
│ 3.5               │ [✓] (16) │ [ ] --   │ [✓] (20) │ [✓] (8)  │    │
│ 4.0+              │ [✓] (12) │ [✓] (12) │ [✓] (16) │ [✓] (8)  │    │
└───────────────────┴──────────┴──────────┴──────────┴──────────┴────┘
  [✓] = Enabled     ( ) = Max players per game type (optional)

  Quick Actions:
  [Enable All] [Disable All] [Set Default Capacity: 12 players]
```

**Features**:
- Checkbox grid: brackets (rows) × game types (columns)
- Optional capacity input per cell
- Bulk actions: enable/disable all, set default capacity
- Team tournaments: auto-enable all 6 game types (MD, WD, Mix1, Mix2, MS, WS)
- Individual tournaments: show only relevant game types (MD, WD, Mix, MS, WS)

**Implementation**:
```tsx
{brackets.map((bracket) => (
  <tr key={bracket.id}>
    <td>{bracket.name}</td>
    {gameTypes.map((gameType) => (
      <td key={gameType}>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config[bracket.id]?.[gameType]?.enabled ?? false}
            onChange={(e) => onConfigChange(bracket.id, gameType, {
              enabled: e.target.checked
            })}
          />
          {config[bracket.id]?.[gameType]?.enabled && (
            <input
              type="number"
              className="w-16 text-sm"
              value={config[bracket.id]?.[gameType]?.maxPlayers ?? ''}
              onChange={(e) => onConfigChange(bracket.id, gameType, {
                enabled: true,
                maxPlayers: parseInt(e.target.value) || undefined
              })}
              placeholder="Max"
            />
          )}
        </label>
      </td>
    ))}
  </tr>
))}
```

---

### Task 5: Create Capacity Management Component (Day 4-5 - 6 hours)

**New File**: `src/app/tournaments/components/tabs/CapacityConfigTable.tsx`

**Purpose**: Set capacity limits per stop/bracket/club combination

**Props**:
```typescript
type CapacityConfigTableProps = {
  tournamentType: 'TEAM_FORMAT' | 'INDIVIDUAL';
  stops: Array<{ id: string; name: string }>;
  brackets: Array<{ id: string; name: string }>;
  clubs?: Array<{ id: string; name: string }>; // For team tournaments
  capacities: CapacityConfig[];
  onCapacityChange: (config: CapacityConfig) => void;
};

type CapacityConfig = {
  stopId: string;
  bracketId: string;
  clubId?: string;
  maxPlayers: number;
};
```

**UI Design (Team Tournament)**:
```
┌──────────────────────────────────────────────────────────────┐
│ Capacity Limits - Team Tournament                            │
├──────────────────────────────────────────────────────────────┤
│ Filter: Stop [All ▼] Bracket [All ▼] Club [All ▼]           │
├──────────────────────────────────────────────────────────────┤
│ Stop     │ Bracket  │ Club      │ Max Players │ Current │   │
├──────────┼──────────┼───────────┼─────────────┼─────────┼───┤
│ Stop 1   │ 3.0      │ Club A    │ [12]        │ 8/12    │ ✓ │
│ Stop 1   │ 3.0      │ Club B    │ [12]        │ 11/12   │ ⚠ │
│ Stop 1   │ 3.5      │ Club A    │ [16]        │ 4/16    │ ✓ │
│ Stop 2   │ 3.0      │ Club A    │ [12]        │ 0/12    │ ✓ │
└──────────┴──────────┴───────────┴─────────────┴─────────┴───┘
  ⚠ = Near capacity    🔴 = Full    ✓ = Available

  Quick Set:
  [ ] Use same capacity for all: [12] players [Apply to All]
  [ ] Copy Stop 1 capacities to all other stops [Apply]
```

**Features**:
- Filterable table
- Inline editing of capacity
- Visual indicators for capacity status
- Bulk actions: set all, copy from one stop
- Show current registration count vs capacity
- Validation: can't set capacity below current registration count

---

### Task 6: Update API Endpoints (Day 5-6 - 6 hours)

**Files to Update**:
1. `src/app/api/admin/tournaments/[id]/config/route.ts`

**New Endpoints**:

#### 1. Save Pricing Configuration
```typescript
// PUT /api/admin/tournaments/[id]/config/pricing
{
  pricingModel: 'PER_STOP' | 'PER_BRACKET' | etc,
  stopPricing?: [{ stopId, cost }],
  bracketPricing?: [{ bracketId, stopId?, cost }]
}
```

#### 2. Save Game Type Configuration
```typescript
// PUT /api/admin/tournaments/[id]/config/game-types
{
  configs: [
    { bracketId, gameType, isEnabled, maxPlayers? }
  ]
}
```

#### 3. Save Capacity Configuration
```typescript
// PUT /api/admin/tournaments/[id]/config/capacity
{
  capacities: [
    { stopId, bracketId, clubId?, maxPlayers }
  ]
}
```

#### 4. Get Full Configuration
```typescript
// GET /api/admin/tournaments/[id]/config/full
Response: {
  tournament: { ... },
  stopPricing: [...],
  bracketPricing: [...],
  gameTypeConfig: [...],
  capacities: [...]
}
```

**Implementation Notes**:
- Use database transactions for atomic updates
- Validate pricing: must be positive, not exceed reasonable limits
- Validate capacity: can't be less than current registrations
- Return validation errors with specific field references

---

### Task 7: Update Tournament Editor Integration (Day 6-7 - 4 hours)

**File**: `src/app/tournaments/components/TournamentEditor.tsx`

**Changes**:
1. Load additional config data (pricing, game types, capacities)
2. Pass props to `RegistrationSettingsTab`
3. Handle save for all new configuration sections
4. Show loading states during saves
5. Show success/error toasts

**New State**:
```typescript
const [registrationConfig, setRegistrationConfig] = useState({
  pricingModel: 'TOURNAMENT_WIDE',
  stopPricing: [],
  bracketPricing: [],
  gameTypeConfig: [],
  capacities: []
});
```

---

### Task 8: Add Per-Stop Settings (Day 7 - 3 hours)

**New Component**: `StopRegistrationSettings.tsx`

**Purpose**: Configure registration deadline per stop

**UI Design**:
```
┌─────────────────────────────────────────────┐
│ Stop Registration Settings                  │
├─────────────────────────────────────────────┤
│ Stop 1 - Seattle                            │
│   Registration Deadline: [Nov 14, 11:59 PM] │
│   [ ] Auto-close when stop ends            │
│                                              │
│ Stop 2 - Portland                           │
│   Registration Deadline: [Nov 21, 11:59 PM] │
│   [✓] Auto-close when stop ends            │
└─────────────────────────────────────────────┘
  [Set All Deadlines to 1 Day Before Start]
```

---

## Testing Plan

### Unit Tests
- [ ] Pricing model selection changes visibility
- [ ] Currency formatting works correctly
- [ ] Capacity validation prevents invalid values
- [ ] Game type grid enables/disables correctly

### Integration Tests
- [ ] Save tournament config with all pricing models
- [ ] Load tournament config correctly
- [ ] Update capacity limits
- [ ] Update game type configuration

### Manual Testing Checklist
- [ ] Create team tournament with PER_STOP pricing
- [ ] Create individual tournament with PER_BRACKET pricing
- [ ] Set capacity limits for multiple stop/bracket combos
- [ ] Enable/disable game types
- [ ] Verify summary section reflects all changes
- [ ] Test with existing tournament (backward compatibility)

---

## Timeline

| Day | Tasks | Hours | Deliverable |
|-----|-------|-------|-------------|
| 1 | Task 1: Pricing Model Selection | 3 | Radio buttons working |
| 2 | Task 2: Per-Stop Pricing | 4 | Component complete |
| 2-3 | Task 3: Per-Bracket Pricing | 4 | Component complete |
| 3-4 | Task 4: Game Type Grid | 6 | Grid functional |
| 4-5 | Task 5: Capacity Management | 6 | Table functional |
| 5-6 | Task 6: API Endpoints | 6 | All endpoints working |
| 6-7 | Task 7: Editor Integration | 4 | Full integration |
| 7 | Task 8: Stop Settings | 3 | Per-stop deadlines |
| 7-8 | Testing & Bug Fixes | 8 | All tests passing |
| **Total** | **8 days** | **44 hours** | **Phase 2 Complete** |

With some buffer time, this fits comfortably into 1.5 weeks (10 business days).

---

## Success Criteria

- [ ] All 4 pricing models can be configured
- [ ] Game types can be enabled/disabled per bracket
- [ ] Capacity limits can be set at stop/bracket/club level
- [ ] Per-stop registration deadlines can be set
- [ ] All configuration saves correctly to database
- [ ] Existing tournaments still work (backward compatible)
- [ ] UI is intuitive and responsive
- [ ] Validation prevents invalid configurations

---

## Next Steps

1. **Start with Task 1** - Add pricing model selection (simplest)
2. **Build incrementally** - One component at a time
3. **Test frequently** - Don't wait until the end
4. **Get feedback** - Show progress to stakeholders

Ready to begin? Let me know which task you'd like to start with!
