import { Clock, Users, ChefHat, Bookmark, CalendarPlus, Flame, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { isRecipeToTry } from "@/components/FacetedFilters";
import type { Recipe } from "@/types/recipe";
import type { MatchedIngredient } from "@/hooks/useRecipes";

interface RecipeCardProps {
  recipe: Recipe;
  matchPercentage?: number;
  matchedIngredients?: MatchedIngredient[];
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
      className="group w-full text-left bg-card rounded-lg shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden border border-border/30 animate-fade-in flex flex-col relative"
    >
      {/* Overlay icons — positioned on the card root so they're always top-right */}
      {toTry && (
        <span className="absolute top-1.5 left-1.5 z-20 bg-to-try text-to-try-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-elevated">
          <Bookmark className="w-2.5 h-2.5" /> To Try
        </span>
      )}
      {onAddToWeek && (
        <button
          onClick={(e) => { e.stopPropagation(); onAddToWeek(recipe); }}
          className={`absolute top-1.5 right-1.5 z-20 min-w-[36px] min-h-[36px] w-9 h-9 sm:w-7 sm:h-7 sm:min-w-0 sm:min-h-0 rounded-full flex items-center justify-center transition-all shadow-elevated ${
            isInWeek
              ? "bg-primary text-primary-foreground"
              : "bg-card/90 text-foreground hover:bg-primary hover:text-primary-foreground"
          }`}
          title={isInWeek ? "In your week" : "Add to Week"}
        >
          <CalendarPlus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </button>
      )}

      {/* Image — fixed square aspect ratio, always renders */}
      <div className="aspect-square overflow-hidden flex-shrink-0 bg-accent">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Content — compact spacing for smaller cards */}
      <div className="p-3 flex flex-col flex-1 min-h-[140px]">
        {/* Title — exactly 2 lines max */}
        <h3 className="font-display text-sm sm:text-base tracking-tight text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2 min-h-[40px]">
          {recipe.title}
        </h3>

        {/* Metadata row — fixed height */}
        <div className="h-5 flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
          {totalTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {totalTime}m
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {recipe.servings}
            </span>
          )}
        </div>

        {/* Match percentage bar — fixed height slot */}
        <div className="h-5 flex items-center mt-1.5">
          {matchPercentage !== undefined && matchPercentage > 0 && (
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-kitchen-herb transition-all" style={{ width: `${matchPercentage}%` }} />
              </div>
              <span className="text-[10px] font-medium text-kitchen-herb whitespace-nowrap">
                {matchPercentage >= 100 ? "Full" : `${matchPercentage}%`}
              </span>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer — pinned to bottom */}
        <div className="space-y-1.5 mt-2">
          {recipe.nutritional_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipe.nutritional_tags.filter(t => t.toLowerCase() !== "to-try").slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] font-medium px-1.5 py-0">{tag}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(recipe.created_at), "MMM d, yyyy")}
            </p>
            {recipe.cook_count > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary">
                <Flame className="w-3 h-3" /> {recipe.cook_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

export default RecipeCard;
