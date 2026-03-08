import { useMemo, useState, useCallback } from "react";
import { X, Bookmark, ChefHat, Heart, UtensilsCrossed, Leaf, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/types/recipe";

interface FacetedFiltersProps {
  allRecipes: Recipe[];
  selectedFacets: Record<string, Set<string>>;
  onToggleFacet: (category: string, value: string) => void;
  onClearAll: () => void;
  toTryActive: boolean;
  onToggleToTry: () => void;
}

const FACET_CATEGORIES: { key: string; label: string; icon: typeof ChefHat; match: (tag: string) => boolean }[] = [
  {
    key: "cuisine",
    label: "Cuisine",
    icon: ChefHat,
    match: (t) => /korean|japanese|chinese|thai|indian|mexican|italian|french|greek|mediterranean|american|pasta|middle.eastern|african|vietnamese|spanish|cambodian/i.test(t),
  },
  {
    key: "dietary",
    label: "Dietary",
    icon: Leaf,
    match: (t) => /vegan|vegetarian|pescatarian|gluten.free|dairy.free|paleo|keto|whole30|halal|kosher/i.test(t),
  },
  {
    key: "meal",
    label: "Meal Type",
    icon: UtensilsCrossed,
    match: (t) => /breakfast|brunch|lunch|dinner|main|side|snack|dessert|appetizer|soup|salad|sandwich/i.test(t),
  },
  {
    key: "health",
    label: "Health",
    icon: Heart,
    match: (t) => /protein|low.cal|low.carb|fiber|iron|vitamin|omega|antioxidant|heart|energy|weight/i.test(t),
  },
];

/** Normalize a tag for display in filters: strip parenthetical suffixes */
export function normalizeTagLabel(tag: string): string {
  return tag.replace(/\s*\(.*\)\s*$/, "").trim();
}

const TAG_OVERRIDES_KEY = "tagCategoryOverrides";

function loadTagOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TAG_OVERRIDES_KEY) || "{}");
  } catch {
    return {};
  }
}

function categorizeTag(tag: string): string {
  const overrides = loadTagOverrides();
  const normalized = normalizeTagLabel(tag);
  if (overrides[normalized]) return overrides[normalized];
  for (const cat of FACET_CATEGORIES) {
    if (cat.match(tag)) return cat.key;
  }
  return "other";
}

/** Check if a recipe is "To-Try" (unified logic) */
export function isRecipeToTry(r: Recipe): boolean {
  return r.is_to_try || r.nutritional_tags.some((t) => t.toLowerCase() === "to-try");
}

/** Apply faceted filters to a recipe list */
export function applyFacetedFilters(
  recipes: Recipe[],
  selectedFacets: Record<string, Set<string>>,
  toTryActive: boolean
): Recipe[] {
  return recipes.filter((r) => {
    if (toTryActive && !isRecipeToTry(r)) return false;
    for (const [, values] of Object.entries(selectedFacets)) {
      if (values.size === 0) continue;
      const hasMatch = r.nutritional_tags.some((t) => values.has(normalizeTagLabel(t)));
      if (!hasMatch) return false;
    }
    return true;
  });
}

const MAX_VISIBLE = 5;

const FacetedFilters = ({
  allRecipes,
  selectedFacets,
  onToggleFacet,
  onClearAll,
  toTryActive,
  onToggleToTry,
}: FacetedFiltersProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((catKey: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catKey)) next.delete(catKey);
      else next.add(catKey);
      return next;
    });
  }, []);

  const { facetGroups, tagFrequency, hasAnyFilter } = useMemo(() => {
    const tagCount: Record<string, number> = {};
    allRecipes.forEach((r) =>
      r.nutritional_tags.forEach((t) => {
        const n = normalizeTagLabel(t);
        tagCount[n] = (tagCount[n] || 0) + 1;
      })
    );

    const groups: Record<string, string[]> = {};
    for (const cat of FACET_CATEGORIES) groups[cat.key] = [];
    groups["other"] = [];

    const seen: Record<string, Set<string>> = {};
    Object.keys(tagCount).forEach((normalized) => {
      // Find original tag to categorize
      const cat = categorizeTag(normalized);
      if (normalized.toLowerCase() === "to-try") return;
      if (!seen[cat]) seen[cat] = new Set();
      if (!seen[cat].has(normalized)) {
        seen[cat].add(normalized);
        groups[cat].push(normalized);
      }
    });

    // Sort each group by frequency (descending)
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (tagCount[b] || 0) - (tagCount[a] || 0));
    }
    for (const key of Object.keys(groups)) {
      if (groups[key].length === 0) delete groups[key];
    }

    const hasAny = toTryActive || Object.values(selectedFacets).some((s) => s.size > 0);
    return { facetGroups: groups, tagFrequency: tagCount, hasAnyFilter: hasAny };
  }, [allRecipes, selectedFacets, toTryActive]);

  const toTryCount = allRecipes.filter(isRecipeToTry).length;

  const categoryMeta: Record<string, { label: string; icon: typeof ChefHat }> = {};
  for (const cat of FACET_CATEGORIES) categoryMeta[cat.key] = { label: cat.label, icon: cat.icon };
  categoryMeta["other"] = { label: "Other", icon: MoreHorizontal };

  return (
    <div className="space-y-2">
      {/* Status row */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground w-16 sm:w-24 shrink-0 tracking-widest uppercase flex items-center gap-1.5">
          <Bookmark className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Status</span>
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          <Badge
            variant={toTryActive ? "default" : "outline"}
            className={`cursor-pointer text-xs whitespace-nowrap transition-all min-h-[36px] sm:min-h-0 ${
              toTryActive
                ? "bg-primary text-primary-foreground border-primary hover:bg-primary/80"
                : toTryCount === 0
                ? "opacity-40 cursor-not-allowed"
                : "bg-transparent border-border hover:bg-accent/40"
            }`}
            onClick={() => toTryCount > 0 && onToggleToTry()}
          >
            To-Try ({toTryCount})
          </Badge>
        </div>
        {hasAnyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground shrink-0 h-7 px-2 min-h-[44px] sm:min-h-0"
          >
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Tag category rows */}
      {Object.entries(facetGroups).map(([catKey, tags]) => {
        const meta = categoryMeta[catKey];
        const Icon = meta?.icon || MoreHorizontal;
        const isExpanded = expandedCategories.has(catKey);
        const selectedInCategory = selectedFacets[catKey] || new Set();

        // Build visible tags: top 5 by frequency + any selected tags not in top 5
        const topTags = tags.slice(0, MAX_VISIBLE);
        const overflowTags = tags.slice(MAX_VISIBLE);
        const selectedOverflow = overflowTags.filter((t) => selectedInCategory.has(t));
        const visibleTags = isExpanded
          ? tags
          : [...topTags, ...selectedOverflow.filter((t) => !topTags.includes(t))];

        const hasMore = tags.length > MAX_VISIBLE;

        return (
          <div key={catKey} className="flex items-start gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground w-24 shrink-0 tracking-widest uppercase flex items-center gap-1.5 pt-1">
              <Icon className="w-3.5 h-3.5" />
              {meta?.label || catKey}
            </span>
            <div className={`flex items-center gap-1.5 ${isExpanded ? "flex-wrap" : "overflow-x-auto scrollbar-hide"} pb-0.5`}>
              {visibleTags.map((tag) => {
                const isSelected = selectedInCategory.has(tag);
                const count = tagFrequency[tag] || 0;
                return (
                  <Badge
                    key={tag}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer text-xs whitespace-nowrap transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary hover:bg-primary/80"
                        : "bg-transparent border-border hover:bg-accent/40"
                    }`}
                    onClick={() => onToggleFacet(catKey, tag)}
                  >
                    {tag}
                    <span className={`ml-1 text-[10px] ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {count}
                    </span>
                  </Badge>
                );
              })}
              {hasMore && (
                <button
                  onClick={() => toggleExpand(catKey)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap px-1.5 py-0.5 rounded-full border border-dashed border-border hover:border-foreground/30"
                >
                  {isExpanded ? "− Less" : `+ ${overflowTags.length} more`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FacetedFilters;
