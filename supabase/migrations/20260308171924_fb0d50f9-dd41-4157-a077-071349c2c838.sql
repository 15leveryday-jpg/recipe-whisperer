
-- Stores table (user-defined stores)
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stores"
  ON public.stores FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stores"
  ON public.stores FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stores"
  ON public.stores FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stores"
  ON public.stores FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Grocery items table
CREATE TABLE public.grocery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  quantity text,
  category text,
  is_bought boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grocery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own grocery items"
  ON public.grocery_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own grocery items"
  ON public.grocery_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own grocery items"
  ON public.grocery_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own grocery items"
  ON public.grocery_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Join table: item <-> store availability
CREATE TABLE public.item_store_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.grocery_items(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  UNIQUE (item_id, store_id)
);

ALTER TABLE public.item_store_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own item availability"
  ON public.item_store_availability FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.grocery_items gi WHERE gi.id = item_id AND gi.user_id = auth.uid()));

CREATE POLICY "Users can insert their own item availability"
  ON public.item_store_availability FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.grocery_items gi WHERE gi.id = item_id AND gi.user_id = auth.uid()));

CREATE POLICY "Users can delete their own item availability"
  ON public.item_store_availability FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.grocery_items gi WHERE gi.id = item_id AND gi.user_id = auth.uid()));
