
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create recipes table
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'Manual',
  source_url TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT NOT NULL DEFAULT '',
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  total_time_minutes INTEGER,
  servings INTEGER,
  nutritional_tags TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  embedding extensions.vector(768),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own recipes" ON public.recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own recipes" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recipes" ON public.recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recipes" ON public.recipes FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on embedding for vector search
CREATE INDEX ON public.recipes USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- Create index on nutritional_tags for filtering
CREATE INDEX idx_recipes_nutritional_tags ON public.recipes USING GIN(nutritional_tags);

-- Create match_recipes function for vector search
CREATE OR REPLACE FUNCTION public.match_recipes(
  query_embedding extensions.vector(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 20,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  source TEXT,
  source_url TEXT,
  ingredients JSONB,
  instructions TEXT,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  total_time_minutes INTEGER,
  servings INTEGER,
  nutritional_tags TEXT[],
  image_url TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.title,
    r.source,
    r.source_url,
    r.ingredients,
    r.instructions,
    r.prep_time_minutes,
    r.cook_time_minutes,
    r.total_time_minutes,
    r.servings,
    r.nutritional_tags,
    r.image_url,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM public.recipes r
  WHERE 1 - (r.embedding <=> query_embedding) > match_threshold
    AND (p_user_id IS NULL OR r.user_id = p_user_id)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
