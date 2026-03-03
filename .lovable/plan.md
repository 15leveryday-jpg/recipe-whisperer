

# System Refactor: Smart Parsing, Semantic Tagging, and Linked Interactions

## Overview

Five interconnected upgrades to the recipe engine: intelligent ingredient section headers, cross-column hover linking, tag hierarchy reordering, edit mode enhancements, and editorial visual polish.

---

## 1. Smart Ingredient Parser

**File:** `src/components/RecipeDetail.tsx`

Add a helper function `isIngredientHeader(name: string): boolean` that returns true if the ingredient name:
- Is wrapped in `**double asterisks**`
- Ends with a `:`
- Is ALL CAPS with no measurement units (regex: `/^[A-Z\s&,]+$/` and no amount/unit)

**View Mode rendering:**
- Header lines render as bold serif text (`font-display text-sm font-semibold mt-4 border-b border-border/40 pb-1`) with **no checkbox**
- Regular ingredients keep their existing checkbox behavior

**Edit Mode:**
- No special handling needed beyond existing inline editing — the preview in view mode will re-render headers instantly based on the name field content

## 2. Linked "Cooked.wiki" Hover Effect

**File:** `src/components/RecipeDetail.tsx`

Add state: `hoveredIngredient: string | null`

**Ingredients column:** On `onMouseEnter` of an ingredient row, set `hoveredIngredient` to the ingredient name. On `onMouseLeave`, clear it. When the ingredient is the hovered one (triggered from instructions), apply `bg-[#F1F8E9]` highlight.

**Instructions column:** Replace `<ReactMarkdown>` with a custom renderer. Post-render, wrap instruction text in a component that:
- Splits the instruction text and wraps occurrences of any ingredient name in `<span>` elements
- On hover of those spans, applies `underline decoration-primary/60` and sets `hoveredIngredient`
- When `hoveredIngredient` matches, the corresponding ingredient row in the left column gets `bg-[#F1F8E9]` background

Implementation: Create a `LinkedInstructions` component that takes the markdown string and ingredient names array, uses `ReactMarkdown` with a custom `p`/`li` text renderer that scans for ingredient name matches and wraps them in interactive spans.

## 3. Tagging Hierarchy & UX

**File:** `src/components/FacetedFilters.tsx`

**Reorder:** Move the `cuisine` entry in `FACET_CATEGORIES` array to index 0 (before `dietary`). This is a one-line array reorder.

**Drag-and-Drop between groups:** This requires a DnD library. Since the project doesn't have one installed, I'll use native HTML5 drag-and-drop on the Badge elements:
- Each tag Badge gets `draggable="true"` with `onDragStart` storing the tag name and source category
- Each category row acts as a drop zone with `onDragOver`/`onDrop`
- On drop: update the tag's category by storing a user-override mapping in localStorage (`tagCategoryOverrides: Record<string, string>`)
- The `categorizeTag` function checks this override map first before falling back to regex matching
- These overrides persist across sessions via localStorage (not in recipe metadata, since tags themselves don't change — only their UI grouping)

## 4. Edit Mode Enhancements

**File:** `src/components/RecipeDetail.tsx`

**Source URL field:** Add an `editSourceUrl` state initialized from `recipe.source_url`. Render a dedicated input field with an `ExternalLink` icon in edit mode, placed in the meta bar area. Include `source_url` in the `handleSave` updates object.

**Layout:** The dual-column layout already exists (`grid grid-cols-1 md:grid-cols-2`). No changes needed — just ensure new fields don't break it.

## 5. Visual Aesthetic (Editorial Polish)

**File:** `src/index.css`, `src/components/RecipeDetail.tsx`, `src/components/RecipeCard.tsx`, `src/pages/Index.tsx`

Refinements:
- Increase header `font-display` sizing in RecipeDetail to `text-2xl`
- Add `tracking-tight` to recipe titles for editorial feel
- Use `border-border/30` for subtler card borders
- Add `font-display` to section headers ("Ingredients", "Instructions", "Notes")
- Tighten prose spacing with `prose-neutral` variant
- Already using DM Serif Display + Inter — these are editorial-appropriate fonts

---

## Technical Notes

- **No database changes required** — all changes are frontend-only
- **No new dependencies** — using native HTML5 drag-and-drop instead of a library
- The ingredient-to-instruction linking uses string matching which may have edge cases with partial matches (e.g., "oil" matching "foil"). Will use word-boundary matching to minimize false positives.
- Tag category overrides via localStorage are user-specific and won't sync across devices, but avoid database complexity for a UI preference.

## Files to modify
1. `src/components/RecipeDetail.tsx` — header parsing, hover linking, source URL field, editorial styling
2. `src/components/FacetedFilters.tsx` — reorder cuisine to top, add drag-and-drop
3. `src/index.css` — minor editorial polish
4. `src/components/RecipeCard.tsx` — subtle border/typography tweaks
5. `src/pages/Index.tsx` — header typography refinement

