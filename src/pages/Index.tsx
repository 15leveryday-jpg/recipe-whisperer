import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut, X, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRecipes } from "@/hooks/useRecipes";
import { useMealPlan } from "@/hooks/useMealPlan";
import { useGroceryList } from "@/hooks/useGroceryList";
import AuthForm from "@/components/AuthForm";
import RecipeCard from "@/components/RecipeCard";
import RecipeDetail from "@/components/RecipeDetail";
import ImportModal from "@/components/ImportModal";
import SearchBar from "@/components/SearchBar";
import FacetedFilters from "@/components/FacetedFilters";
import MealPlanDock from "@/components/MealPlanDock";
import MealPlanDrawer from "@/components/MealPlanDrawer";
import type { Recipe } from "@/types/recipe";

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const {
    recipes,
    allRecipes,
    loading,
    searchLoading,
    searchResults,
    hybridSearch,
    clearSearch,
    fetchRecipes,
    selectedFacets,
    toggleFacet,
    toTryActive,
    setToTryActive,
    clearAllFacets,
    allTags,
    updateRecipe,
    deleteRecipe,
  } = useRecipes(user?.id);

  const { meals, addMeal, removeMeal, reorderMeals, clearMeals, drawerOpen, setDrawerOpen } = useMealPlan(user?.id);
  const { unboughtCount } = useGroceryList(user?.id);
  const mealIds = new Set(meals.map((m) => m.id));

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
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl tracking-tight text-foreground">Recipe Vault</h1>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="ghost" size="icon" className="relative min-h-[44px] min-w-[44px]" onClick={() => navigate("/shopping")}>
              <ShoppingBag className="w-5 h-5" />
              {unboughtCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unboughtCount > 99 ? "99+" : unboughtCount}
                </span>
              )}
            </Button>
            <Button onClick={() => setShowImport(true)} className="gap-1.5 sm:gap-2 min-h-[44px]">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Import</span><span className="sm:hidden">Add</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="min-h-[44px] min-w-[44px]">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        <SearchBar onSearch={hybridSearch} loading={searchLoading} />

        {/* Faceted Filters */}
        <FacetedFilters
          allRecipes={allRecipes}
          selectedFacets={selectedFacets}
          onToggleFacet={toggleFacet}
          onClearAll={clearAllFacets}
          toTryActive={toTryActive}
          onToggleToTry={() => setToTryActive((v) => !v)}
        />

        {searchResults && (
          <button
            onClick={clearSearch}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear search
          </button>
        )}

        {loading || searchLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="font-display text-xl sm:text-2xl text-foreground">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                matchPercentage={(recipe as any).matchPercentage}
                onClick={() => setSelectedRecipe(recipe)}
                onAddToWeek={addMeal}
                isInWeek={mealIds.has(recipe.id)}
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
          onNext={() => {
            const idx = recipes.findIndex((r) => r.id === selectedRecipe.id);
            if (idx < recipes.length - 1) setSelectedRecipe(recipes[idx + 1]);
          }}
          onPrev={() => {
            const idx = recipes.findIndex((r) => r.id === selectedRecipe.id);
            if (idx > 0) setSelectedRecipe(recipes[idx - 1]);
          }}
        />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImported={fetchRecipes} />
      )}
      <MealPlanDock meals={meals} onExpand={() => setDrawerOpen(true)} onRemove={removeMeal} onReorder={reorderMeals} />
      <MealPlanDrawer
        meals={meals}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRemove={removeMeal}
        onClear={clearMeals}
        onOpenRecipe={(r) => { setDrawerOpen(false); setSelectedRecipe(r); }}
      />
    </div>
  );
};

export default Index;
