export interface Store {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface GroceryItem {
  id: string;
  user_id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  is_bought: boolean;
  is_favorite: boolean;
  recipe_source: string | null;
  created_at: string;
  store_ids: string[]; // derived from item_store_availability
}
