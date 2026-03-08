import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Recipe, Ingredient } from "@/types/recipe";
import { applyFacetedFilters } from "@/components/FacetedFilters";
import { toast } from "sonner";

/** Normalize a word for fuzzy plural matching */
function stem(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith("ies")) return w.slice(0, -3) + "y"; // berries → berry
  if (w.endsWith("ves")) return w.slice(0, -3) + "f"; // leaves → leaf
  if (w.endsWith("es")) return w.slice(0, -2); // tomatoes → tomato
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1); // onions → onion
  return w;
}

function fuzzyMatch(text: string, term: string): boolean {
  const tLower = text.toLowerCase();
  const termLower = term.toLowerCase();
  if (tLower.includes(termLower)) return true;
  // Stem-based matching
  const stemTerm = stem(term);
  const words = tLower.split(/\s+/);
  return words.some((w) => {
    const sw = stem(w);
    return sw.includes(stemTerm) || stemTerm.includes(sw);
  });
}

export interface WeightedRecipe extends Recipe {
  matchScore?: number;
  matchedIngredients?: string[];
  matchPercentage?: number;
}

/** Score a recipe against search terms with weighted hierarchy */
function scoreRecipe(recipe: Recipe, terms: string[]): { score: number; matchedIngredients: string[] } {
  if (terms.length === 0) return { score: 0, matchedIngredients: [] };

  let totalScore = 0;
  const matchedIngredients: string[] = [];
  const ingredientNames = recipe.ingredients.map((i) => i.name || "");

  for (const term of terms) {
    let termScore = 0;

    // Tier 1: Title match (weight 10)
    if (fuzzyMatch(recipe.title, term)) {
      termScore += 10;
    }

    // Tier 2: Ingredient match (weight 5)
    for (const ingName of ingredientNames) {
      if (fuzzyMatch(ingName, term)) {
        termScore += 5;
        if (!matchedIngredients.includes(ingName)) {
          matchedIngredients.push(ingName);
        }
        break; // count once per term
      }
    }

    // Tier 3: Instructions/tags match (weight 1)
    if (fuzzyMatch(recipe.instructions || "", term)) {
      termScore += 1;
    }
    if (recipe.nutritional_tags.some((t) => fuzzyMatch(t, term))) {
      termScore += 2;
    }

    totalScore += termScore;
  }

  // Bonus for matching ALL terms (pantry mode)
  if (terms.length > 1) {
    const termsMatched = terms.filter((term) => {
      return (
        fuzzyMatch(recipe.title, term) ||
        ingredientNames.some((n) => fuzzyMatch(n, term)) ||
        fuzzyMatch(recipe.instructions || "", term) ||
        recipe.nutritional_tags.some((t) => fuzzyMatch(t, term))
      );
    });
    if (termsMatched.length === terms.length) {
      totalScore += 20; // big bonus for matching all
    }
  }

  return { score: totalScore, matchedIngredients };
}

export function useRecipes(userId: string | undefined) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<WeightedRecipe[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  // Faceted filter state
  const [selectedFacets, setSelectedFacets] = useState<Record<string, Set<string>>>({});
  const [toTryActive, setToTryActive] = useState(false);

  const fetchRecipes = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load recipes");
    } else {
      setRecipes(
        (data || []).map((r) => ({
          ...r,
          ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []) as unknown as Ingredient[],
          reference_image_url: (r as any).reference_image_url ?? null,
          is_to_try: (r as any).is_to_try ?? false,
          notes: (r as any).notes ?? "",
          cook_count: (r as any).cook_count ?? 0,
        }))
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // AI-powered semantic search (triggered on explicit submit)
  const hybridSearch = async (query: string) => {
    setSearchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-recipes", {
        body: { type: "semantic", query },
      });
      if (error) throw error;
      setSearchResults(
        (data?.results || []).map((r: any) => ({
          ...r,
          ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
          reference_image_url: r.reference_image_url ?? null,
          is_to_try: r.is_to_try ?? false,
          notes: r.notes ?? "",
          cook_count: r.cook_count ?? 0,
        }))
      );
    } catch {
      toast.error("Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchResults(null);
    setLocalSearchQuery("");
  };

  // Local weighted search: real-time filtering
  const localFilteredRecipes = useMemo((): WeightedRecipe[] => {
    const base = searchResults || recipes;
    if (!localSearchQuery.trim()) return base;

    // Parse terms: split by commas first, then by spaces
    const terms = localSearchQuery
      .split(/[,]+/)
      .flatMap((chunk) => chunk.trim().split(/\s+/))
      .filter((t) => t.length > 1); // ignore single chars

    if (terms.length === 0) return base;

    const scored = base
      .map((recipe) => {
        const { score, matchedIngredients } = scoreRecipe(recipe, terms);
        if (score === 0) return null;
        return {
          ...recipe,
          matchScore: score,
          matchedIngredients,
        } as WeightedRecipe;
      })
      .filter(Boolean) as WeightedRecipe[];

    scored.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    return scored;
  }, [searchResults, recipes, localSearchQuery]);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    recipes.forEach((r) => r.nutritional_tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [recipes]);

  // Toggle a facet value
  const toggleFacet = useCallback((category: string, value: string) => {
    setSelectedFacets((prev) => {
      const next = { ...prev };
      if (!next[category]) next[category] = new Set();
      else next[category] = new Set(next[category]);
      if (next[category].has(value)) next[category].delete(value);
      else next[category].add(value);
      return next;
    });
  }, []);

  const clearAllFacets = useCallback(() => {
    setSelectedFacets({});
    setToTryActive(false);
  }, []);

  // Apply faceted filters on top of local search
  const filteredRecipes = useMemo(() => {
    return applyFacetedFilters(localFilteredRecipes, selectedFacets, toTryActive);
  }, [localFilteredRecipes, selectedFacets, toTryActive]);

  const updateRecipe = async (id: string, updates: Partial<Recipe>) => {
    const { error } = await supabase
      .from("recipes")
      .update(updates as any)
      .eq("id", id);
    if (error) {
      toast.error("Failed to update recipe");
      return false;
    }
    toast.success("Recipe updated");
    setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    return true;
  };

  const deleteRecipe = async (id: string) => {
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete recipe");
      return false;
    }
    toast.success("Recipe deleted");
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    return true;
  };

  return {
    recipes: filteredRecipes,
    allRecipes: recipes,
    loading,
    searchLoading,
    searchResults,
    hybridSearch,
    clearSearch,
    fetchRecipes,
    localSearchQuery,
    setLocalSearchQuery,
    selectedFacets,
    toggleFacet,
    toTryActive,
    setToTryActive,
    clearAllFacets,
    allTags,
    updateRecipe,
    deleteRecipe,
  };
}
