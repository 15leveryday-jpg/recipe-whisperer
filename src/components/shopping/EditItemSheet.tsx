import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import type { GroceryItem, Store } from "@/types/grocery";

const CATEGORY_ORDER = [
  "Produce", "Dairy", "Meat & Seafood", "Bakery", "Frozen",
  "Pantry", "Beverages", "Snacks", "Other",
];

interface Props {
  item: GroceryItem | null;
  stores: Store[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: { name?: string; quantity?: string | null; category?: string | null; store_ids?: string[] }) => Promise<void>;
}

export function EditItemSheet({ item, stores, open, onOpenChange, onSave }: Props) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState("");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQty(item.quantity || "");
      setCategory(item.category || "");
      setStoreIds(item.store_ids || []);
    }
  }, [item]);

  const toggleStore = (id: string) =>
    setStoreIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!item || !name.trim()) return;
    setSaving(true);
    await onSave(item.id, {
      name: name.trim(),
      quantity: qty.trim() || null,
      category: category || null,
      store_ids: storeIds,
    });
    setSaving(false);
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">Edit Item</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4 pb-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity</label>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 2 lbs" className="h-11" />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_ORDER.map((cat) => (
                <Badge
                  key={cat}
                  variant={category === cat ? "default" : "outline"}
                  className="cursor-pointer text-xs transition-colors"
                  onClick={() => setCategory(category === cat ? "" : cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          </div>

          {/* Stores */}
          {stores.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stores</label>
              <div className="space-y-1">
                {stores.map((store) => (
                  <label
                    key={store.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={storeIds.includes(store.id)}
                      onCheckedChange={() => toggleStore(store.id)}
                    />
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: store.color }} />
                    <span className="text-sm">{store.name}</span>
                  </label>
                ))}
              </div>
              {storeIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {storeIds.map((sid) => {
                    const store = stores.find((s) => s.id === sid);
                    if (!store) return null;
                    return (
                      <Badge key={sid} variant="secondary" className="text-[10px] gap-1 cursor-pointer h-5" onClick={() => toggleStore(sid)}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: store.color }} />
                        {store.name}
                        <X className="w-2.5 h-2.5" />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <Button onClick={handleSave} disabled={!name.trim() || saving} className="w-full h-11">
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
