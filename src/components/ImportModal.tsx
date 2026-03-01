import { useState, useEffect } from "react";
import { X, Loader2, Camera, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

const ImportModal = ({ onClose, onImported }: ImportModalProps) => {
  const [mode, setMode] = useState<"smart" | "scan">("smart");
  const [smartInput, setSmartInput] = useState("");
  const [isToTry, setIsToTry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isUrl = (text: string) => /^https?:\/\//i.test(text.trim());

  const handleFileChange = (file: File | null) => {
    setScanFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setScanPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setScanPreview(null);
    }
  };

  const uploadReferenceImage = async (file: File): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("recipe-images").upload(path, file);
      if (error) return null;
      const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
      return urlData.publicUrl;
    } catch { return null; }
  };

  const handleParse = async () => {
    if (mode === "smart" && !smartInput.trim()) return;
    if (mode === "scan" && !scanFile) return;

    setLoading(true);
    try {
      let body: any = { is_to_try: isToTry };
      let referenceImageUrl: string | null = null;

      if (mode === "smart") {
        if (isUrl(smartInput)) {
          body = { ...body, type: "parse_url", url: smartInput.trim() };
        } else {
          body = { ...body, type: "parse_text", text: smartInput };
        }
      } else if (mode === "scan" && scanFile) {
        referenceImageUrl = await uploadReferenceImage(scanFile);
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(scanFile);
        });
        body = { ...body, type: "scan_image", image: base64, reference_image_url: referenceImageUrl };
      }

      const { data, error } = await supabase.functions.invoke("parse-recipe", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Recipe imported successfully!");
      onImported();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to parse recipe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-float w-full max-w-xl animate-fade-in border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-display text-xl text-foreground">Smart Ingest</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("smart")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === "smart" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              <FileText className="w-4 h-4" /> Paste / URL
            </button>
            <button
              onClick={() => setMode("scan")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === "scan" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              <Camera className="w-4 h-4" /> Scan Image
            </button>
          </div>

          {mode === "smart" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Paste a URL or raw recipe text — AI will auto-detect and structure it.
              </p>
              <Textarea
                value={smartInput}
                onChange={(e) => setSmartInput(e.target.value)}
                placeholder="https://example.com/recipe  —or—  paste recipe text here..."
                className="min-h-[200px] bg-background resize-none"
              />
              {smartInput.trim() && (
                <span className="text-xs text-muted-foreground">
                  Detected: {isUrl(smartInput) ? "🔗 URL — will fetch & parse" : "📝 Raw text — will parse directly"}
                </span>
              )}
            </div>
          )}

          {mode === "scan" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload a photo of a recipe. Vision AI will extract it.
              </p>
              <label
                className={`flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors bg-background overflow-hidden ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith("image/")) handleFileChange(file);
                }}
              >
                {scanPreview ? (
                  <img src={scanPreview} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      {dragOver ? "Drop image here" : "Drag & drop or click to upload"}
                    </span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
              </label>
            </div>
          )}

          {/* To-Try checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={isToTry} onCheckedChange={(v) => setIsToTry(!!v)} />
            <span className="text-sm font-medium text-foreground">Add to To-Try list</span>
          </label>
        </div>

        <div className="p-5 border-t border-border flex justify-end">
          <Button onClick={handleParse} disabled={loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "AI Processing..." : "Import Recipe"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
