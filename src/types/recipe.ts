export interface Ingredient {
  name: string;
  amount?: string;
  unit?: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  source: string;
  source_url: string | null;
  ingredients: Ingredient[];
  instructions: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  servings: number | null;
  nutritional_tags: string[];
  image_url: string | null;
  reference_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export type RecipeInsert = Omit<Recipe, 'id' | 'created_at' | 'updated_at'>;
