import { useState } from "react";
import { Plus, ChevronDown, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import type { Store } from "@/types/grocery";

const CATEGORY_ORDER = [
  "Produce", "Dairy", "Meat & Seafood", "Bakery", "Frozen",
  "Pantry", "Beverages", "Snacks", "Other",
];

interface Props {
  stores: Store[];
  onAdd: (name: string, qty?: string, category?: string, storeIds?: string[]) => Promise<void>;
}

export function AddItemBar({ stores, onAdd }: Props) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState("");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [showStores, setShowStores] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onAdd(name, qty || undefined, category || undefined, storeIds.length > 0 ? storeIds : undefined);
    setName("");
    setQty("");
    setCategory("");
    setStoreIds([]);
  };

  const toggleStore = (id: string) =>
    setStoreIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 pb-[env(safe-area-inset-bottom)] pt-2">
      <div className="max-w-7xl mx-auto space-y-2">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add an item..."
            className="flex-1 h-11"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qty"
            className="w-16 h-11 text-center"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <Button onClick={handleSubmit} disabled={!name.trim()} size="icon" className="h-11 w-11 shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-1.5 flex-wrap pb-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-[11px] h-6 px-2">
                <ChevronDown className="w-2.5 h-2.5" />
                {category || "Category"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1.5" align="start">
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {stores.length > 0 && (
            <Popover open={showStores} onOpenChange={setShowStores}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-[11px] h-6 px-2">
                  <Tag className="w-2.5 h-2.5" />
                  {storeIds.length > 0 ? `${storeIds.length} store${storeIds.length > 1 ? "s" : ""}` : "Stores"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1.5" align="start">
                {stores.map((store) => (
                  <label
                    key={store.id}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={storeIds.includes(store.id)}
                      onCheckedChange={() => toggleStore(store.id)}
                    />
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: store.color }} />
                    <span className="text-xs">{store.name}</span>
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          )}

          {storeIds.map((sid) => {
            const store = stores.find((s) => s.id === sid);
            if (!store) return null;
            return (
              <Badge key={sid} variant="secondary" className="text-[10px] gap-0.5 cursor-pointer h-5" onClick={() => toggleStore(sid)}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: store.color }} />
                {store.name}
                <X className="w-2 h-2" />
              </Badge>
            );
          })}
        </div>
      </div>
    </div>
  );
}
