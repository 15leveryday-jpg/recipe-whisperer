import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { X, Clock, Users, ExternalLink, ChefHat, Plus, Minus, ArrowLeftRight, Edit2, Save, Trash2, Image as ImageIcon, Link as LinkIcon, Flame, History } from "lucide-react";
import EditableIngredients from "@/components/EditableIngredients";
import ShoppableIngredientRow from "@/components/ShoppableIngredientRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ReactMarkdown from "react-markdown";
import confetti from "canvas-confetti";
import { format } from "date-fns";
import type { Recipe, Ingredient } from "@/types/recipe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useGroceryList } from "@/hooks/useGroceryList";

interface RecipeDetailProps {
  recipe: Recipe;
  onClose: () => void;
  onUpdate?: (id: string, updates: Partial<Recipe>) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
  allTags?: string[];
  onNext?: () => void;
  onPrev?: () => void;
}

// Unit conversion tables
const imperialToMetric: Record<string, { factor: number; to: string }> = {
  lb: { factor: 453.592, to: "g" }, lbs: { factor: 453.592, to: "g" },
  oz: { factor: 28.3495, to: "g" }, cup: { factor: 236.588, to: "ml" },
  cups: { factor: 236.588, to: "ml" }, tbsp: { factor: 14.787, to: "ml" },
  tsp: { factor: 4.929, to: "ml" }, "fl oz": { factor: 29.574, to: "ml" },
  quart: { factor: 946.353, to: "ml" }, pint: { factor: 473.176, to: "ml" },
  gallon: { factor: 3785.41, to: "ml" },
};
const metricToImperial: Record<string, { factor: number; to: string }> = {
  g: { factor: 0.035274, to: "oz" }, kg: { factor: 2.20462, to: "lb" },
  ml: { factor: 0.033814, to: "fl oz" }, l: { factor: 0.264172, to: "gallon" },
};

// Terms to ignore when matching ingredients to instructions
const IGNORED_TERMS = new Set([
  "vegetables", "mixture", "ingredients", "sauce", "oil", "water", "salt",
  "pepper", "heat", "medium", "large", "small", "cup", "tablespoon",
  "teaspoon", "ounce", "cloves", "minutes", "degrees", "pinch", "dash",
  "slice", "piece", "bunch", "cooking", "fresh", "dried", "ground",
  "chopped", "diced", "minced", "sliced", "optional", "garnish", "and",
]);

function scaleAmount(amount: string | undefined, multiplier: number): string {
  if (!amount) return "";
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  const scaled = num * multiplier;
  return scaled % 1 === 0 ? String(scaled) : scaled.toFixed(2).replace(/\.?0+$/, "");
}

function convertUnit(amount: string | undefined, unit: string | undefined, toMetric: boolean) {
  if (!amount || !unit) return { amount: amount || "", unit: unit || "" };
  const num = parseFloat(amount);
  if (isNaN(num)) return { amount, unit };
  const table = toMetric ? imperialToMetric : metricToImperial;
  const conv = table[unit.toLowerCase()];
  if (!conv) return { amount, unit };
  const converted = num * conv.factor;
  return {
    amount: converted >= 100 ? Math.round(converted).toString() : converted.toFixed(1).replace(/\.0$/, ""),
    unit: conv.to,
  };
}

function isIngredientHeader(ing: Ingredient): boolean {
  if (ing.is_header) return true;
  const name = ing.name.trim();
  if (name.startsWith("**") && name.endsWith("**")) return true;
  if (name.endsWith(":")) return true;
  if (!ing.amount && !ing.unit && /^[A-Z\s&,]{2,}$/.test(name)) return true;
  return false;
}

function headerDisplayText(name: string): string {
  return name.replace(/^\*\*|\*\*$/g, "").replace(/:$/, "").trim();
}

/** Split instructions into paragraphs/steps for mapping */
function splitIntoSteps(markdown: string): string[] {
  return markdown.split(/\n\n+|\n(?=\d+\.\s)|\n(?=-\s)/).filter((s) => s.trim());
}

/** Build a map: stepIndex → Set of ingredient indices that appear in that step */
function buildStepIngredientMap(
  steps: string[],
  ingredients: Ingredient[]
): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Pre-compute patterns: full name + individual significant words
  const ingredientPatterns: { idx: number; patterns: RegExp[] }[] = [];

  ingredients.forEach((ing, idx) => {
    if (isIngredientHeader(ing)) return;
    const name = ing.name.trim().toLowerCase();
    if (name.length < 3 || IGNORED_TERMS.has(name)) return;

    const patterns: RegExp[] = [];

    // Full name match
    try { patterns.push(new RegExp(`\\b${esc(name)}\\b`, "i")); } catch {}

    // Also match individual words (3+ chars, not ignored)
    // Strip commas and common prep descriptors before splitting
    const cleaned = name.replace(/,/g, " ");
    const words = cleaned.split(/\s+/).filter(
      (w) => w.length >= 3 && !IGNORED_TERMS.has(w.toLowerCase())
    );
    for (const word of words) {
      try { patterns.push(new RegExp(`\\b${esc(word)}\\b`, "i")); } catch {}
    }

    if (patterns.length > 0) {
      ingredientPatterns.push({ idx, patterns });
    }
  });

  steps.forEach((step, stepIdx) => {
    const matches = new Set<number>();
    for (const { idx, patterns } of ingredientPatterns) {
      if (patterns.some((p) => p.test(step))) {
        matches.add(idx);
      }
    }
    if (matches.size > 0) {
      map.set(stepIdx, matches);
    }
  });

  return map;
}

/** LinkedInstructions — paragraph-level hover highlighting */
const LinkedInstructions = ({
  markdown,
  ingredientNames,
  hoveredStepIndex,
  onHoverStep,
  stepIngredientMap,
}: {
  markdown: string;
  ingredientNames: string[];
  hoveredStepIndex: number | null;
  onHoverStep: (index: number | null) => void;
  stepIngredientMap: Map<number, Set<number>>;
}) => {
  // Build highlight words: include full names + individual significant words
  const highlightWords = useMemo(() => {
    const words = new Set<string>();
    for (const name of ingredientNames) {
      const n = name.trim();
      if (n.length >= 3 && !IGNORED_TERMS.has(n.toLowerCase())) words.add(n);
      const cleaned = n.replace(/,/g, " ");
      for (const w of cleaned.split(/\s+/)) {
        if (w.length >= 3 && !IGNORED_TERMS.has(w.toLowerCase())) words.add(w);
      }
    }
    return [...words];
  }, [ingredientNames]);

  const pattern = useMemo(() => {
    if (highlightWords.length === 0) return null;
    // Sort by length descending so longer phrases match first
    const sorted = [...highlightWords].sort((a, b) => b.length - a.length);
    const escaped = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  }, [highlightWords]);

  // Track paragraph index across ReactMarkdown renders
  const stepCounterRef = useRef(0);

  // Reset counter on each render
  stepCounterRef.current = 0;

  const renderTextWithHighlights = useCallback(
    (text: string, isActiveStep: boolean) => {
      if (!pattern) return text;
      const parts = text.split(pattern);
      return parts.map((part, i) => {
        const matchedName = highlightWords.find((n) => n.toLowerCase() === part.toLowerCase());
        if (matchedName) {
          return (
            <span
              key={i}
              className={`transition-all duration-300 ${
                isActiveStep
                  ? "underline decoration-primary/60 decoration-2 bg-kitchen-herb-light/50 rounded px-0.5"
                  : ""
              }`}
            >
              {part}
            </span>
          );
        }
        return part;
      });
    },
    [pattern, highlightWords]
  );

  const createBlockRenderer = (Tag: "p" | "li") => {
    const BlockRenderer = ({ children }: { children?: React.ReactNode }) => {
      const currentStep = stepCounterRef.current++;
      const isActive = hoveredStepIndex === currentStep;
      const hasMatches = stepIngredientMap.has(currentStep);

      return (
        <Tag
          onMouseEnter={hasMatches ? () => onHoverStep(currentStep) : undefined}
          onMouseLeave={hasMatches ? () => onHoverStep(null) : undefined}
          className={`transition-all duration-300 rounded-lg px-2 py-1 -mx-2 ${
            isActive ? "bg-muted/40" : hasMatches ? "cursor-default" : ""
          }`}
        >
          {typeof children === "string"
            ? renderTextWithHighlights(children, isActive)
            : Array.isArray(children)
            ? children.map((child, i) =>
                typeof child === "string" ? <span key={i}>{renderTextWithHighlights(child, isActive)}</span> : child
              )
            : children}
        </Tag>
      );
    };
    BlockRenderer.displayName = `Block${Tag}`;
    return BlockRenderer;
  };

  const components = useMemo(() => ({
    p: createBlockRenderer("p"),
    li: createBlockRenderer("li"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [hoveredStepIndex, renderTextWithHighlights, stepIngredientMap]);

  return (
    <div className="prose prose-sm prose-neutral max-w-none text-foreground/90">
      <ReactMarkdown components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

const RecipeDetail = ({ recipe, onClose, onUpdate, onDelete, allTags = [], onNext, onPrev }: RecipeDetailProps) => {
  const [servingsMultiplier, setServingsMultiplier] = useState(1);
  const [useMetric, setUseMetric] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(recipe.title);
  const [editInstructions, setEditInstructions] = useState(recipe.instructions);
  const [editIngredients, setEditIngredients] = useState<Ingredient[]>(recipe.ingredients);
  const [editTags, setEditTags] = useState(recipe.nutritional_tags.join(", "));
  const [editNotes, setEditNotes] = useState(recipe.notes || "");
  const [editImageUrl, setEditImageUrl] = useState(recipe.image_url || "");
  const [editSourceUrl, setEditSourceUrl] = useState(recipe.source_url || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null);
  const [localCookCount, setLocalCookCount] = useState(recipe.cook_count || 0);
  const [cookLogs, setCookLogs] = useState<{ id: string; cooked_at: string }[]>([]);
  const [cookingInProgress, setCookingInProgress] = useState(false);

  // Tag suggestion dropdown
  const [tagInputFocused, setTagInputFocused] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const currentPartial = editTags.split(",").pop()?.trim().toLowerCase() || "";
  const existingInEdit = editTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const tagSuggestions = allTags.filter(
    (t) => t.toLowerCase().includes(currentPartial) && !existingInEdit.includes(t.toLowerCase())
  );

  const selectTagSuggestion = (tag: string) => {
    const parts = editTags.split(",").map((t) => t.trim()).filter(Boolean);
    parts.pop();
    parts.push(tag);
    setEditTags(parts.join(", ") + ", ");
    tagInputRef.current?.focus();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) { e.preventDefault(); onPrev(); }
      if (e.key === "ArrowRight" && onNext) { e.preventDefault(); onNext(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNext, onPrev]);

  useEffect(() => {
    setEditTitle(recipe.title);
    setEditInstructions(recipe.instructions);
    setEditIngredients(recipe.ingredients);
    setEditTags(recipe.nutritional_tags.join(", "));
    setEditNotes(recipe.notes || "");
    setEditImageUrl(recipe.image_url || "");
    setEditSourceUrl(recipe.source_url || "");
    setLocalCookCount(recipe.cook_count || 0);
  }, [recipe]);

  // Fetch cook logs
  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from("recipe_logs")
        .select("id, cooked_at")
        .eq("recipe_id", recipe.id)
        .order("cooked_at", { ascending: false });
      setCookLogs((data as any) || []);
    };
    fetchLogs();
  }, [recipe.id, localCookCount]);

  const markAsCooked = async () => {
    if (cookingInProgress) return;
    setCookingInProgress(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Optimistic update
      const newCount = localCookCount + 1;
      setLocalCookCount(newCount);

      // Insert log
      const { error: logErr } = await supabase
        .from("recipe_logs")
        .insert({ recipe_id: recipe.id, user_id: user.id } as any);
      if (logErr) throw logErr;

      // Update cook_count
      const { error: updateErr } = await supabase
        .from("recipes")
        .update({ cook_count: newCount } as any)
        .eq("id", recipe.id);
      if (updateErr) throw updateErr;

      // Update parent state
      onUpdate?.(recipe.id, { cook_count: newCount } as any);

      // Confetti!
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["hsl(142, 76%, 36%)", "hsl(45, 93%, 47%)", "hsl(0, 84%, 60%)"],
      });
      toast.success(`Cooked ${newCount} time${newCount > 1 ? "s" : ""}! 🎉`);
    } catch {
      setLocalCookCount((c) => c - 1);
      toast.error("Failed to log cook");
    } finally {
      setCookingInProgress(false);
    }
  };

  const totalTime = recipe.total_time_minutes || ((recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)) || null;
  const currentServings = recipe.servings ? Math.round(recipe.servings * servingsMultiplier) : null;

  const scaledIngredients = useMemo(() => {
    return recipe.ingredients.map((ing) => {
      let { amount, unit } = { amount: scaleAmount(ing.amount, servingsMultiplier), unit: ing.unit || "" };
      if (useMetric) { const conv = convertUnit(amount, unit, true); amount = conv.amount; unit = conv.unit; }
      return { ...ing, amount, unit };
    });
  }, [recipe.ingredients, servingsMultiplier, useMetric]);

  const ingredientNames = useMemo(
    () => recipe.ingredients.filter((ing) => !isIngredientHeader(ing)).map((ing) => ing.name),
    [recipe.ingredients]
  );

  // Pre-compute step→ingredient mapping
  const instructionSteps = useMemo(() => splitIntoSteps(recipe.instructions), [recipe.instructions]);
  const stepIngredientMap = useMemo(
    () => buildStepIngredientMap(instructionSteps, recipe.ingredients),
    [instructionSteps, recipe.ingredients]
  );

  // Which ingredient indices are highlighted by the current hovered step
  const highlightedIngredients = useMemo(() => {
    if (hoveredStepIndex === null) return new Set<number>();
    return stepIngredientMap.get(hoveredStepIndex) || new Set<number>();
  }, [hoveredStepIndex, stepIngredientMap]);

  const handleSave = async () => {
    if (!onUpdate) return;
    setSaving(true);
    const updates: Partial<Recipe> = {
      title: editTitle,
      instructions: editInstructions,
      ingredients: editIngredients as any,
      nutritional_tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: editNotes,
      image_url: editImageUrl.trim() || null,
      source_url: editSourceUrl.trim() || null,
    };
    const success = await onUpdate(recipe.id, updates);
    setSaving(false);
    if (success) setEditing(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm("Delete this recipe permanently?")) return;
    await onDelete(recipe.id);
    onClose();
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || !onUpdate) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let lastUrl = "";
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("recipe-images").upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
        lastUrl = urlData.publicUrl;
      }
      await onUpdate(recipe.id, { image_url: lastUrl });
      setEditImageUrl(lastUrl);
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-4xl bg-card rounded-xl max-h-[90vh] overflow-y-auto shadow-float animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border z-10 p-4 flex items-center justify-between gap-2 rounded-t-xl">
          {editing ? (
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-lg font-display bg-background" />
          ) : (
            <h2 className="font-display text-2xl tracking-tight text-foreground">{recipe.title}</h2>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {onUpdate && !editing && (
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
            {editing && (
              <>
                <Button variant="ghost" size="icon" onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Image */}
        <div className="relative">
          {recipe.image_url ? (
            <img src={recipe.image_url} alt={recipe.title} className="w-full h-64 object-cover" />
          ) : (
            <div className="w-full h-48 bg-accent flex items-center justify-center">
              <ChefHat className="w-16 h-16 text-muted-foreground/30" />
            </div>
          )}
          {editing && (
            <div className="absolute bottom-3 right-3 flex gap-2">
              {recipe.image_url && (
                <Button variant="destructive" size="sm" className="text-xs" onClick={() => onUpdate?.(recipe.id, { image_url: null })}>
                  <Trash2 className="w-3 h-3 mr-1" /> Remove
                </Button>
              )}
              <label className="bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 cursor-pointer text-sm font-medium flex items-center gap-2 border border-border hover:bg-accent transition-colors">
                <ImageIcon className="w-4 h-4" />
                {uploading ? "Uploading..." : "Upload Image"}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(e.target.files)} />
              </label>
            </div>
          )}
        </div>

        {/* Image URL & Source URL fields in edit mode */}
        {editing && (
          <div className="px-6 pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="Image URL (paste a link to an image)"
                className="bg-background text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                value={editSourceUrl}
                onChange={(e) => setEditSourceUrl(e.target.value)}
                placeholder="Source URL (original recipe link)"
                className="bg-background text-sm"
              />
            </div>
          </div>
        )}

        {/* Reference image link */}
        {recipe.reference_image_url && (
          <div className="px-6 pt-3">
            <a href={recipe.reference_image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> View original reference image
            </a>
          </div>
        )}

        {/* Meta bar + Mark as Cooked */}
        <div className="px-6 pt-4 pb-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {totalTime && (
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {totalTime} min</span>
          )}
          {recipe.source_url && !editing && (
            <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
              <ExternalLink className="w-4 h-4" /> Source
            </a>
          )}
          <div className="ml-auto flex items-center gap-2">
            {localCookCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                <Flame className="w-4 h-4" /> {localCookCount}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={markAsCooked}
              disabled={cookingInProgress}
              className="gap-1.5 text-xs"
            >
              <ChefHat className="w-3.5 h-3.5" /> Mark as Cooked
            </Button>
          </div>
        </div>

        {/* Servings & unit controls */}
        <div className="px-6 py-3 flex flex-wrap items-center gap-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setServingsMultiplier((m) => Math.max(0.5, m - 0.5))}>
              <Minus className="w-3 h-3" />
            </Button>
            <span className="text-sm font-medium w-16 text-center">{currentServings ?? "–"} srv</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setServingsMultiplier((m) => m + 0.5)}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Imperial</span>
            <Switch checked={useMetric} onCheckedChange={setUseMetric} />
            <span className="text-muted-foreground">Metric</span>
            <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* Tags */}
        {editing ? (
          <div className="px-6 pt-4 relative">
            <Input
              ref={tagInputRef}
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              onFocus={() => setTagInputFocused(true)}
              onBlur={() => setTimeout(() => setTagInputFocused(false), 200)}
              placeholder="Tags (comma separated)"
              className="bg-background text-sm"
            />
            {tagInputFocused && currentPartial && tagSuggestions.length > 0 && (
              <div className="absolute left-6 right-6 top-full mt-1 bg-card border border-border rounded-lg shadow-elevated z-20 max-h-32 overflow-y-auto">
                {tagSuggestions.slice(0, 6).map((tag) => (
                  <button
                    key={tag}
                    onMouseDown={() => selectTagSuggestion(tag)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : recipe.nutritional_tags.length > 0 ? (
          <div className="px-6 pt-4 flex flex-wrap gap-2">
            {recipe.nutritional_tags.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
        ) : null}

        {/* Two-column Kitchen Mode */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Ingredients (sticky) */}
          <div className="md:sticky md:top-0 md:self-start md:max-h-[80vh] md:overflow-y-auto scrollbar-hide">
            <h3 className="font-display text-lg tracking-tight mb-3 text-foreground">Ingredients</h3>
            {editing ? (
              <EditableIngredients
                ingredients={editIngredients}
                onChange={setEditIngredients}
              />
            ) : (
              <ul className="space-y-1">
                {scaledIngredients.map((ing, i) => {
                  const isHeader = isIngredientHeader(ing);
                  if (isHeader) {
                    return (
                      <li key={i} className="font-display text-sm font-semibold mt-4 first:mt-0 border-b border-border/40 pb-1 text-foreground">
                        {headerDisplayText(ing.name)}
                      </li>
                    );
                  }
                  const isHighlighted = highlightedIngredients.has(i);
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-2.5 text-sm py-1 px-2 rounded transition-all duration-300 origin-left ${
                        isHighlighted
                          ? "bg-kitchen-herb-light scale-[1.03] border-l-4 border-kitchen-herb"
                          : "border-l-4 border-transparent"
                      }`}
                    >
                      <Checkbox
                        checked={checkedIngredients.has(i)}
                        onCheckedChange={(checked) => {
                          const next = new Set(checkedIngredients);
                          checked ? next.add(i) : next.delete(i);
                          setCheckedIngredients(next);
                        }}
                      />
                      <span className={checkedIngredients.has(i) ? "line-through text-muted-foreground" : ""}>
                        {ing.amount && <span className="font-medium">{ing.amount} </span>}
                        {ing.unit && <span className="text-muted-foreground">{ing.unit} </span>}
                        {ing.name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Right: Instructions */}
          <div>
            <h3 className="font-display text-lg tracking-tight mb-3 text-foreground">Instructions</h3>
            {editing ? (
              <Textarea value={editInstructions} onChange={(e) => setEditInstructions(e.target.value)} className="min-h-[300px] bg-background text-sm" />
            ) : (
              <LinkedInstructions
                markdown={recipe.instructions}
                ingredientNames={ingredientNames}
                hoveredStepIndex={hoveredStepIndex}
                onHoverStep={setHoveredStepIndex}
                stepIngredientMap={stepIngredientMap}
              />
            )}
          </div>
        </div>

        {/* Notes Section */}
        {editing ? (
          <div className="px-6 pb-4">
            <h3 className="font-display text-lg tracking-tight mb-2 text-foreground">Notes</h3>
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Add personal notes, tips, or modifications..."
              className="min-h-[100px] bg-background text-sm"
            />
          </div>
        ) : recipe.notes ? (
          <div className="px-6 pb-4">
            <h3 className="font-display text-lg tracking-tight mb-2 text-foreground">Notes</h3>
            <div className="prose prose-sm prose-neutral max-w-none text-foreground/90 bg-muted/50 rounded-lg p-4">
              <ReactMarkdown>{recipe.notes}</ReactMarkdown>
            </div>
          </div>
        ) : null}

        {/* Cook History */}
        {cookLogs.length > 0 && !editing && (
          <div className="px-6 pb-4">
            <h3 className="font-display text-lg tracking-tight mb-2 text-foreground flex items-center gap-2">
              <History className="w-4 h-4" /> Cook History
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {cookLogs.map((log, i) => (
                <div key={log.id} className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                  <span className="w-5 text-center font-medium text-foreground/60">#{cookLogs.length - i}</span>
                  <span>{format(new Date(log.cooked_at), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete button */}
        {onDelete && (
          <div className="px-6 pb-6 pt-2">
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Recipe
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeDetail;
