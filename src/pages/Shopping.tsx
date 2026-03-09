import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, X, Trash2, Check, ShoppingCart, Loader2, Store as StoreIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useStores } from "@/hooks/useStores";
import { useGroceryList } from "@/hooks/useGroceryList";
import { useMealPlan } from "@/hooks/useMealPlan";
import AuthForm from "@/components/AuthForm";
import { SwipeableGroceryItem } from "@/components/shopping/SwipeableGroceryItem";
import { AddItemBar } from "@/components/shopping/AddItemBar";
import { EditItemSheet } from "@/components/shopping/EditItemSheet";
import type { GroceryItem, Store } from "@/types/grocery";

const CATEGORY_ORDER = [
  "Produce", "Dairy", "Meat & Seafood", "Bakery", "Frozen",
  "Pantry", "Beverages", "Snacks", "Other",
];

interface StoreGroup {
  store: Store | null; // null = "Any Store"
  categories: Map<string, GroceryItem[]>;
}

export default function Shopping() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { stores, addStore, deleteStore } = useStores(user?.id);
  const {
    items, loading, addItem, toggleBought, toggleFavorite, removeItem, clearBought,
    updateItemStores, updateItem, addBulkItems, unboughtCount,
  } = useGroceryList(user?.id);
  const { meals } = useMealPlan(user?.id);

  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);

  const [newStoreName, setNewStoreName] = useState("");
  const [showNewStoreInput, setShowNewStoreInput] = useState(false);
  const [activeStoreFilter, setActiveStoreFilter] = useState<string | null>(null);

  // Group items: Store → Category
  const storeGroups = useMemo(() => {
    const groups = new Map<string, { store: Store | null; items: GroceryItem[] }>();

    // "Any Store" group for items with no store assignment
    groups.set("__any__", { store: null, items: [] });

    // Initialize store groups
    stores.forEach((s) => groups.set(s.id, { store: s, items: [] }));

    items.forEach((item) => {
      if (item.store_ids.length === 0) {
        groups.get("__any__")!.items.push(item);
      } else {
        item.store_ids.forEach((sid) => {
          const group = groups.get(sid);
          if (group) group.items.push(item);
        });
      }
    });

    // Convert to StoreGroup with category sub-grouping
    const result: StoreGroup[] = [];

    const buildCategoryMap = (groupItems: GroceryItem[]) => {
      const cats = new Map<string, GroceryItem[]>();
      groupItems.forEach((item) => {
        const cat = item.category || "Other";
        const arr = cats.get(cat) ?? [];
        arr.push(item);
        cats.set(cat, arr);
      });
      // Sort by CATEGORY_ORDER
      const sorted = new Map<string, GroceryItem[]>();
      CATEGORY_ORDER.forEach((cat) => {
        if (cats.has(cat)) { sorted.set(cat, cats.get(cat)!); cats.delete(cat); }
      });
      cats.forEach((val, key) => sorted.set(key, val));
      return sorted;
    };

    // Named stores first
    stores.forEach((s) => {
      const g = groups.get(s.id)!;
      if (g.items.length > 0) {
        result.push({ store: s, categories: buildCategoryMap(g.items) });
      }
    });

    // "Any Store" last
    const anyGroup = groups.get("__any__")!;
    if (anyGroup.items.length > 0) {
      result.push({ store: null, categories: buildCategoryMap(anyGroup.items) });
    }

    // Apply store filter
    if (activeStoreFilter) {
      return result.filter((g) =>
        g.store?.id === activeStoreFilter || (activeStoreFilter === "__any__" && !g.store)
      );
    }

    return result;
  }, [items, stores, activeStoreFilter]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <AuthForm />;

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return;
    await addStore(newStoreName);
    setNewStoreName("");
    setShowNewStoreInput(false);
  };

  const handleGenerateFromMealPlan = async () => {
    if (meals.length === 0) return;
    const allIngredients = meals.flatMap((recipe) =>
      recipe.ingredients
        .filter((ing) => !ing.is_header)
        .map((ing) => ({
          name: ing.name || [ing.amount, ing.unit, ing.name].filter(Boolean).join(" "),
          quantity: [ing.amount, ing.unit].filter(Boolean).join(" ") || undefined,
          recipeSource: recipe.title,
        }))
    );
    const seen = new Set<string>();
    const unique = allIngredients.filter((ing) => {
      const key = ing.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    await addBulkItems(unique);
  };

  const boughtCount = items.filter((i) => i.is_bought).length;
  const totalFiltered = storeGroups.reduce(
    (sum, g) => sum + [...g.categories.values()].reduce((s, arr) => s + arr.length, 0), 0
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="min-h-[44px] min-w-[44px]">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-xl sm:text-2xl tracking-tight text-foreground">Shopping List</h1>
              <p className="text-xs text-muted-foreground">
                {unboughtCount} item{unboughtCount !== 1 ? "s" : ""} remaining
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {meals.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleGenerateFromMealPlan} className="gap-1.5 min-h-[44px]">
                <ShoppingCart className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">From Meal Plan</span>
                <span className="sm:hidden">Plan</span>
              </Button>
            )}
            {boughtCount > 0 && (
              <Button variant="ghost" size="sm" className="text-destructive min-h-[44px]" onClick={clearBought}>
                <Trash2 className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Clear Bought</span>
              </Button>
            )}
          </div>
        </div>

        {/* Store Filter Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            <Button
              variant={activeStoreFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveStoreFilter(null)}
              className="shrink-0 h-8 text-xs"
            >
              All
            </Button>
            {stores.map((store) => (
              <Button
                key={store.id}
                variant={activeStoreFilter === store.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveStoreFilter(activeStoreFilter === store.id ? null : store.id)}
                className="shrink-0 gap-1.5 h-8 text-xs"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: store.color }} />
                {store.name}
              </Button>
            ))}
            {!showNewStoreInput ? (
              <Button variant="ghost" size="sm" onClick={() => setShowNewStoreInput(true)} className="shrink-0 text-muted-foreground h-8 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Store
              </Button>
            ) : (
              <div className="flex gap-1 shrink-0 items-center">
                <Input
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Store name"
                  className="w-28 h-7 text-xs"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleAddStore()}
                />
                <Button size="sm" variant="default" onClick={handleAddStore} className="h-7 px-2">
                  <Check className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowNewStoreInput(false); setNewStoreName(""); }} className="h-7 px-2">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : totalFiltered === 0 ? (
          <div className="text-center py-16 space-y-3">
            <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="font-display text-xl text-foreground">List is empty</p>
            <p className="text-muted-foreground text-sm">
              Add items below or generate from your meal plan.
            </p>
          </div>
        ) : (
          storeGroups.map((group, gi) => (
            <div key={group.store?.id ?? "__any__"} className="mb-2">
              {/* Sticky Store Header */}
              <div className="sticky top-[108px] z-20 bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  {group.store ? (
                    <>
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: group.store.color }}
                      />
                      <h2 className="font-display text-base font-semibold text-foreground tracking-tight">
                        {group.store.name}
                      </h2>
                    </>
                  ) : (
                    <>
                      <StoreIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <h2 className="font-display text-base font-semibold text-muted-foreground tracking-tight">
                        Any Store
                      </h2>
                    </>
                  )}
                  <span className="text-[11px] text-muted-foreground/60 ml-auto">
                    {[...group.categories.values()].reduce((s, a) => s + a.filter((i) => !i.is_bought).length, 0)} left
                  </span>
                </div>
              </div>

              {/* Category sub-groups */}
              {[...group.categories.entries()].map(([category, catItems]) => {
                const unbought = catItems.filter((i) => !i.is_bought);
                const bought = catItems.filter((i) => i.is_bought);
                return (
                  <div key={category} className="mt-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium px-1 mb-1">
                      {category}
                    </p>
                    <div className="space-y-0.5">
                      {unbought.map((item) => (
                        <SwipeableGroceryItem
                          key={item.id}
                          item={item}
                          onToggle={toggleBought}
                          onRemove={removeItem}
                          onFavorite={toggleFavorite}
                        />
                      ))}
                      {bought.map((item) => (
                        <SwipeableGroceryItem
                          key={item.id}
                          item={item}
                          onToggle={toggleBought}
                          onRemove={removeItem}
                          onFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </main>

      {/* Fixed Add Bar at bottom */}
      <AddItemBar stores={stores} onAdd={addItem} />
    </div>
  );
}
