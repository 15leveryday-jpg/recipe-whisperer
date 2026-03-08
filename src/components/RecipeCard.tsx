import { Clock, Users, ChefHat, Bookmark, CalendarPlus, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { isRecipeToTry } from "@/components/FacetedFilters";
import type { Recipe } from "@/types/recipe";

interface RecipeCardProps {
  recipe: Recipe;
  matchPercentage?: number;
  onClick: () => void;
  onAddToWeek?: (recipe: Recipe) => void;
  isInWeek?: boolean;
}

const RecipeCard = ({ recipe, matchPercentage, onClick, onAddToWeek, isInWeek }: RecipeCardProps) => {
  const totalTime = recipe.total_time_minutes ||
    ((recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)) || null;

  const toTry = isRecipeToTry(recipe);

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-card rounded-lg shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden border border-border/30 animate-fade-in"
    >
      <div className="relative">
        {recipe.image_url ? (
          <div className="h-44 overflow-hidden">
            <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
        ) : (
          <div className="h-44 bg-accent flex items-center justify-center">
            <ChefHat className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}
        {toTry && (
          <span className="absolute top-2 left-2 bg-to-try text-to-try-foreground text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-elevated">
            <Bookmark className="w-3 h-3" /> To Try
          </span>
        )}
        {onAddToWeek && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToWeek(recipe); }}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-elevated ${
              isInWeek
                ? "bg-primary text-primary-foreground"
                : "bg-card/90 text-foreground hover:bg-primary hover:text-primary-foreground"
            }`}
            title={isInWeek ? "In your week" : "Add to Week"}
          >
            <CalendarPlus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        <h3 className="font-display text-lg tracking-tight text-foreground leading-tight group-hover:text-primary transition-colors">
          {recipe.title}
        </h3>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {totalTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {totalTime}m
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {recipe.servings}
            </span>
          )}
        </div>

        {matchPercentage !== undefined && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-kitchen-herb transition-all" style={{ width: `${matchPercentage}%` }} />
            </div>
            <span className="text-xs font-medium text-kitchen-herb">{matchPercentage}%</span>
          </div>
        )}

        {recipe.nutritional_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.nutritional_tags.filter(t => t.toLowerCase() !== "to-try").slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs font-medium">{tag}</Badge>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Added {format(new Date(recipe.created_at), "MMM d, yyyy")}
        </p>
      </div>
    </button>
  );
};

export default RecipeCard;
