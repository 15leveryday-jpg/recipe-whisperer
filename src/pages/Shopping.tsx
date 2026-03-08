import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Tag, X, Trash2, Check, Store as StoreIcon,
  ShoppingCart, Loader2, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { useStores } from "@/hooks/useStores";
import { useGroceryList } from "@/hooks/useGroceryList";
import { useMealPlan } from "@/hooks/useMealPlan";
import AuthForm from "@/components/AuthForm";
import type { GroceryItem, Store } from "@/types/grocery";

const CATEGORY_ORDER = [
  "Produce", "Dairy", "Meat & Seafood", "Bakery", "Frozen",
  "Pantry", "Beverages", "Snacks", "Other",
];

export default function Shopping() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { stores, addStore, deleteStore } = useStores(user?.id);
  const {
    items, loading, addItem, toggleBought, removeItem, clearBought,
    updateItemStores, addBulkItems,
  } = useGroceryList(user?.id);
  const { meals } = useMealPlan(user?.id);

  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemStores, setNewItemStores] = useState<string[]>([]);
  const [showTagPopover, setShowTagPopover] = useState(false);
  const [activeStoreFilter, setActiveStoreFilter] = useState<string | null>(null);
  const [newStoreName, setNewStoreName] = useState("");
  const [showNewStoreInput, setShowNewStoreInput] = useState(false);
  const [editingStoresItemId, setEditingStoresItemId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (!activeStoreFilter) return items;
    return items.filter(
      (i) => i.store_ids.length === 0 || i.store_ids.includes(activeStoreFilter)
    );
  }, [items, activeStoreFilter]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, GroceryItem[]>();
    items.forEach((item) => {
      if (activeStoreFilter && item.store_ids.length > 0 && !item.store_ids.includes(activeStoreFilter)) return;
      const cat = item.category || "Other";
      const arr = groups.get(cat) ?? [];
      arr.push(item);
      groups.set(cat, arr);
    });
    const sorted = new Map<string, GroceryItem[]>();
    CATEGORY_ORDER.forEach((cat) => {
      if (groups.has(cat)) {
        sorted.set(cat, groups.get(cat)!);
        groups.delete(cat);
      }
    });
    groups.forEach((val, key) => sorted.set(key, val));
    return sorted;
  }, [items, activeStoreFilter]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <AuthForm />;

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    await addItem(newItemName, newItemQty, newItemCategory || undefined, newItemStores);
    setNewItemName("");
    setNewItemQty("");
    setNewItemCategory("");
    setNewItemStores([]);
  };

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
        .map((ing) => {
          const parts = [ing.amount, ing.unit, ing.name].filter(Boolean).join(" ");
          return {
            name: ing.name || parts,
            quantity: [ing.amount, ing.unit].filter(Boolean).join(" ") || undefined,
          };
        })
    );
    // Deduplicate by lowercase name
    const seen = new Set<string>();
    const unique = allIngredients.filter((ing) => {
      const key = ing.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    await addBulkItems(unique);
  };

  const toggleStoreForNewItem = (storeId: string) => {
    setNewItemStores((prev) =>
      prev.includes(storeId) ? prev.filter((s) => s !== storeId) : [...prev, storeId]
    );
  };

  const getStoreById = (id: string) => stores.find((s) => s.id === id);

  const unboughtCount = filteredItems.filter((i) => !i.is_bought).length;
  const boughtCount = filteredItems.filter((i) => i.is_bought).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl tracking-tight text-foreground">Shopping List</h1>
              <p className="text-sm text-muted-foreground">
                {unboughtCount} item{unboughtCount !== 1 ? "s" : ""} remaining
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {meals.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleGenerateFromMealPlan} className="gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5" /> From Meal Plan
              </Button>
            )}
            {boughtCount > 0 && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={clearBought}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear Bought
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Store Filter Bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Button
            variant={activeStoreFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveStoreFilter(null)}
            className="shrink-0"
          >
            All
          </Button>
          {stores.map((store) => (
            <Button
              key={store.id}
              variant={activeStoreFilter === store.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveStoreFilter(
                activeStoreFilter === store.id ? null : store.id
              )}
              className="shrink-0 gap-1.5"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: store.color }}
              />
              {store.name}
            </Button>
          ))}
          {!showNewStoreInput ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewStoreInput(true)}
              className="shrink-0 text-muted-foreground"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Store
            </Button>
          ) : (
            <div className="flex gap-1 shrink-0">
              <Input
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                placeholder="Store name"
                className="w-32 h-8 text-sm"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddStore()}
              />
              <Button size="sm" variant="default" onClick={handleAddStore} className="h-8 px-2">
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowNewStoreInput(false); setNewStoreName(""); }} className="h-8 px-2">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Quick Add */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Add an item..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
            <Input
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              placeholder="Qty"
              className="w-20"
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
            <Button onClick={handleAddItem} disabled={!newItemName.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Category & store tags row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
                  <ChevronDown className="w-3 h-3" />
                  {newItemCategory || "Category"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-2" align="start">
                {CATEGORY_ORDER.map((cat) => (
                  <button
                    key={cat}
                    className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors"
                    onClick={() => setNewItemCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {stores.length > 0 && (
              <Popover open={showTagPopover} onOpenChange={setShowTagPopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
                    <Tag className="w-3 h-3" />
                    {newItemStores.length > 0 ? `${newItemStores.length} store${newItemStores.length > 1 ? "s" : ""}` : "Stores"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  {stores.map((store) => (
                    <label
                      key={store.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={newItemStores.includes(store.id)}
                        onCheckedChange={() => toggleStoreForNewItem(store.id)}
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: store.color }}
                      />
                      <span className="text-sm">{store.name}</span>
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
            )}

            {newItemStores.map((sid) => {
              const store = getStoreById(sid);
              if (!store) return null;
              return (
                <Badge
                  key={sid}
                  variant="secondary"
                  className="text-xs gap-1 cursor-pointer"
                  onClick={() => toggleStoreForNewItem(sid)}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: store.color }} />
                  {store.name}
                  <X className="w-2.5 h-2.5" />
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Items list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="font-display text-xl text-foreground">List is empty</p>
            <p className="text-muted-foreground text-sm">
              Add items manually or generate from your meal plan.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {[...groupedItems.entries()].map(([category, catItems]) => {
              const unbought = catItems.filter((i) => !i.is_bought);
              const bought = catItems.filter((i) => i.is_bought);

              return (
                <div key={category}>
                  <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-2">
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {unbought.map((item) => (
                      <GroceryItemRow
                        key={item.id}
                        item={item}
                        stores={stores}
                        onToggle={toggleBought}
                        onRemove={removeItem}
                        onEditStores={(id) => setEditingStoresItemId(
                          editingStoresItemId === id ? null : id
                        )}
                        isEditingStores={editingStoresItemId === item.id}
                        onUpdateStores={updateItemStores}
                      />
                    ))}
                    {bought.map((item) => (
                      <GroceryItemRow
                        key={item.id}
                        item={item}
                        stores={stores}
                        onToggle={toggleBought}
                        onRemove={removeItem}
                        onEditStores={(id) => setEditingStoresItemId(
                          editingStoresItemId === id ? null : id
                        )}
                        isEditingStores={editingStoresItemId === item.id}
                        onUpdateStores={updateItemStores}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function GroceryItemRow({
  item,
  stores,
  onToggle,
  onRemove,
  onEditStores,
  isEditingStores,
  onUpdateStores,
}: {
  item: GroceryItem;
  stores: Store[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onEditStores: (id: string) => void;
  isEditingStores: boolean;
  onUpdateStores: (id: string, storeIds: string[]) => void;
}) {
  return (
    <div className="group">
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
          item.is_bought
            ? "bg-muted/50 opacity-60"
            : "bg-card hover:bg-accent/30"
        }`}
      >
        <Checkbox
          checked={item.is_bought}
          onCheckedChange={() => onToggle(item.id)}
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <span className={`text-sm ${item.is_bought ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {item.name}
          </span>
          {item.quantity && (
            <span className="text-xs text-muted-foreground ml-2">({item.quantity})</span>
          )}
          {/* Store dots */}
          {item.store_ids.length > 0 && (
            <span className="inline-flex gap-1 ml-2">
              {item.store_ids.map((sid) => {
                const s = stores.find((st) => st.id === sid);
                return s ? (
                  <span
                    key={sid}
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: s.color }}
                    title={s.name}
                  />
                ) : null;
              })}
            </span>
          )}
          {item.store_ids.length === 0 && (
            <span className="text-xs text-muted-foreground/60 ml-2 italic">any store</span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {stores.length > 0 && (
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => onEditStores(item.id)}
            >
              <Tag className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost" size="icon" className="h-7 w-7 text-destructive"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {/* Inline store editor */}
      {isEditingStores && (
        <div className="flex flex-wrap gap-1.5 px-10 py-2">
          {stores.map((store) => {
            const active = item.store_ids.includes(store.id);
            return (
              <Badge
                key={store.id}
                variant={active ? "default" : "outline"}
                className="cursor-pointer text-xs gap-1"
                onClick={() => {
                  const newIds = active
                    ? item.store_ids.filter((s) => s !== store.id)
                    : [...item.store_ids, store.id];
                  onUpdateStores(item.id, newIds);
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: store.color }} />
                {store.name}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
