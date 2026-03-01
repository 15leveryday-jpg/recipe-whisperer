import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Recipe, Ingredient } from "@/types/recipe";
import { toast } from "sonner";

export function useRecipes(userId: string | undefined) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<(Recipe & { matchPercentage?: number })[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [highProtein, setHighProtein] = useState(false);
  const [quickMeal, setQuickMeal] = useState(false);
  const [toTryOnly, setToTryOnly] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

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

  // Apply filters
  const filteredRecipes = (searchResults || recipes).filter((r) => {
    if (highProtein && !r.nutritional_tags.some((t) => t.toLowerCase().includes("protein"))) return false;
    if (quickMeal) {
      const total = r.total_time_minutes || ((r.prep_time_minutes || 0) + (r.cook_time_minutes || 0));
      if (!total || total > 20) return false;
    }
    if (toTryOnly && !r.is_to_try) return false;
    if (activeTag && !r.nutritional_tags.includes(activeTag)) return false;
    return true;
  });

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
    // Optimistic local update
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
    highProtein, setHighProtein,
    quickMeal, setQuickMeal,
    toTryOnly, setToTryOnly,
    activeTag, setActiveTag,
    allTags,
    updateRecipe,
    deleteRecipe,
  };
}
