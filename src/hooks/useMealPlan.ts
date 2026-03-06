import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { Recipe } from "@/types/recipe";

const MAX_MEALS = 5;

export function useMealPlan() {
  const [meals, setMeals] = useState<Recipe[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const addMeal = useCallback((recipe: Recipe) => {
    setMeals((prev) => {
      if (prev.some((r) => r.id === recipe.id)) {
        toast.info("Already in your week!");
        return prev;
      }
      if (prev.length >= MAX_MEALS) {
        toast("Your week is full!", { description: "Remove a recipe before adding another." });
        return prev;
      }
      toast.success(`Added "${recipe.title}"`);
      return [...prev, recipe];
    });
  }, []);

  const removeMeal = useCallback((id: string) => {
    setMeals((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearMeals = useCallback(() => setMeals([]), []);

  return {
    meals,
    addMeal,
    removeMeal,
    clearMeals,
    drawerOpen,
    setDrawerOpen,
  };
}
