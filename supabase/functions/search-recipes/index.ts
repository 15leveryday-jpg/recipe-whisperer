import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
        dimensions: 768,
      }),
    });
    if (!resp.ok) {
      console.error("Embedding API error:", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("Embedding generation failed:", e);
    return null;
  }
}

/** Keyword-based fallback search with dietary exclusions */
function keywordSearch(recipes: any[], query: string) {
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

  return recipes
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
}

/** AI-powered re-ranking for natural language queries */
async function aiRerank(recipes: any[], query: string): Promise<any[] | null> {
  if (!LOVABLE_API_KEY || recipes.length === 0) return null;

  // Send condensed recipe list to AI for ranking
  const recipeList = recipes.slice(0, 100).map((r: any, i: number) => {
    const tags = (r.nutritional_tags || []).join(", ");
    const ingredients = (r.ingredients || []).slice(0, 8).map((ing: any) => ing.name).join(", ");
    return `[${i}] "${r.title}" — tags: ${tags} — ingredients: ${ingredients}`;
  }).join("\n");

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a recipe search ranking assistant. Given a user's search query and a numbered list of recipes, return the indices of the most relevant recipes ranked by relevance. Consider flavor profiles, cooking styles, mood, occasion, and ingredient compatibility. Return ONLY the indices as a JSON array, most relevant first. Return at most 20 results. If none are relevant, return an empty array.`,
          },
          {
            role: "user",
            content: `Query: "${query}"\n\nRecipes:\n${recipeList}`,
          },
        ],
        temperature: 0,
      }),
    });

    if (!resp.ok) {
      console.error("AI rerank error:", resp.status);
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    // Extract JSON array from response
    const match = content.match(/\[[\d,\s]*\]/);
    if (!match) return null;

    const indices: number[] = JSON.parse(match[0]);
    const slicedRecipes = recipes.slice(0, 100);
    return indices
      .filter((i) => i >= 0 && i < slicedRecipes.length)
      .map((i, rank) => ({
        ...slicedRecipes[i],
        similarity: 1 - rank * 0.03, // descending score for display
      }));
  } catch (e) {
    console.error("AI rerank failed:", e);
    return null;
  }
}

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
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (type === "semantic") {
      // Step 1: Try vector similarity search via embeddings
      const queryEmbedding = await generateEmbedding(query);
      
      let vectorResults: any[] = [];
      if (queryEmbedding) {
        const { data: matchData, error: matchError } = await adminClient.rpc("match_recipes", {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: 0.3,
          match_count: 30,
          p_user_id: user.id,
        });

        if (!matchError && matchData && matchData.length > 0) {
          vectorResults = matchData.map((r: any) => ({
            ...r,
            similarity: r.similarity,
          }));
        }
      }

      // Step 2: Fetch all recipes for keyword fallback and AI re-ranking
      const { data: allRecipes, error: fetchError } = await adminClient
        .from("recipes")
        .select("*")
        .eq("user_id", user.id);

      if (fetchError) {
        return new Response(JSON.stringify({ error: "Failed to fetch recipes" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 3: If we got good vector results, use them; otherwise fall back
      let results: any[];

      if (vectorResults.length >= 3) {
        // Good vector results — enrich with full recipe data
        const recipeMap = new Map((allRecipes || []).map((r: any) => [r.id, r]));
        results = vectorResults
          .map((vr) => {
            const full = recipeMap.get(vr.id);
            return full ? { ...full, similarity: vr.similarity } : null;
          })
          .filter(Boolean);
      } else {
        // Fallback: AI re-ranking on full collection
        const aiResults = await aiRerank(allRecipes || [], query);
        if (aiResults && aiResults.length > 0) {
          results = aiResults;
        } else {
          // Final fallback: keyword search
          results = keywordSearch(allRecipes || [], query);
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "pantry") {
      // Pantry search: match by ingredients
      const ingredientList = ingredients
        .split(",")
        .map((i: string) => i.trim().toLowerCase())
        .filter(Boolean);

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
