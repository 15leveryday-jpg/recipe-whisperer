import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChefHat, Trash2, ShoppingBag, Clock, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/types/recipe";

const STOP_WORDS = new Set([
  "the", "and", "with", "of", "a", "an", "or", "to", "for", "in", "on",
  "fresh", "large", "small", "medium", "finely", "thinly", "roughly",
  "chopped", "diced", "minced", "sliced", "grated", "optional", "dried",
  "ground", "whole", "about", "each", "cup", "cups", "tablespoon",
  "tablespoons", "teaspoon", "teaspoons", "ounce", "ounces", "pound",
  "pounds", "can", "jar", "package", "pinch", "dash",
]);

function extractCoreNouns(name: string): string[] {
  return name
    .replace(/[,()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w.toLowerCase()))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

interface MealPlanDrawerProps {
  meals: Recipe[];
  open: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onOpenRecipe: (recipe: Recipe) => void;
}

const MealPlanDrawer = ({ meals, open, onClose, onRemove, onClear, onOpenRecipe }: MealPlanDrawerProps) => {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-4xl bg-card rounded-t-2xl shadow-float max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-display text-xl text-foreground">Weekly Meal Plan</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{meals.length}/5 recipes selected</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => { onClose(); navigate("/shopping"); }}
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Shopping List
            </Button>
            {meals.length > 0 && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={onClear}>
                Clear All
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(meals.length / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Recipe list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
          {meals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-display text-lg">No recipes yet</p>
              <p className="text-sm mt-1">Add recipes from your library to plan your week.</p>
            </div>
          ) : (
            meals.map((recipe) => {
              const ingredientCount = recipe.ingredients.filter((ing) => !ing.is_header).length;
              const totalTime = recipe.total_time_minutes;

              return (
                <div
                  key={recipe.id}
                  className="flex gap-4 bg-background rounded-xl border border-border/50 p-4 hover:shadow-elevated transition-shadow group"
                >
                  {/* Thumbnail */}
                  <button
                    onClick={() => onOpenRecipe(recipe)}
                    className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden"
                  >
                    {recipe.image_url ? (
                      <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full bg-accent flex items-center justify-center">
                        <ChefHat className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => onOpenRecipe(recipe)} className="text-left">
                        <h3 className="font-display text-lg text-foreground leading-tight hover:text-primary transition-colors">
                          {recipe.title}
                        </h3>
                      </button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => onRemove(recipe.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <List className="w-3.5 h-3.5" />
                        {ingredientCount} Ingredient{ingredientCount !== 1 ? "s" : ""}
                      </span>
                      {totalTime && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {totalTime}m
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MealPlanDrawer;
