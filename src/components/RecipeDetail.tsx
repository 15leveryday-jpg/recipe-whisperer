import { X, Clock, Users, ExternalLink, ChefHat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import type { Recipe } from "@/types/recipe";

interface RecipeDetailProps {
  recipe: Recipe;
  onClose: () => void;
}

const RecipeDetail = ({ recipe, onClose }: RecipeDetailProps) => {
  const totalTime = recipe.total_time_minutes || 
    ((recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)) || null;

  return (
    <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-card h-full overflow-y-auto shadow-float animate-slide-in">
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border z-10 p-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground">{recipe.title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-64 object-cover" />
        ) : (
          <div className="w-full h-48 bg-accent flex items-center justify-center">
            <ChefHat className="w-16 h-16 text-muted-foreground/30" />
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {totalTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> {totalTime} min
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" /> {recipe.servings} servings
              </span>
            )}
            {recipe.source_url && (
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" /> Source
              </a>
            )}
          </div>

          {/* Tags */}
          {recipe.nutritional_tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipe.nutritional_tags.map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          )}

          {/* Ingredients */}
          <div>
            <h3 className="font-display text-lg mb-3 text-foreground">Ingredients</h3>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span>
                    {ing.amount && <span className="font-medium">{ing.amount} </span>}
                    {ing.unit && <span className="text-muted-foreground">{ing.unit} </span>}
                    {ing.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Instructions */}
          <div>
            <h3 className="font-display text-lg mb-3 text-foreground">Instructions</h3>
            <div className="prose prose-sm max-w-none text-foreground/90">
              <ReactMarkdown>{recipe.instructions}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetail;
