import { Clock, Users, ChefHat, Bookmark, CalendarPlus, Flame } from "lucide-react";
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

function formatMatchedIng(ing: MatchedIngredient): string {
  const parts: string[] = [];
  if (ing.amount) parts.push(ing.amount);
  if (ing.unit) parts.push(ing.unit);
  parts.push(ing.name);
  return parts.join(" ");
}

function significanceStyle(sig: number): string {
  if (sig >= 6) return "bg-primary/20 text-primary border border-primary/30 font-semibold";
  if (sig >= 3) return "bg-primary/10 text-primary font-medium";
  return "bg-muted text-muted-foreground";
}

const RecipeCard = ({ recipe, matchPercentage, matchedIngredients, onClick, onAddToWeek, isInWeek }: RecipeCardProps) => {
  const totalTime = recipe.total_time_minutes ||
    ((recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)) || null;

  const toTry = isRecipeToTry(recipe);

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-card rounded-lg shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden border border-border/30 animate-fade-in flex flex-col"
    >
      {/* Image — fixed aspect ratio */}
      <div className="relative aspect-[4/3] overflow-hidden flex-shrink-0">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-accent flex items-center justify-center">
            <img src="/placeholder.svg" alt="Recipe placeholder" className="w-16 h-16 opacity-30" />
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
            className={`absolute top-2 right-2 min-w-[44px] min-h-[44px] w-11 h-11 sm:w-8 sm:h-8 sm:min-w-0 sm:min-h-0 rounded-full flex items-center justify-center transition-all shadow-elevated ${
              isInWeek
                ? "bg-primary text-primary-foreground"
                : "bg-card/90 text-foreground hover:bg-primary hover:text-primary-foreground"
            }`}
            title={isInWeek ? "In your week" : "Add to Week"}
          >
            <CalendarPlus className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        )}
      </div>

      {/* Content — flex-col with justify-between to pin footer */}
      <div className="p-4 flex flex-col flex-1 min-h-[180px]">
        {/* Top section */}
        <div className="space-y-2">
          {/* Title — max 2 lines */}
          <h3 className="font-display text-lg tracking-tight text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {recipe.title}
          </h3>

          {/* Metadata — fixed height to preserve alignment */}
          <div className="h-5 flex items-center gap-3 text-sm text-muted-foreground">
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
        </div>

        {/* Middle section — fixed height slots for search results */}
        <div className="mt-2 space-y-2 flex-shrink-0">
          {/* Match percentage bar — fixed height slot */}
          <div className="h-5">
            {matchPercentage !== undefined && matchPercentage > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-kitchen-herb transition-all" style={{ width: `${matchPercentage}%` }} />
                </div>
                <span className="text-xs font-medium text-kitchen-herb">
                  {matchPercentage >= 100 ? "Full Match" : `${matchPercentage}%`}
                </span>
              </div>
            )}
          </div>

          {/* Matched ingredients — removed from card view for cleaner layout */}
          <div className="h-7" />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer — always pinned to bottom */}
        <div className="space-y-2 mt-2">
          {recipe.nutritional_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.nutritional_tags.filter(t => t.toLowerCase() !== "to-try").slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs font-medium">{tag}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Added {format(new Date(recipe.created_at), "MMM d, yyyy")}
            </p>
            {recipe.cook_count > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                <Flame className="w-3.5 h-3.5" /> {recipe.cook_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

export default RecipeCard;
