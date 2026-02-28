import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `You are a recipe parser. Given raw messy text (from Google Docs, YouTube transcripts, blog posts, etc.), extract a structured recipe.

You MUST call the extract_recipe function with the extracted data. Be thorough:
- Extract ALL ingredients, even if buried in paragraphs. Include amount and unit when available.
- Convert instructions into clear numbered steps in Markdown format (use 1. 2. 3. etc).
- Infer nutritional tags like: High Protein, Vegan, Vegetarian, Gluten-Free, Low Carb, Keto, Dairy-Free, Quick Meal.
- Estimate prep_time_minutes, cook_time_minutes, total_time_minutes if mentioned or inferable.
- Estimate servings if mentioned.`;

const VISION_PROMPT = `You are a recipe extractor. Analyze this image of a recipe (could be a screenshot from Instagram, a photo of a cookbook, a recipe card, etc.) and extract the recipe.

You MUST call the extract_recipe function with the extracted data. Be thorough with ingredients and instructions. Use numbered steps (1. 2. 3.) for instructions.`;

const tools = [
  {
    type: "function",
    function: {
      name: "extract_recipe",
      description: "Extract structured recipe data from text or image",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Recipe title" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                amount: { type: "string" },
                unit: { type: "string" },
              },
              required: ["name"],
            },
          },
          instructions: { type: "string", description: "Markdown formatted numbered steps" },
          prep_time_minutes: { type: "number" },
          cook_time_minutes: { type: "number" },
          total_time_minutes: { type: "number" },
          servings: { type: "number" },
          nutritional_tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["title", "ingredients", "instructions", "nutritional_tags"],
      },
    },
  },
];

// Try to extract OG image from a URL
async function extractOgImage(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
    if (!resp.ok) return null;
    const html = await resp.text();
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    return ogMatch?.[1] || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { type, text, url, image, reference_image_url } = await req.json();

    let messages: any[] = [];

    if (type === "scan_image" && image) {
      messages = [
        { role: "system", content: VISION_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image } },
            { type: "text", text: "Extract the recipe from this image." },
          ],
        },
      ];
    } else {
      const content = text || "";
      const sourceInfo = url ? `\nSource URL: ${url}` : "";
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Parse this recipe:${sourceInfo}\n\n${content}` },
      ];
    }

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: type === "scan_image" ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview",
        messages,
        tools,
        tool_choice: { type: "function", function: { name: "extract_recipe" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI could not parse the recipe" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipe = JSON.parse(toolCall.function.arguments);

    // Try to get OG image from URL
    let imageUrl: string | null = null;
    if (url) {
      imageUrl = await extractOgImage(url);
    }

    // Generate embedding
    const embeddingText = `${recipe.title}. Ingredients: ${recipe.ingredients.map((i: any) => i.name).join(", ")}. ${recipe.instructions}. Tags: ${recipe.nutritional_tags.join(", ")}`;

    const embResponse = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: embeddingText,
        dimensions: 768,
      }),
    });

    let embedding = null;
    if (embResponse.ok) {
      const embData = await embResponse.json();
      embedding = embData.data?.[0]?.embedding;
    }

    // Save to database
    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { error: insertError } = await adminClient.from("recipes").insert({
      user_id: user.id,
      title: recipe.title,
      source: url ? "URL" : type === "scan_image" ? "Scan" : "Manual",
      source_url: url || null,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prep_time_minutes: recipe.prep_time_minutes || null,
      cook_time_minutes: recipe.cook_time_minutes || null,
      total_time_minutes: recipe.total_time_minutes || null,
      servings: recipe.servings || null,
      nutritional_tags: recipe.nutritional_tags || [],
      image_url: imageUrl,
      reference_image_url: reference_image_url || null,
      embedding: embedding ? JSON.stringify(embedding) : null,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save recipe" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, recipe }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-recipe error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
