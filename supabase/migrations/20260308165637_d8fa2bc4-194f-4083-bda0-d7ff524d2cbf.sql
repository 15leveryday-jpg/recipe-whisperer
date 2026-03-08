
-- Add cook_count to recipes
ALTER TABLE public.recipes ADD COLUMN cook_count integer NOT NULL DEFAULT 0;

-- Create recipe_logs table
CREATE TABLE public.recipe_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cooked_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own logs" ON public.recipe_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs" ON public.recipe_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs" ON public.recipe_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
