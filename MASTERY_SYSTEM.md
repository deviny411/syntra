# Mastery Tracking System - Complete Overview

## How Mastery is Calculated

### Formula (0-100 scale)
Each interaction type contributes to one of 4 weighted categories:

```
Mastery Score = (Revisit + Time + Subtopics + Content) × 100

Where each component = 25 points max
├─ Revisit Score: (min(visits, 5) / 5) × 0.25
├─ Time Score: (min(time_spent_seconds, 3600) / 3600) × 0.25
├─ Subtopic Score: (subtopics_explored / 5) × 0.25
└─ Content Score: (content_consumed / 100) × 0.25
```

### Interaction Types & Their Effects

| Interaction Type | Trigger | Effect | Points |
|---|---|---|---|
| `visit` | Panel open/close | Tracked on enter/exit, counted as revisits | Revisit +1 |
| `read_article` | Click Wikipedia/arXiv link → return & say "Yes" | Content consumed | +25% content |
| `watch_video` | Click YouTube link → return & say "Yes" | Content consumed | +15% content |
| `already_familiar` | Check "Already familiar with this topic" | Content boost | Content = min(50%, current+X) |
| `explore_subtopic` | Generate subtopics in Intra Mode | Exploration depth | Subtopics +1 |

### Mastery Score Interpretation

| Score Range | Label | Description |
|---|---|---|
| 0% | None | Not started |
| 0-16.7% | Explored | Getting started, initial exposure |
| 16.7-33.3% | Acquainted | Basic understanding forming |
| 33.3-50% | Familiar | Comfortable with core concepts |
| 50-66.7% | Proficient | Strong understanding |
| 66.7-83.3% | Advanced | Well mastered |
| 83.3-100% | Expert | Comprehensive mastery |

---

## How Notifications Work

### Content Modal Flow

1. **User Clicks External Link**
   - Click on Wikipedia/YouTube/arXiv link in panel
   - `handleLinkClick('article'/'video')` fires
   - Link opens in new tab
   - Window focus listener is set up

2. **User Returns to App Tab**
   - When focus returns to browser tab (NOT just window)
   - Modal pops up: "Did you read the article?" or "Did you watch the video?"

3. **User Responds**
   - **Yes** (Green button): High confidence, +25% content (articles) or +15% (videos)
   - **Skimmed** (Yellow button): Medium confidence, +12.5% content (articles) or +7.5% (videos)
   - **No** (Gray button): Low confidence, minimal boost

4. **Mastery Updates**
   - Backend logs the interaction with `confidence` level in metadata
   - Next mastery calculation includes this interaction
   - Mastery score increases based on all interactions

### Quick "Already Familiar" Checkbox

1. **User Sees Topic**
   - Panel shows a "Quick Assessment" section
   - Checkbox: "I'm already familiar with this topic"

2. **User Checks Box**
   - `handleAlreadyFamiliar()` fires immediately
   - Logs `already_familiar` interaction
   - Mastery recalculates automatically
   - Content score boosted to minimum 50%
   - Final score is at least ~50 (if only this interaction)

3. **Success Feedback**
   - Green confirmation: "✓ Mastery set to ~50%. Keep learning to reach mastery!"
   - Encourages further learning to reach higher levels

---

## Data Flow - Complete Journey

### Backend Logging Process

```
Frontend POST /api/mastery/log-interaction
├─ userId: "default-user"
├─ nodeId: "nn" (Neural Networks)
├─ interactionType: "read_article" | "watch_video" | "already_familiar" | "visit"
├─ durationSeconds: 30 (for visit interactions)
└─ metadata: { response: "yes", confidence: "high", type: "article" }
    ↓
snowflakeService.logInteraction()
├─ Validate connection
├─ INSERT INTO USER_INTERACTIONS table
│  ├─ USER_ID
│  ├─ NODE_ID
│  ├─ INTERACTION_TYPE
│  ├─ DURATION_SECONDS
│  ├─ METADATA (JSON)
│  └─ TIMESTAMP
└─ Return success
```

### Backend Mastery Calculation Process

```
Frontend GET /api/mastery/score/:userId/:nodeId
    ↓
snowflakeService.calculateMasteryScore()
├─ 1. Query all interactions for (userId, nodeId)
│  SELECT INTERACTION_TYPE, DURATION_SECONDS, COUNT(*)
│  FROM USER_INTERACTIONS
│  WHERE USER_ID = ? AND NODE_ID = ?
│  GROUP BY INTERACTION_TYPE, DURATION_SECONDS
│
├─ 2. Aggregate metrics
│  ├─ Count visits (revisitScore)
│  ├─ Sum time_spent (timeScore)
│  ├─ Count subtopic explores (subtopicsScore)
│  └─ Sum content percentages (contentScore)
│
├─ 3. Apply formula (as above)
│
├─ 4. Log detailed breakdown
│  └─ [Mastery Debug] Calculation formula:
│     Revisit (2/5 visits × 0.25): 10.0%
│     Time (180s / 3600s × 0.25): 1.3%
│     Subtopics (1/5 × 0.25): 5.0%
│     Content (50/100 × 0.25): 12.5%
│     → Final Score: 28.75/100
│
├─ 5. UPDATE MASTERY_SCORES table
│  INSERT/UPDATE with calculated score
│
└─ Return { masteryScore: 28.75 }
```

---

## Frontend State & UI

### NodeDetailsPanel State Variables

```tsx
const [masteryScore, setMasteryScore] = useState<number | null>(null);
// Current mastery 0-100, null while loading

const [masteryLoading, setMasteryLoading] = useState(false);
// True while fetching from API

const [panelOpenTime, setPanelOpenTime] = useState<number | null>(null);
// Timestamp when panel opened, used to calculate visit duration

const [showContentModal, setShowContentModal] = useState(false);
// Show/hide "Did you read/watch?" modal

const [contentType, setContentType] = useState<'article' | 'video' | null>(null);
// Track which type of link user clicked

const [isAlreadyFamiliar, setIsAlreadyFamiliar] = useState(false);
// Track if user checked "already familiar" checkbox
```

### Mastery Display (6-Segment Bar)

```tsx
{/* 6 boxes, each = ~16.7% */}
├─ Box 1: Filled if score ≥ 16.7%
├─ Box 2: Filled if score ≥ 33.3%
├─ Box 3: Filled if score ≥ 50%
├─ Box 4: Filled if score ≥ 66.7%
├─ Box 5: Filled if score ≥ 83.3%
└─ Box 6: Filled if score = 100%

Below: Label (e.g., "Familiar - Comfortable with concepts") + Percentage (38.5%)
```

### External Link Handling

```tsx
// When clicking Wikipedia/YouTube/arXiv link:
onClick={() => {
  setContentType('article'); // or 'video'
  window.addEventListener('focus', handleWindowFocus, { once: true });
  // Opens link in new tab
}}

// When returning to app:
const handleWindowFocus = () => {
  if (contentType) {
    setShowContentModal(true); // Show modal asking "Did you read/watch?"
  }
}
```

---

## Snowflake Tables

### USER_INTERACTIONS Table

| Column | Type | Description |
|---|---|---|
| USER_ID | STRING | User identifier |
| NODE_ID | STRING | Concept node ID |
| INTERACTION_TYPE | STRING | visit, read_article, watch_video, explore_subtopic, already_familiar |
| DURATION_SECONDS | NUMBER | For 'visit' interactions |
| METADATA | JSON | Confidence level, response type, etc. |
| TIMESTAMP | TIMESTAMP | When interaction occurred |

### MASTERY_SCORES Table

| Column | Type | Description |
|---|---|---|
| USER_ID | STRING | User identifier |
| NODE_ID | STRING | Concept node ID |
| MASTERY_SCORE | NUMBER | 0-100 calculated score |
| REVISIT_COUNT | NUMBER | How many times visited |
| TOTAL_TIME_SPENT | NUMBER | Seconds on panel |
| SUBTOPICS_EXPLORED | NUMBER | Count of explored subtopics |
| CONTENT_READ_PCT | NUMBER | % of content consumed |
| LAST_VISITED | TIMESTAMP | Last access |
| UPDATED_AT | TIMESTAMP | When score last recalculated |

---

## Common Mastery Paths

### Path 1: Quick Familiar Check
```
User clicks "Already familiar"
→ Logs already_familiar interaction
→ Content score = 50%
→ Mastery = ~50% (Familiar level)
→ Can increase further by reading/watching content
```

### Path 2: Deep Learning
```
User:
1. Visits panel multiple times (revisit_count++)
2. Reads Wikipedia article (content +25%)
3. Watches YouTube video (content +15%)
4. Explores subtopics (subtopic_count++)
5. Spends 30min on topic (time +8%)
→ Total: Mastery = 75-90% (Advanced/Expert)
```

### Path 3: Surface Learning
```
User:
1. Visits panel once (revisit_count = 1)
2. Skim-reads Wikipedia (content +12.5%)
3. Returns from external content → says "Skimmed"
→ Total: Mastery = ~25% (Acquainted)
→ Can improve by revisiting and consuming more content
```

---

## Future Enhancements

- [ ] Weighted confidence levels in content calculations
- [ ] Time decay (older interactions worth less)
- [ ] Spaced repetition recommendations
- [ ] AI-suggested learning sequences based on mastery gaps
- [ ] Achievements/badges for milestone scores
- [ ] Peer comparison (anonymized)
