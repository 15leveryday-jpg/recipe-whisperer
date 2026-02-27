import { useState, useEffect, useCallback } from "react";
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
        }))
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const semanticSearch = async (query: string) => {
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
        }))
      );
    } catch {
      toast.error("Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const pantrySearch = async (ingredientList: string) => {
    setSearchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-recipes", {
        body: { type: "pantry", ingredients: ingredientList },
      });
      if (error) throw error;
      setSearchResults(
        (data?.results || []).map((r: any) => ({
          ...r,
          ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        }))
      );
    } catch {
      toast.error("Pantry search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => setSearchResults(null);

  // Apply filters
  const filteredRecipes = (searchResults || recipes).filter((r) => {
    if (highProtein && !r.nutritional_tags.some((t) => t.toLowerCase().includes("protein"))) return false;
    if (quickMeal) {
      const total = r.total_time_minutes || ((r.prep_time_minutes || 0) + (r.cook_time_minutes || 0));
      if (!total || total > 20) return false;
    }
    return true;
  });

  return {
    recipes: filteredRecipes,
    loading,
    searchLoading,
    searchResults,
    semanticSearch,
    pantrySearch,
    clearSearch,
    fetchRecipes,
    highProtein,
    setHighProtein,
    quickMeal,
    setQuickMeal,
  };
}
