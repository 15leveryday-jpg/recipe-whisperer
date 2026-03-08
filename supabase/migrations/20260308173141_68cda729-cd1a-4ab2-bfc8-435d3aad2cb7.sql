ALTER TABLE public.meal_plans ADD COLUMN position integer NOT NULL DEFAULT 0;

CREATE POLICY "Users can update their own meal plans"
  ON public.meal_plans FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
