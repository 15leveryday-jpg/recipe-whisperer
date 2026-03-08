import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Recipe, Ingredient } from "@/types/recipe";
import { applyFacetedFilters } from "@/components/FacetedFilters";
import { toast } from "sonner";

/** Normalize a word for fuzzy plural matching */
function stem(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("ves")) return w.slice(0, -3) + "f";
  if (w.endsWith("es")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function fuzzyMatch(text: string, term: string): boolean {
  const tLower = text.toLowerCase();
  const termLower = term.toLowerCase();
  if (tLower.includes(termLower)) return true;
  const stemTerm = stem(term);
  const words = tLower.split(/\s+/);
  return words.some((w) => {
    const sw = stem(w);
    return sw.includes(stemTerm) || stemTerm.includes(sw);
  });
}

// ─── Quantity parsing & significance ───

/** Units ranked by "bulk significance" — higher = more significant */
const UNIT_WEIGHT: Record<string, number> = {
  kg: 10, lb: 10, lbs: 10, pound: 10, pounds: 10,
  g: 7, gram: 7, grams: 7, oz: 7, ounce: 7, ounces: 7,
  cup: 6, cups: 6, can: 6, cans: 6, jar: 6, jars: 6,
  bunch: 5, bunches: 5, head: 5, heads: 5, breast: 5, breasts: 5,
  fillet: 5, fillets: 5, thigh: 5, thighs: 5, stalk: 4, stalks: 4,
  tbsp: 3, tablespoon: 3, tablespoons: 3,
  large: 4, medium: 3, small: 2, whole: 4,
  clove: 2, cloves: 2, slice: 2, slices: 2, piece: 3, pieces: 3,
  tsp: 1, teaspoon: 1, teaspoons: 1,
  pinch: 0.5, dash: 0.5, splash: 0.5, sprinkle: 0.5,
  garnish: 0.3, optional: 0.3,
};

interface QuantityInfo {
  numericValue: number;
  unitWeight: number;
  significance: number; // combined score
}

/** Parse an amount string like "3 large", "500g", "1/4 tsp" into a significance score */
function parseQuantity(amount: string | undefined, unit: string | undefined, name: string): QuantityInfo {
  const raw = `${amount || ""} ${unit || ""} ${name}`.toLowerCase();

  // Extract numeric value (handles fractions like 1/2, 1/4, mixed like "1 1/2")
  let numericValue = 1;
  const fractionMatch = raw.match(/(\d+)\s*\/\s*(\d+)/);
  const wholeMatch = raw.match(/^(\d+(?:\.\d+)?)/);
  if (fractionMatch) {
    const wholePart = raw.match(/^(\d+)\s+\d+\s*\//);
    numericValue = (wholePart ? parseFloat(wholePart[1]) : 0) + parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
  } else if (wholeMatch) {
    numericValue = parseFloat(wholeMatch[1]);
  }

  // Find the best matching unit weight
  let unitWeight = 3; // default for bare numbers ("2 onions")
  const allText = `${amount || ""} ${unit || ""}`.toLowerCase();
  for (const [u, w] of Object.entries(UNIT_WEIGHT)) {
    if (allText.includes(u) || name.toLowerCase().includes(u)) {
      if (w > unitWeight || unitWeight === 3) unitWeight = w;
    }
  }

  // Check for deprioritization keywords in the name
  const deprioritize = ["powder", "dried", "ground", "garnish", "optional", "to taste", "for serving"];
  const nameLower = name.toLowerCase();
  if (deprioritize.some((d) => nameLower.includes(d))) {
    unitWeight = Math.min(unitWeight, 1);
  }

  const significance = numericValue * unitWeight;
  return { numericValue, unitWeight, significance };
}

export interface MatchedIngredient {
  name: string;
  amount?: string;
  unit?: string;
  significance: number;
}

export interface WeightedRecipe extends Recipe {
  matchScore?: number;
  matchedIngredients?: MatchedIngredient[];
  matchPercentage?: number;
}

/** Score a recipe against search terms with weighted hierarchy including quantity analysis */
function scoreRecipe(recipe: Recipe, terms: string[]): { score: number; matchedIngredients: MatchedIngredient[]; hardMatch: boolean; ingredientMatchRatio: number } {
  if (terms.length === 0) return { score: 0, matchedIngredients: [], hardMatch: false, ingredientMatchRatio: 0 };

  let totalScore = 0;
  const matchedIngredients: MatchedIngredient[] = [];
  const ingredients = recipe.ingredients.filter((i) => !i.is_header);
  const servings = recipe.servings || 4;

  let hasHardMatch = false; // true if term found in title OR ingredients
  let termsWithIngredientMatch = 0;

  for (const term of terms) {
    let termScore = 0;
    let termHardMatch = false;

    // Tier 1: Title match (weight 20)
    if (fuzzyMatch(recipe.title, term)) {
      termScore += 20;
      termHardMatch = true;
    }

    // Tier 2 & 3: Ingredient match with quantity weighting
    for (let idx = 0; idx < ingredients.length; idx++) {
      const ing = ingredients[idx];
      if (!fuzzyMatch(ing.name || "", term)) continue;

      termHardMatch = true;
      termsWithIngredientMatch++;
      const qty = parseQuantity(ing.amount, ing.unit, ing.name || "");
      const perServing = qty.significance / servings;
      const positionMultiplier = idx < 3 ? 1.5 : 1;
      const isPrimary = qty.significance >= 4 || (idx < 3 && qty.significance >= 2);

      if (isPrimary) {
        termScore += 8 + Math.min(perServing * 4, 8) * positionMultiplier;
      } else {
        termScore += 2 + Math.min(perServing * 2, 3);
      }

      matchedIngredients.push({
        name: ing.name || "",
        amount: ing.amount,
        unit: ing.unit,
        significance: qty.significance,
      });
      break;
    }

    if (termHardMatch) hasHardMatch = true;

    // Soft matches only add minor score (don't qualify as hard match)
    if (fuzzyMatch(recipe.instructions || "", term)) {
      termScore += 1;
    }
    if (recipe.nutritional_tags.some((t) => fuzzyMatch(t, term))) {
      termScore += 2;
    }

    totalScore += termScore;
  }

  // Bonus for matching ALL terms
  if (terms.length > 1) {
    const termsMatched = terms.filter((term) =>
      fuzzyMatch(recipe.title, term) || ingredients.some((i) => fuzzyMatch(i.name || "", term))
    );
    if (termsMatched.length === terms.length) {
      totalScore += 25;
    }
  }

  // Ingredient match ratio: what % of recipe ingredients are covered by search terms
  const totalIngCount = ingredients.length || 1;
  const ingredientMatchRatio = terms.length > 1
    ? Math.round((termsWithIngredientMatch / totalIngCount) * 100)
    : 0;

  return { score: totalScore, matchedIngredients, hardMatch: hasHardMatch, ingredientMatchRatio };
}

export function useRecipes(userId: string | undefined) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<WeightedRecipe[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState("");

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

  const localFilteredRecipes = useMemo((): WeightedRecipe[] => {
    const base = searchResults || recipes;
    if (!localSearchQuery.trim()) return base;

    const terms = localSearchQuery
      .split(/[,]+/)
      .flatMap((chunk) => chunk.trim().split(/\s+/))
      .filter((t) => t.length > 1);

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

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    recipes.forEach((r) => r.nutritional_tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [recipes]);

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
