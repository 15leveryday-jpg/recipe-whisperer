import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader! } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, query, ingredients } = await req.json();

    if (type === "semantic") {
      const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: recipes, error: fetchError } = await adminClient
        .from("recipes")
        .select("*")
        .eq("user_id", user.id);

      if (fetchError) {
        return new Response(JSON.stringify({ error: "Failed to fetch recipes" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(Boolean);

      const dietaryExclusions: Record<string, string[]> = {
        vegetarian: ["meat", "pork", "chicken", "beef", "lamb", "sausage", "bacon", "turkey", "duck", "ham", "veal"],
        vegan: ["meat", "pork", "chicken", "beef", "lamb", "egg", "dairy", "milk", "cheese", "butter", "cream", "honey", "sausage", "bacon"],
        pescatarian: ["meat", "pork", "chicken", "beef", "lamb", "sausage", "bacon", "turkey", "duck"],
      };

      let excludeIngredients: string[] = [];
      for (const [diet, exclusions] of Object.entries(dietaryExclusions)) {
        if (queryLower.includes(diet)) {
          excludeIngredients = exclusions;
          break;
        }
      }

      const results = (recipes || [])
        .map((r: any) => {
          const title = (r.title || "").toLowerCase();
          const tags = (r.nutritional_tags || []).map((t: string) => t.toLowerCase());
          const ingredientNames = (r.ingredients || []).map((i: any) => (i.name || "").toLowerCase());
          const allText = `${title} ${tags.join(" ")} ${ingredientNames.join(" ")}`;

          if (excludeIngredients.length > 0) {
            const hasExcluded = ingredientNames.some((name: string) =>
              excludeIngredients.some((ex) => name.includes(ex))
            );
            if (hasExcluded) return null;
          }

          let score = 0;
          for (const word of queryWords) {
            if (allText.includes(word)) score++;
            if (tags.some((t: string) => t.includes(word))) score += 2;
            if (title.includes(word)) score += 2;
          }

          if (score === 0) return null;
          return { ...r, similarity: score / (queryWords.length * 5) };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.similarity - a.similarity);

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (type === "pantry") {
      // Pantry search: match by ingredients
      const ingredientList = ingredients
        .split(",")
        .map((i: string) => i.trim().toLowerCase())
        .filter(Boolean);

      const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: recipes, error } = await adminClient
        .from("recipes")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch recipes" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = (recipes || [])
        .map((r: any) => {
          const recipeIngredients = (r.ingredients || []).map((i: any) =>
            (i.name || "").toLowerCase()
          );
          const matched = ingredientList.filter((search: string) =>
            recipeIngredients.some((ri: string) => ri.includes(search) || search.includes(ri))
          );
          const matchPercentage = recipeIngredients.length > 0
            ? Math.round((matched.length / recipeIngredients.length) * 100)
            : 0;
          return { ...r, matchPercentage };
        })
        .filter((r: any) => r.matchPercentage > 0)
        .sort((a: any, b: any) => b.matchPercentage - a.matchPercentage);

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid search type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-recipes error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
