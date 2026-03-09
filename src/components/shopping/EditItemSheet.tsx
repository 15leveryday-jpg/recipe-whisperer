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
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-display text-lg">Edit Item</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 pb-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1 w-24">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Qty</label>
              <Input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 2 lbs" className="h-9" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Category</label>
            <div className="flex flex-wrap gap-1">
              {CATEGORY_ORDER.map((cat) => (
                <Badge
                  key={cat}
                  variant={category === cat ? "default" : "outline"}
                  className="cursor-pointer text-[11px] transition-colors h-6"
                  onClick={() => setCategory(category === cat ? "" : cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          </div>

          {stores.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Stores</label>
              <div className="flex flex-wrap gap-1.5">
                {stores.map((store) => (
                  <label
                    key={store.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer transition-colors text-xs border ${
                      storeIds.includes(store.id) ? "bg-accent border-primary/30" : "border-border hover:bg-accent/50"
                    }`}
                    onClick={() => toggleStore(store.id)}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: store.color }} />
                    {store.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={!name.trim() || saving} className="w-full h-10 mt-1">
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
