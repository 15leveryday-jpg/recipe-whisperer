import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { X, Clock, Users, ExternalLink, ChefHat, Plus, Minus, ArrowLeftRight, Edit2, Save, Trash2, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ReactMarkdown from "react-markdown";
import type { Recipe, Ingredient } from "@/types/recipe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RecipeDetailProps {
  recipe: Recipe;
  onClose: () => void;
  onUpdate?: (id: string, updates: Partial<Recipe>) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
  allTags?: string[];
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

/** Detect if an ingredient line is a section header */
function isIngredientHeader(ing: Ingredient): boolean {
  const name = ing.name.trim();
  // Wrapped in **double asterisks**
  if (name.startsWith("**") && name.endsWith("**")) return true;
  // Ends with colon
  if (name.endsWith(":")) return true;
  // ALL CAPS with no amount/unit (at least 2 chars, only letters/spaces/&/,)
  if (!ing.amount && !ing.unit && /^[A-Z\s&,]{2,}$/.test(name)) return true;
  return false;
}

/** Clean header display text */
function headerDisplayText(name: string): string {
  return name.replace(/^\*\*|\*\*$/g, "").replace(/:$/, "").trim();
}

/** Linked Instructions component — highlights ingredient names on hover */
const LinkedInstructions = ({
  markdown,
  ingredientNames,
  hoveredIngredient,
  onHoverIngredient,
}: {
  markdown: string;
  ingredientNames: string[];
  hoveredIngredient: string | null;
  onHoverIngredient: (name: string | null) => void;
}) => {
  // Build a regex that matches any ingredient name at word boundaries (min 3 chars to avoid noise)
  const validNames = ingredientNames.filter((n) => n.length >= 3);
  const pattern = useMemo(() => {
    if (validNames.length === 0) return null;
    const escaped = validNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  }, [validNames]);

  const renderTextWithLinks = useCallback(
    (text: string) => {
      if (!pattern) return text;
      const parts = text.split(pattern);
      return parts.map((part, i) => {
        const matchedName = validNames.find((n) => n.toLowerCase() === part.toLowerCase());
        if (matchedName) {
          return (
            <span
              key={i}
              className={`cursor-default transition-all duration-150 ${
                hoveredIngredient?.toLowerCase() === matchedName.toLowerCase()
                  ? "underline decoration-primary/60 decoration-2 bg-kitchen-herb-light/50 rounded px-0.5"
                  : "hover:underline hover:decoration-primary/40"
              }`}
              onMouseEnter={() => onHoverIngredient(matchedName)}
              onMouseLeave={() => onHoverIngredient(null)}
            >
              {part}
            </span>
          );
        }
        return part;
      });
    },
    [pattern, validNames, hoveredIngredient, onHoverIngredient]
  );

  return (
    <div className="prose prose-sm prose-neutral max-w-none text-foreground/90">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p>
              {typeof children === "string"
                ? renderTextWithLinks(children)
                : Array.isArray(children)
                ? children.map((child, i) =>
                    typeof child === "string" ? <span key={i}>{renderTextWithLinks(child)}</span> : child
                  )
                : children}
            </p>
          ),
          li: ({ children }) => (
            <li>
              {typeof children === "string"
                ? renderTextWithLinks(children)
                : Array.isArray(children)
                ? children.map((child, i) =>
                    typeof child === "string" ? <span key={i}>{renderTextWithLinks(child)}</span> : child
                  )
                : children}
            </li>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

const RecipeDetail = ({ recipe, onClose, onUpdate, onDelete, allTags = [] }: RecipeDetailProps) => {
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
  const [hoveredIngredient, setHoveredIngredient] = useState<string | null>(null);

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

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Sync recipe prop changes
  useEffect(() => {
    setEditTitle(recipe.title);
    setEditInstructions(recipe.instructions);
    setEditIngredients(recipe.ingredients);
    setEditTags(recipe.nutritional_tags.join(", "));
    setEditNotes(recipe.notes || "");
    setEditImageUrl(recipe.image_url || "");
    setEditSourceUrl(recipe.source_url || "");
  }, [recipe]);

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
    <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-3xl bg-card h-full overflow-y-auto shadow-float animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border z-10 p-4 flex items-center justify-between gap-2">
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

        {/* Meta bar */}
        <div className="px-6 pt-4 pb-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {totalTime && (
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {totalTime} min</span>
          )}
          {recipe.source_url && !editing && (
            <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
              <ExternalLink className="w-4 h-4" /> Source
            </a>
          )}
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
          {/* Left: Ingredients */}
          <div>
            <h3 className="font-display text-lg tracking-tight mb-3 text-foreground">Ingredients</h3>
            {editing ? (
              <div className="space-y-2">
                {editIngredients.map((ing, i) => (
                  <div key={i} className="flex gap-1">
                    <Input value={ing.amount || ""} onChange={(e) => { const arr = [...editIngredients]; arr[i] = { ...arr[i], amount: e.target.value }; setEditIngredients(arr); }} placeholder="Amt" className="w-16 bg-background text-sm" />
                    <Input value={ing.unit || ""} onChange={(e) => { const arr = [...editIngredients]; arr[i] = { ...arr[i], unit: e.target.value }; setEditIngredients(arr); }} placeholder="Unit" className="w-16 bg-background text-sm" />
                    <Input value={ing.name} onChange={(e) => { const arr = [...editIngredients]; arr[i] = { ...arr[i], name: e.target.value }; setEditIngredients(arr); }} placeholder="Name" className="flex-1 bg-background text-sm" />
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setEditIngredients(editIngredients.filter((_, j) => j !== i))}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setEditIngredients([...editIngredients, { name: "" }])}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
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
                  const isHovered = hoveredIngredient?.toLowerCase() === ing.name.toLowerCase();
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-2.5 text-sm py-0.5 px-1 rounded transition-colors duration-150 ${
                        isHovered ? "bg-kitchen-herb-light" : ""
                      }`}
                      onMouseEnter={() => setHoveredIngredient(ing.name)}
                      onMouseLeave={() => setHoveredIngredient(null)}
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
                hoveredIngredient={hoveredIngredient}
                onHoverIngredient={setHoveredIngredient}
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
