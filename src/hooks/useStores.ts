import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Store } from "@/types/grocery";

const PRESET_COLORS = [
  "#E76F51", "#2A9D8F", "#264653", "#E9C46A", "#F4A261",
  "#6D6875", "#B5838D", "#457B9D", "#1D3557", "#A8DADC",
];

export function useStores(userId: string | undefined) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) { setStores([]); return; }
    setLoading(true);
    supabase
      .from("stores")
      .select("*")
      .eq("user_id", userId)
      .order("created_at")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setStores((data as Store[]) ?? []);
        setLoading(false);
      });
  }, [userId]);

  const addStore = useCallback(async (name: string) => {
    if (!userId || !name.trim()) return null;
    const color = PRESET_COLORS[stores.length % PRESET_COLORS.length];
    const optimistic: Store = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: name.trim(),
      color,
      created_at: new Date().toISOString(),
    };
    setStores((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("stores")
      .insert({ user_id: userId, name: name.trim(), color })
      .select()
      .single();

    if (error) {
      setStores((prev) => prev.filter((s) => s.id !== optimistic.id));
      toast.error("Failed to create store");
      return null;
    }
    setStores((prev) => prev.map((s) => (s.id === optimistic.id ? (data as Store) : s)));
    return data as Store;
  }, [userId, stores.length]);

  const deleteStore = useCallback(async (id: string) => {
    if (!userId) return;
    const backup = stores;
    setStores((prev) => prev.filter((s) => s.id !== id));
    const { error } = await supabase.from("stores").delete().eq("id", id);
    if (error) {
      setStores(backup);
      toast.error("Failed to delete store");
    }
  }, [userId, stores]);

  return { stores, loading, addStore, deleteStore };
}
