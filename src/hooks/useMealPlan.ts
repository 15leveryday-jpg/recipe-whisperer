import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Recipe } from "@/types/recipe";

const MAX_MEALS = 5;

export function useMealPlan(userId: string | undefined) {
  const [meals, setMeals] = useState<Recipe[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setMeals([]);
      return;
    }

    const fetchMealPlan = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("meal_plans")
        .select("recipe_id, position, recipes(*)")
        .eq("user_id", userId)
        .order("position");

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

      const newPosition = meals.length;
      setMeals((prev) => [...prev, recipe]);
      toast.success(`Added "${recipe.title}"`);

      const { error } = await supabase
        .from("meal_plans")
        .insert({ user_id: userId, recipe_id: recipe.id, position: newPosition });

      if (error) {
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
        if (removed) setMeals((prev) => [...prev, removed]);
        toast.error("Failed to remove from meal plan");
        console.error(error);
      }
    },
    [userId, meals]
  );

  const reorderMeals = useCallback(
    async (reordered: Recipe[]) => {
      if (!userId) return;
      const backup = [...meals];
      setMeals(reordered);

      // Update positions in DB
      const updates = reordered.map((r, i) =>
        supabase
          .from("meal_plans")
          .update({ position: i } as any)
          .eq("user_id", userId)
          .eq("recipe_id", r.id)
      );

      const results = await Promise.all(updates);
      const failed = results.some((r) => r.error);
      if (failed) {
        setMeals(backup);
        toast.error("Failed to reorder");
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
    reorderMeals,
    clearMeals,
    drawerOpen,
    setDrawerOpen,
  };
}
