import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GroceryItem } from "@/types/grocery";

export function useGroceryList(userId: string | undefined) {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!userId) { setItems([]); return; }
    setLoading(true);
    const { data: groceryData, error: gErr } = await supabase
      .from("grocery_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at");

    if (gErr) { console.error(gErr); setLoading(false); return; }

    const { data: availData, error: aErr } = await supabase
      .from("item_store_availability")
      .select("item_id, store_id");

    if (aErr) console.error(aErr);

    const storeMap = new Map<string, string[]>();
    (availData ?? []).forEach((row: any) => {
      const arr = storeMap.get(row.item_id) ?? [];
      arr.push(row.store_id);
      storeMap.set(row.item_id, arr);
    });

    const mapped: GroceryItem[] = (groceryData ?? []).map((item: any) => ({
      ...item,
      store_ids: storeMap.get(item.id) ?? [],
    }));

    setItems(mapped);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = useCallback(async (
    name: string,
    quantity?: string,
    category?: string,
    storeIds?: string[],
    recipeSource?: string
  ) => {
    if (!userId || !name.trim()) return;

    const { data, error } = await supabase
      .from("grocery_items")
      .insert({
        user_id: userId,
        name: name.trim(),
        quantity: quantity || null,
        category: category || null,
        recipe_source: recipeSource || null,
      })
      .select()
      .single();

    if (error || !data) {
      toast.error("Failed to add item");
      return;
    }

    if (storeIds && storeIds.length > 0) {
      await supabase
        .from("item_store_availability")
        .insert(storeIds.map((sid) => ({ item_id: (data as any).id, store_id: sid })));
    }

    setItems((prev) => [...prev, { ...(data as any), store_ids: storeIds ?? [] }]);
  }, [userId]);

  const toggleBought = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newVal = !item.is_bought;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_bought: newVal } : i)));

    const { error } = await supabase
      .from("grocery_items")
      .update({ is_bought: newVal })
      .eq("id", id);

    if (error) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_bought: !newVal } : i)));
      toast.error("Failed to update item");
    }
  }, [items]);

  const toggleFavorite = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newVal = !item.is_favorite;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_favorite: newVal } : i)));

    const { error } = await supabase
      .from("grocery_items")
      .update({ is_favorite: newVal })
      .eq("id", id);

    if (error) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_favorite: !newVal } : i)));
      toast.error("Failed to update item");
    }
  }, [items]);

  const removeItem = useCallback(async (id: string) => {
    const backup = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    const { error } = await supabase.from("grocery_items").delete().eq("id", id);
    if (error) {
      setItems(backup);
      toast.error("Failed to remove item");
    }
  }, [items]);

  const clearBought = useCallback(async () => {
    if (!userId) return;
    const boughtIds = items.filter((i) => i.is_bought).map((i) => i.id);
    if (boughtIds.length === 0) return;
    const backup = items;
    setItems((prev) => prev.filter((i) => !i.is_bought));
    const { error } = await supabase
      .from("grocery_items")
      .delete()
      .in("id", boughtIds);
    if (error) {
      setItems(backup);
      toast.error("Failed to clear bought items");
    }
  }, [userId, items]);

  const updateItemStores = useCallback(async (itemId: string, storeIds: string[]) => {
    await supabase.from("item_store_availability").delete().eq("item_id", itemId);
    if (storeIds.length > 0) {
      await supabase
        .from("item_store_availability")
        .insert(storeIds.map((sid) => ({ item_id: itemId, store_id: sid })));
    }
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, store_ids: storeIds } : i)));
  }, []);

  const updateItem = useCallback(async (
    id: string,
    updates: { name?: string; quantity?: string | null; category?: string | null; store_ids?: string[] }
  ) => {
    const { store_ids, ...dbUpdates } = updates;
    const backup = items.find((i) => i.id === id);
    if (!backup) return;

    // Optimistic update
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));

    // Update DB fields
    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabase.from("grocery_items").update(dbUpdates).eq("id", id);
      if (error) {
        setItems((prev) => prev.map((i) => (i.id === id ? backup : i)));
        toast.error("Failed to update item");
        return;
      }
    }

    // Update store assignments if changed
    if (store_ids !== undefined) {
      await supabase.from("item_store_availability").delete().eq("item_id", id);
      if (store_ids.length > 0) {
        await supabase
          .from("item_store_availability")
          .insert(store_ids.map((sid) => ({ item_id: id, store_id: sid })));
      }
    }
  }, [items]);

  const addBulkItems = useCallback(async (
    itemsToAdd: { name: string; quantity?: string; category?: string; recipeSource?: string }[]
  ) => {
    if (!userId || itemsToAdd.length === 0) return;

    const rows = itemsToAdd.map((item) => ({
      user_id: userId,
      name: item.name,
      quantity: item.quantity || null,
      category: item.category || null,
      recipe_source: item.recipeSource || null,
    }));

    const { data, error } = await supabase
      .from("grocery_items")
      .insert(rows)
      .select();

    if (error) {
      toast.error("Failed to add items");
      return;
    }

    const newItems: GroceryItem[] = (data ?? []).map((d: any) => ({
      ...d,
      store_ids: [],
    }));

    setItems((prev) => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} items to shopping list`);
  }, [userId]);

  const unboughtCount = items.filter((i) => !i.is_bought).length;

  return {
    items,
    loading,
    addItem,
    toggleBought,
    toggleFavorite,
    removeItem,
    clearBought,
    updateItemStores,
    addBulkItems,
    fetchItems,
    unboughtCount,
  };
}
