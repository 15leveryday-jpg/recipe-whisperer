

# Semantic Ingredient Highlighting — Paragraph-Level Hover

## What Changes

Upgrade the existing word-level ingredient↔instruction hover linking to a **paragraph-level** system where hovering an entire instruction step highlights all ingredients mentioned in that step.

## Approach

**File: `src/components/RecipeDetail.tsx`**

### 1. Stopword / Measurement Filter
Add a `IGNORED_TERMS` set containing generic/measurement words: "vegetables", "mixture", "ingredients", "sauce", "oil", "water", "salt", "pepper", "heat", "medium", "large", "small", "cup", "tablespoon", "teaspoon", "ounce", "cloves", "minutes", "degrees". Ingredient names shorter than 3 chars are already filtered.

### 2. Paragraph-to-Ingredient Mapping
Add a `hoveredStepIndex: number | null` state. Pre-compute a `stepIngredientMap: Map<number, Set<number>>` via `useMemo` that, for each instruction paragraph/list-item, finds which ingredient indices are mentioned using word-boundary regex matching against ingredient names (excluding headers and ignored terms).

### 3. LinkedInstructions Refactor
Change from word-level hover to **paragraph-level hover**:
- Each `<p>` and `<li>` rendered by ReactMarkdown gets an `onMouseEnter`/`onMouseLeave` that sets `hoveredStepIndex`
- The hovered paragraph gets `bg-muted/30 rounded-lg` subtle background
- Ingredient name spans within the active paragraph get `underline decoration-primary/60 decoration-2`
- Pass `hoveredStepIndex` and the step-ingredient map down

### 4. Ingredient Row Highlighting
When `hoveredStepIndex` is set, check if each ingredient index is in `stepIngredientMap.get(hoveredStepIndex)`:
- If yes: apply `bg-[#F1F8E9] scale-[1.03] border-l-4 border-[#8BC34A]` with `transition-all duration-300`
- Keep existing individual ingredient hover for backwards compatibility (lower priority than step hover)

### 5. Smooth Transitions
Add `transition-all duration-300` to ingredient `<li>` elements (currently `duration-150`). The transform origin should be `origin-left` so scale doesn't shift layout.

## Files to Modify
1. `src/components/RecipeDetail.tsx` — all changes in this single file

