import { ChefHat, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/types/recipe";

interface MealPlanDockProps {
  meals: Recipe[];
  onExpand: () => void;
  onRemove: (id: string) => void;
}

const MealPlanDock = ({ meals, onExpand, onRemove }: MealPlanDockProps) => {
  if (meals.length === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl mx-4 mb-4 bg-card border border-border rounded-2xl shadow-float p-3 animate-fade-in">
        {/* Progress */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-sm font-medium text-foreground">
            {meals.length}/5 Recipes Selected
          </span>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={onExpand}>
            <ChevronUp className="w-4 h-4" /> View Plan
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted mb-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(meals.length / 5) * 100}%` }}
          />
        </div>

        {/* Thumbnails */}
        <div className="flex items-center gap-2">
          {meals.map((recipe) => (
            <div key={recipe.id} className="relative group">
              <button
                onClick={onExpand}
                className="w-14 h-14 rounded-lg overflow-hidden border border-border/50 hover:ring-2 hover:ring-primary transition-all"
              >
                {recipe.image_url ? (
                  <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-accent flex items-center justify-center">
                    <ChefHat className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(recipe.id); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {/* Empty slots */}
          {Array.from({ length: 5 - meals.length }).map((_, i) => (
            <div key={`empty-${i}`} className="w-14 h-14 rounded-lg border-2 border-dashed border-border/40 flex items-center justify-center">
              <span className="text-muted-foreground/30 text-lg">+</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MealPlanDock;
