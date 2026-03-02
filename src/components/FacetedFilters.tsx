import { useMemo } from "react";
import { X, Bookmark } from "lucide-react";
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

// Tag categorization rules
const FACET_CATEGORIES: { key: string; label: string; match: (tag: string) => boolean }[] = [
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
  {
    key: "cuisine",
    label: "Cuisine",
    match: (t) => /korean|japanese|chinese|thai|indian|mexican|italian|french|greek|mediterranean|american|pasta|middle.eastern|african|vietnamese|spanish/i.test(t),
  },
];

function categorizeTag(tag: string): string {
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
      // Recipe must match at least one selected value in this category
      const hasMatch = r.nutritional_tags.some((t) => values.has(t));
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
  // Build categorized tag map with availability counts
  const { facetGroups, hasAnyFilter } = useMemo(() => {
    // Collect all tags
    const tagSet = new Set<string>();
    allRecipes.forEach((r) => r.nutritional_tags.forEach((t) => tagSet.add(t)));

    // Group by category
    const groups: Record<string, string[]> = {};
    for (const cat of FACET_CATEGORIES) groups[cat.key] = [];
    groups["other"] = [];

    tagSet.forEach((tag) => {
      if (tag.toLowerCase() === "to-try") return; // handled by status toggle
      const cat = categorizeTag(tag);
      groups[cat].push(tag);
    });

    // Sort each group
    for (const key of Object.keys(groups)) groups[key].sort();

    // Remove empty groups
    for (const key of Object.keys(groups)) {
      if (groups[key].length === 0) delete groups[key];
    }

    const hasAny =
      toTryActive || Object.values(selectedFacets).some((s) => s.size > 0);

    return { facetGroups: groups, hasAnyFilter: hasAny };
  }, [allRecipes, selectedFacets, toTryActive]);

  // Calculate availability: would toggling this tag yield >0 results?
  const getAvailableCount = (category: string, tag: string): number => {
    // Build a hypothetical filter set with this tag added/toggled
    const hypothetical: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(selectedFacets)) {
      hypothetical[k] = new Set(v);
    }
    if (!hypothetical[category]) hypothetical[category] = new Set();

    // If already selected, it's always "available"
    if (hypothetical[category].has(tag)) return 1;

    // Add this tag
    hypothetical[category].add(tag);
    return applyFacetedFilters(allRecipes, hypothetical, toTryActive).length;
  };

  const categoryLabels: Record<string, string> = {};
  for (const cat of FACET_CATEGORIES) categoryLabels[cat.key] = cat.label;
  categoryLabels["other"] = "Other";

  const toTryCount = allRecipes.filter(isRecipeToTry).length;

  return (
    <div className="space-y-2">
      {/* Status row: To-Try */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">Status</span>
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
        <div key={catKey} className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">
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
                  className={`cursor-pointer text-xs whitespace-nowrap transition-all ${
                    available === 0 && !isSelected ? "opacity-40 cursor-not-allowed" : ""
                  }`}
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
