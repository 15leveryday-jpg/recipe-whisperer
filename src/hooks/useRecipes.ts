import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Recipe, Ingredient } from "@/types/recipe";
import { applyFacetedFilters } from "@/components/FacetedFilters";
import { toast } from "sonner";

export function useRecipes(userId: string | undefined) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<(Recipe & { matchPercentage?: number })[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

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
      const isPantry = query.includes(",");
      const { data, error } = await supabase.functions.invoke("search-recipes", {
        body: isPantry ? { type: "pantry", ingredients: query } : { type: "semantic", query },
      });
      if (error) throw error;
      setSearchResults(
        (data?.results || []).map((r: any) => ({
          ...r,
          ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
          reference_image_url: r.reference_image_url ?? null,
          is_to_try: r.is_to_try ?? false,
          notes: r.notes ?? "",
        }))
      );
    } catch {
      toast.error("Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => setSearchResults(null);

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

  // Apply faceted filters
  const filteredRecipes = useMemo(() => {
    const base = searchResults || recipes;
    return applyFacetedFilters(base, selectedFacets, toTryActive);
  }, [searchResults, recipes, selectedFacets, toTryActive]);

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
