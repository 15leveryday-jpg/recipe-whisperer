import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Recipe } from "@/types/recipe";

const MAX_MEALS = 5;

export function useMealPlan(userId: string | undefined) {
  const [meals, setMeals] = useState<Recipe[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch meal plan from DB on mount / user change
  useEffect(() => {
    if (!userId) {
      setMeals([]);
      return;
    }

    const fetchMealPlan = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("meal_plans")
        .select("recipe_id, recipes(*)")
        .eq("user_id", userId);

      if (error) {
        console.error("Failed to fetch meal plan:", error);
        setLoading(false);
        return;
      }

      const recipes: Recipe[] = (data ?? [])
        .map((row: any) => row.recipes)
        .filter(Boolean)
        .map((r: any) => ({
          ...r,
          ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        }));

      setMeals(recipes);
      setLoading(false);
    };

    fetchMealPlan();
  }, [userId]);

  const addMeal = useCallback(
    async (recipe: Recipe) => {
      if (!userId) return;

      // Optimistic checks
      if (meals.some((r) => r.id === recipe.id)) {
        toast.info("Already in your week!");
        return;
      }
      if (meals.length >= MAX_MEALS) {
        toast("Your week is full!", {
          description: "Remove a recipe before adding another.",
        });
        return;
      }

      // Optimistic update
      setMeals((prev) => [...prev, recipe]);
      toast.success(`Added "${recipe.title}"`);

      const { error } = await supabase
        .from("meal_plans")
        .insert({ user_id: userId, recipe_id: recipe.id });

      if (error) {
        // Rollback
        setMeals((prev) => prev.filter((r) => r.id !== recipe.id));
        toast.error("Failed to save to meal plan");
        console.error(error);
      }
    },
    [userId, meals]
  );

  const removeMeal = useCallback(
    async (id: string) => {
      if (!userId) return;

      const removed = meals.find((r) => r.id === id);
      setMeals((prev) => prev.filter((r) => r.id !== id));

      const { error } = await supabase
        .from("meal_plans")
        .delete()
        .eq("user_id", userId)
        .eq("recipe_id", id);

      if (error) {
        // Rollback
        if (removed) setMeals((prev) => [...prev, removed]);
        toast.error("Failed to remove from meal plan");
        console.error(error);
      }
    },
    [userId, meals]
  );

  const clearMeals = useCallback(async () => {
    if (!userId) return;

    const backup = [...meals];
    setMeals([]);

    const { error } = await supabase
      .from("meal_plans")
      .delete()
      .eq("user_id", userId);

    if (error) {
      setMeals(backup);
      toast.error("Failed to clear meal plan");
      console.error(error);
    }
  }, [userId, meals]);

  return {
    meals,
    loading,
    addMeal,
    removeMeal,
    clearMeals,
    drawerOpen,
    setDrawerOpen,
  };
}
