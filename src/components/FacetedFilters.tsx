import { useMemo, useState, useCallback } from "react";
import { X, Bookmark, GripVertical } from "lucide-react";
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

// Tag categorization rules — Cuisine first per plan
const FACET_CATEGORIES: { key: string; label: string; match: (tag: string) => boolean }[] = [
  {
    key: "cuisine",
    label: "Cuisine",
    match: (t) => /korean|japanese|chinese|thai|indian|mexican|italian|french|greek|mediterranean|american|pasta|middle.eastern|african|vietnamese|spanish|cambodian/i.test(t),
  },
  {
    key: "dietary",
    label: "Dietary",
    match: (t) => /vegan|vegetarian|pescatarian|gluten.free|dairy.free|paleo|keto|whole30|halal|kosher/i.test(t),
  },
  {
    key: "meal",
    label: "Meal Type",
    match: (t) => /breakfast|brunch|lunch|dinner|main|side|snack|dessert|appetizer|soup|salad|sandwich/i.test(t),
  },
  {
    key: "health",
    label: "Health / Goals",
    match: (t) => /protein|low.cal|low.carb|fiber|iron|vitamin|omega|antioxidant|heart|energy|weight/i.test(t),
  },
];

/** Normalize a tag for display in filters: strip parenthetical suffixes */
export function normalizeTagLabel(tag: string): string {
  return tag.replace(/\s*\(.*\)\s*$/, "").trim();
}

/** localStorage key for user tag category overrides */
const TAG_OVERRIDES_KEY = "tagCategoryOverrides";

function loadTagOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TAG_OVERRIDES_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveTagOverrides(overrides: Record<string, string>) {
  localStorage.setItem(TAG_OVERRIDES_KEY, JSON.stringify(overrides));
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

const FacetedFilters = ({
  allRecipes,
  selectedFacets,
  onToggleFacet,
  onClearAll,
  toTryActive,
  onToggleToTry,
}: FacetedFiltersProps) => {
  const [dragState, setDragState] = useState<{ tag: string; sourceCategory: string } | null>(null);
  const [overridesVersion, setOverridesVersion] = useState(0);

  const { facetGroups, hasAnyFilter } = useMemo(() => {
    // Force recalc when overrides change
    void overridesVersion;
    const tagSet = new Set<string>();
    allRecipes.forEach((r) => r.nutritional_tags.forEach((t) => tagSet.add(t)));

    const groups: Record<string, string[]> = {};
    for (const cat of FACET_CATEGORIES) groups[cat.key] = [];
    groups["other"] = [];

    const seen: Record<string, Set<string>> = {};
    tagSet.forEach((tag) => {
      if (tag.toLowerCase() === "to-try") return;
      const cat = categorizeTag(tag);
      const normalized = normalizeTagLabel(tag);
      if (!seen[cat]) seen[cat] = new Set();
      if (!seen[cat].has(normalized)) {
        seen[cat].add(normalized);
        groups[cat].push(normalized);
      }
    });

    for (const key of Object.keys(groups)) groups[key].sort();
    for (const key of Object.keys(groups)) {
      if (groups[key].length === 0) delete groups[key];
    }

    const hasAny = toTryActive || Object.values(selectedFacets).some((s) => s.size > 0);
    return { facetGroups: groups, hasAnyFilter: hasAny };
  }, [allRecipes, selectedFacets, toTryActive, overridesVersion]);

  const getAvailableCount = (category: string, tag: string): number => {
    const hypothetical: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(selectedFacets)) {
      hypothetical[k] = new Set(v);
    }
    if (!hypothetical[category]) hypothetical[category] = new Set();
    if (hypothetical[category].has(tag)) return 1;
    hypothetical[category].add(tag);
    return applyFacetedFilters(allRecipes, hypothetical, toTryActive).length;
  };

  const categoryLabels: Record<string, string> = {};
  for (const cat of FACET_CATEGORIES) categoryLabels[cat.key] = cat.label;
  categoryLabels["other"] = "Other";

  const toTryCount = allRecipes.filter(isRecipeToTry).length;

  // Drag-and-drop handlers
  const handleDragStart = useCallback((tag: string, sourceCategory: string) => {
    setDragState({ tag, sourceCategory });
  }, []);

  const handleDrop = useCallback((targetCategory: string) => {
    if (!dragState || dragState.sourceCategory === targetCategory) {
      setDragState(null);
      return;
    }
    const overrides = loadTagOverrides();
    overrides[dragState.tag] = targetCategory;
    saveTagOverrides(overrides);
    setDragState(null);
    setOverridesVersion((v) => v + 1);
  }, [dragState]);

  return (
    <div className="space-y-2">
      {/* Status row: To-Try */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground w-20 shrink-0 tracking-wide uppercase">Status</span>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          <Badge
            variant={toTryActive ? "default" : "outline"}
            className={`cursor-pointer text-xs whitespace-nowrap transition-all ${
              toTryActive
                ? "bg-to-try text-to-try-foreground hover:bg-to-try/80 border-transparent"
                : toTryCount === 0
                ? "opacity-40 cursor-not-allowed"
                : ""
            }`}
            onClick={() => toTryCount > 0 && onToggleToTry()}
          >
            <Bookmark className="w-3 h-3 mr-1" />
            To-Try ({toTryCount})
          </Badge>
        </div>
        {hasAnyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-3 h-3 mr-1" /> Clear All
          </Button>
        )}
      </div>

      {/* Tag category rows */}
      {Object.entries(facetGroups).map(([catKey, tags]) => (
        <div
          key={catKey}
          className={`flex items-center gap-2 ${dragState ? "border border-dashed border-transparent hover:border-primary/30 rounded-md p-1 -m-1 transition-colors" : ""}`}
          onDragOver={(e) => { if (dragState) e.preventDefault(); }}
          onDrop={() => handleDrop(catKey)}
        >
          <span className="text-xs font-medium text-muted-foreground w-20 shrink-0 tracking-wide uppercase">
            {categoryLabels[catKey] || catKey}
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {tags.map((tag) => {
              const isSelected = selectedFacets[catKey]?.has(tag);
              const available = isSelected ? 1 : getAvailableCount(catKey, tag);
              return (
                <Badge
                  key={tag}
                  variant={isSelected ? "default" : "outline"}
                  draggable
                  onDragStart={() => handleDragStart(tag, catKey)}
                  className={`cursor-pointer text-xs whitespace-nowrap transition-all select-none ${
                    available === 0 && !isSelected ? "opacity-40 cursor-not-allowed" : ""
                  } ${dragState?.tag === tag ? "opacity-50 ring-2 ring-primary/30" : ""}`}
                  onClick={() => available > 0 || isSelected ? onToggleFacet(catKey, tag) : undefined}
                >
                  {tag}
                </Badge>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FacetedFilters;
