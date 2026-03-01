import { useState } from "react";
import { Plus, LogOut, X, Loader2, Zap, Flame, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useRecipes } from "@/hooks/useRecipes";
import AuthForm from "@/components/AuthForm";
import RecipeCard from "@/components/RecipeCard";
import RecipeDetail from "@/components/RecipeDetail";
import ImportModal from "@/components/ImportModal";
import SearchBar from "@/components/SearchBar";
import type { Recipe } from "@/types/recipe";

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const {
    recipes,
    loading,
    searchLoading,
    searchResults,
    hybridSearch,
    clearSearch,
    fetchRecipes,
    highProtein, setHighProtein,
    quickMeal, setQuickMeal,
    toTryOnly, setToTryOnly,
    activeTag, setActiveTag,
    allTags,
    updateRecipe,
    deleteRecipe,
  } = useRecipes(user?.id);

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showImport, setShowImport] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthForm />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-display text-2xl text-foreground">Recipe Vault</h1>
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowImport(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Import
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <SearchBar onSearch={hybridSearch} loading={searchLoading} />

        {/* Tag Cloud */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={activeTag === tag ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={highProtein} onCheckedChange={setHighProtein} />
            <Flame className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">High Protein</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={quickMeal} onCheckedChange={setQuickMeal} />
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">Quick Meal</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={toTryOnly} onCheckedChange={setToTryOnly} />
            <Bookmark className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">To Try</span>
          </label>

          {searchResults && (
            <button
              onClick={clearSearch}
              className="ml-auto flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear search
            </button>
          )}
        </div>

        {loading || searchLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="font-display text-2xl text-foreground">
              {searchResults ? "No recipes match" : "Your vault is empty"}
            </p>
            <p className="text-muted-foreground">
              {searchResults ? "Try a different search or adjust filters." : "Import your first recipe to get started."}
            </p>
            {!searchResults && (
              <Button onClick={() => setShowImport(true)} variant="outline" className="mt-4 gap-2">
                <Plus className="w-4 h-4" /> Import Recipe
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                matchPercentage={(recipe as any).matchPercentage}
                onClick={() => setSelectedRecipe(recipe)}
              />
            ))}
          </div>
        )}
      </main>

      {selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onUpdate={async (id, updates) => {
            const ok = await updateRecipe(id, updates);
            if (ok) setSelectedRecipe((prev) => prev ? { ...prev, ...updates } : null);
            return ok;
          }}
          onDelete={deleteRecipe}
          allTags={allTags}
        />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImported={fetchRecipes} />
      )}
    </div>
  );
};

export default Index;
