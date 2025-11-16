# Understanding Level System

## Overview
When users interact with external content (Wikipedia articles, YouTube videos, arXiv papers), they're asked: **"How well did you understand it?"**

This replaces the old "Did you read/watch?" binary question with a nuanced 4-level understanding scale.

---

## The 4 Understanding Levels

### 1. **Not Really** (Red/Low Confidence)
- **Symbol**: ✗
- **Color**: Red (#fee2e2 bg, #991b1b text)
- **Confidence Level**: `low`
- **Article Boost**: +5% content
- **Video Boost**: +3% content
- **Use Case**: User skimmed the content, didn't grasp key concepts
- **Example**: "I watched a video on Machine Learning but didn't understand the backpropagation part"

### 2. **Sort Of** (Yellow/Medium Confidence)
- **Symbol**: ~
- **Color**: Yellow (#fef08a bg, #92400e text)
- **Confidence Level**: `medium`
- **Article Boost**: +12% content
- **Video Boost**: +8% content
- **Use Case**: User understood some concepts but not all
- **Example**: "I read about neural networks and got the basics but lost track halfway through"

### 3. **Yes** (Green/High Confidence)
- **Symbol**: ✓
- **Color**: Green (#d1fae5 bg, #065f46 text)
- **Confidence Level**: `high`
- **Article Boost**: +20% content
- **Video Boost**: +12% content
- **Use Case**: User understood the material well
- **Example**: "I read about linear algebra and understood most of it"

### 4. **Very Well** (Blue/Very High Confidence)
- **Symbol**: ⭐
- **Color**: Blue (#dbeafe bg, #0c4a6e text)
- **Confidence Level**: `very_high`
- **Article Boost**: +25% content
- **Video Boost**: +15% content
- **Use Case**: User deeply understood the material
- **Example**: "I watched a video on neural networks and understood it completely"

---

## How Understanding Affects Mastery

### Content Score Calculation
```
Content Score = Σ(Article/Video Boosts) / 100 × 0.25 (max 25 points)
```

### Example: Reading a Wikipedia Article
- User reads article about "Neural Networks"
- User returns to app → Modal: "How well did you understand it?"

**Scenario A**: User clicks "Not Really"
- Content boost: +5%
- If no other interactions: Mastery ≈ 1.25% (very low)

**Scenario B**: User clicks "Sort Of"
- Content boost: +12%
- If no other interactions: Mastery ≈ 3% (low)

**Scenario C**: User clicks "Yes"
- Content boost: +20%
- If no other interactions: Mastery ≈ 5% (low-medium)

**Scenario D**: User clicks "Very Well"
- Content boost: +25%
- If no other interactions: Mastery ≈ 6.25% (medium)

### Multi-Content Example
```
User learns about "Machine Learning":

1. Reads Wikipedia article, says "Very Well"
   → Content: +25% (total 25%)

2. Watches YouTube video, says "Yes"
   → Content: +20% (total 45%)

3. Reads arXiv paper, says "Sort Of"
   → Content: +12% (total 57%)

4. Final Content Score: 57/100 × 0.25 = 14.25 points
   
5. If also visited 3x (7.5 pts) + 20min (3.3 pts) + 2 subtopics (10 pts)
   → Final Mastery: 7.5 + 3.3 + 10 + 14.25 = 35% (Familiar)
```

---

## Metadata Storage

Each interaction logs the understanding level in Snowflake's `METADATA` column:

```json
{
  "response": "yes",
  "confidence": "high",
  "contentType": "article",
  "timestamp": "2025-11-15T20:30:00Z"
}
```

This allows:
- Tracking user comprehension patterns over time
- Identifying areas where users struggle
- Personalizing future content recommendations
- Analytics on content effectiveness

---

## Browser Console Logs

When user responds to modal:
```
[Mastery] Logging read_article with response: yes (high)
[Mastery Route] Received log-interaction: {
  userId: "default-user",
  nodeId: "nn",
  interactionType: "read_article",
  metadata: {
    response: "yes",
    confidence: "high",
    contentType: "article",
    timestamp: "2025-11-15T20:30:00Z"
  }
}
[Mastery Route] ✅ Logged interaction successfully: read_article
```

Backend calculation:
```
[Mastery Debug] Calculation formula:
  Revisit (3/5 visits × 0.25): 15.0%
  Time (900s / 3600s × 0.25): 6.3%
  Subtopics (2/5 × 0.25): 10.0%
  Content (50/100 × 0.25): 12.5%
  → Final Score: 43.75/100
```

---

## Design Philosophy

The 4-level system provides:
- **Nuance**: Captures real learning outcomes (not just binary yes/no)
- **Fairness**: Rewards deeper understanding more than surface-level exposure
- **Honesty**: Users can accurately reflect their comprehension
- **Motivation**: Shows clear progression path from "Not Really" → "Very Well"
- **Data Quality**: Better learning analytics for AI recommendations

Each level has:
- **Clear Label**: "Not Really", "Sort Of", "Yes", "Very Well"
- **Visual Icon**: ✗, ~, ✓, ⭐ for quick recognition
- **Color Coding**: Red (low) → Yellow (medium) → Green (high) → Blue (very high)
- **Hover Effects**: Buttons lift slightly on hover for interactive feedback
