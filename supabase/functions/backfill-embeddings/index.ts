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
      console.error("Embedding error:", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("Embedding generation failed:", e);
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

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch recipes without embeddings for this user
    const { data: recipes, error: fetchError } = await adminClient
      .from("recipes")
      .select("id, title, ingredients, instructions, nutritional_tags")
      .eq("user_id", user.id)
      .is("embedding", null)
      .limit(50); // process in batches to avoid timeouts

    if (fetchError) {
      return new Response(JSON.stringify({ error: "Failed to fetch recipes" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!recipes || recipes.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "All recipes already have embeddings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const recipe of recipes) {
      const ingredientNames = (recipe.ingredients as any[] || [])
        .map((i: any) => i.name || "")
        .filter(Boolean)
        .join(", ");
      const tags = (recipe.nutritional_tags || []).join(", ");
      const embeddingText = `${recipe.title}. Ingredients: ${ingredientNames}. ${recipe.instructions || ""}. Tags: ${tags}`;

      const embedding = await generateEmbedding(embeddingText);
      if (embedding) {
        const { error: updateError } = await adminClient
          .from("recipes")
          .update({ embedding: JSON.stringify(embedding) })
          .eq("id", recipe.id);

        if (updateError) {
          console.error(`Failed to update recipe ${recipe.id}:`, updateError);
          failed++;
        } else {
          processed++;
        }
      } else {
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return new Response(
      JSON.stringify({
        processed,
        failed,
        remaining: recipes.length - processed - failed,
        message: `Generated embeddings for ${processed} recipes${failed > 0 ? `, ${failed} failed` : ""}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("backfill-embeddings error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
