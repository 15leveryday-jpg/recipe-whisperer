# Product Requirements Document: Recipe Vault

## 1. Overview

Recipe Vault is a personal, AI-powered recipe collection and meal-planning app. It lets users capture recipes from any source (URLs, raw text, or photos), search them intelligently, plan meals for the week, and generate organized shopping lists.

## 2. Target User

Home cooks who want one place to save recipes they find online or receive from friends, quickly rediscover dishes with natural-language search, and turn a weekly meal plan into a store-ready grocery list.

## 3. Core Value Proposition

- **Frictionless capture:** Paste a link, paste text, or snap a photo and AI structures the recipe.
- **Intelligent rediscovery:** Find recipes by title, ingredient, mood, or dietary need.
- **Week-to-table workflow:** Add recipes to a meal plan, then generate a shopping list grouped by store and category.
- **Mobile-first:** Every feature is designed for thumb-friendly use on a phone first.

## 4. User Flows

### 4.1 Capture a Recipe
1. User taps "Import" on the home grid.
2. Chooses "Paste / URL" or "Scan Image."
3. Optionally marks the recipe as "To Try."
4. AI extracts title, ingredients, instructions, time, servings, and tags.
5. Recipe appears in the grid; embeddings are generated for semantic search.

### 4.2 Search & Discover
1. User types in the search bar.
2. Real-time weighted search ranks results: title matches first, then high-volume ingredient matches, then minor ingredient matches.
3. Toggling "Vibe Search" switches to AI semantic search for natural-language queries (e.g., "something spicy for a rainy day").
4. Faceted filters (tags, To Try) further narrow results.

### 4.3 Plan Meals
1. User taps the calendar icon on a recipe card to add it to the weekly meal plan (max 10).
2. A dock at the bottom shows planned meals.
3. Opening the dock shows the full week, allows reordering or removing meals.

### 4.4 Shop
1. From the shopping list, user generates items from the meal plan.
2. Items are grouped by Store, then by Category (Produce, Dairy, etc.).
3. User checks items off while shopping; swipe gestures reveal favorite and delete actions.
4. Tapping an item opens an edit sheet to change name, quantity, category, or store assignment.

### 4.5 Cook & Log
1. Inside a recipe, user scales servings and toggles metric/imperial units.
2. Tapping "Mark as Cooked" logs the cook, increments the cook counter, and removes the To-Try tag.
3. Hovering or tapping instruction paragraphs highlights the ingredients used in that step.

## 5. Feature Requirements

### 5.1 Authentication
- Email/password sign-up and sign-in via Lovable Cloud auth.
- Password reset flow: request link → receive email → set new password at `/reset-password`.
- Each user only sees their own recipes, meal plan, and shopping list.

### 5.2 Recipe Management
- Store: title, source, source URL, ingredients, instructions, times, servings, tags, image, notes, cook count, To-Try flag.
- CRUD: create via import, read grid/detail, update inline in detail view, delete with confirmation.
- Image upload to storage bucket; fallback placeholder for missing images.

### 5.3 AI Import (Edge Function: `parse-recipe`)
- Accepts URL, raw text, or base64 image.
- Uses Lovable AI Gateway with function calling to extract structured recipe data.
- Fetches OG image for URL imports.
- Generates 768-dimension embedding via `text-embedding-3-small` and stores it.
- Returns error if no instructions are found (does not fabricate steps).

### 5.4 Search
- **Local weighted search:** real-time, no comma trigger, hard filter to title/ingredients only.
  - Title match: highest weight.
  - Ingredient match: weighted by quantity/unit significance; bulk ingredients score higher; powders/dried/garnish score lower.
  - Multi-term bonus for matching all terms.
  - Match percentage bar shown for multi-ingredient searches.
- **Semantic/Vibe Search:** calls `search-recipes` edge function.
  - Vector similarity via pgvector `match_recipes` RPC.
  - Falls back to AI re-ranking, then keyword search if vectors are sparse.
- **Faceted filters:** by nutritional tags and To-Try status.

### 5.5 Embeddings
- `recipes` table has an `embedding` column (vector or JSON string).
- `match_recipes` Postgres RPC returns recipes ordered by cosine similarity.
- `backfill-embeddings` edge function processes recipes missing embeddings in batches of 50 with rate-limit delays.

### 5.6 Meal Plan
- `meal_plans` table links users to recipes with position.
- Bottom dock shows thumbnails; drawer shows full list with reorder and remove.
- Max 10 meals per week.

### 5.7 Shopping List
- `grocery_items` table stores items per user.
- `item_store_availability` many-to-many table links items to stores.
- `stores` table lets users define custom stores with colors.
- Grouping: Store header (sticky) → Category sub-header → items.
- Checked items get strikethrough + muted styling; cleared bought items are deleted.
- Swipe actions: delete (red), favorite (gold).
- Edit sheet: name, quantity, category, store assignment.
- Add bar fixed at bottom; generate-from-meal-plan button in header.

### 5.8 Contextual "Add to Shopping List" from Ingredients
- Desktop: hover reveals a "+" icon next to an ingredient.
- Mobile: tap row toggles an inline "+ Add" button.
- Parses quantity/unit; includes recipe source label; toast with Undo.

### 5.9 Linked Instructions
- Hovering or tapping an instruction paragraph highlights all ingredients mentioned in that step.
- Stopword/measurement filter prevents false matches.
- Ingredient rows scale and color-shift when their step is active.

## 6. Technical Architecture

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, react-router-dom, TanStack Query.
- **Backend:** Lovable Cloud (Supabase): Postgres, Auth, Storage, Edge Functions.
- **AI:** Lovable AI Gateway for recipe parsing, embeddings, and semantic re-ranking.
- **State:** React hooks for local state; Supabase for persistence; optimistic updates with rollback on error.

## 7. Data Model

```text
auth.users
  └── recipes (user_id, embedding, ...)
  └── grocery_items (user_id, ...)
  └── stores (user_id, name, color)
  └── meal_plans (user_id, recipe_id, position)
  └── recipe_logs (user_id, recipe_id, cooked_at)

recipes ──< meal_plans
recipes ──< recipe_logs

grocery_items >──< item_store_availability >──< stores
```

Key tables: `recipes`, `grocery_items`, `stores`, `item_store_availability`, `meal_plans`, `recipe_logs`.

## 8. Design System

- **Palette:** warm cream background, terracotta primary, sage/herb accents, charcoal text.
- **Typography:** DM Serif Display for headings, Inter for body.
- **Spacing:** 8pt grid; cards use 4px/8px internal spacing.
- **Mobile-first standards:**
  - Main wrapper: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
  - Responsive typography with `text-2xl md:text-4xl` patterns.
  - Complex controls default to bottom sheet/drawer on mobile, popover/sidebar on desktop.
  - Touch targets minimum `min-h-[44px]` and `min-w-[44px]`.
  - `overflow-x-hidden` on body to prevent horizontal scroll.
- **Components:** shadcn/ui Button, Input, Dialog, Sheet, Checkbox, Badge, Toast/Sonner.

## 9. Edge Functions

| Function | Purpose |
| --- | --- |
| `parse-recipe` | Extract recipe from URL/text/image and generate embedding. |
| `search-recipes` | Semantic search with vector fallback + AI re-ranking + keyword fallback. |
| `backfill-embeddings` | Batch-generate embeddings for recipes that lack them. |

## 10. Non-Goals (Out of Scope)

- Social sharing or public recipe feeds.
- Nutritional calculation / macro tracking.
- Calendar date-based meal scheduling (only a simple weekly list).
- Multi-user households / shared collections.
- Native mobile apps.

## 11. Success Metrics

- Recipe import success rate and parse quality.
- Search result relevance (title/ingredient matches surface first).
- Meal-plan-to-shopping-list conversion usage.
- Mobile viewport usability (no horizontal overflow, reachable touch targets).

## 12. Open Questions / Next Work

- Should the app support importing from specific platforms (e.g., YouTube transcripts, Instagram captions) with dedicated parsers?
- Should cook history be visualized (e.g., "last cooked 3 weeks ago")?
- Should shopping items auto-merge duplicates when generated from a meal plan?
- Should there be a dedicated "To Try" queue view separate from the main grid?
