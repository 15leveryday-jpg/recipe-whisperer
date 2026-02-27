import { useState } from "react";
import { X, Loader2, Upload, Camera, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

const ImportModal = ({ onClose, onImported }: ImportModalProps) => {
  const [mode, setMode] = useState<"text" | "url" | "scan">("text");
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);

  const handleParse = async () => {
    if (mode === "text" && !rawText.trim()) return;
    if (mode === "url" && !url.trim()) return;
    if (mode === "scan" && !scanFile) return;

    setLoading(true);
    try {
      let body: any = {};

      if (mode === "text") {
        body = { type: "parse_text", text: rawText };
      } else if (mode === "url") {
        body = { type: "parse_url", url };
      } else if (mode === "scan" && scanFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(scanFile);
        });
        body = { type: "scan_image", image: base64 };
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

  const modes = [
    { key: "text" as const, label: "Paste Text", icon: Upload },
    { key: "url" as const, label: "From URL", icon: Link },
    { key: "scan" as const, label: "Scan Image", icon: Camera },
  ];

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
          {/* Mode selector */}
          <div className="flex gap-2">
            {modes.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {mode === "text" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Paste messy text from Google Docs, YouTube transcripts, or anywhere. AI will structure it.
              </p>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste your recipe text here... ingredients, instructions, everything."
                className="min-h-[200px] bg-background resize-none"
              />
            </div>
          )}

          {mode === "url" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Provide a URL. You'll be asked to paste the transcript or content for AI processing.
              </p>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or recipe URL"
                className="bg-background"
              />
              {url && (
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Now paste the caption, transcript, or recipe text from this URL..."
                  className="min-h-[150px] bg-background resize-none"
                />
              )}
            </div>
          )}

          {mode === "scan" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload a screenshot of a recipe (e.g., from Instagram) and Vision AI will extract it.
              </p>
              <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors bg-background">
                {scanFile ? (
                  <span className="text-sm text-foreground font-medium">{scanFile.name}</span>
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click to upload image</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setScanFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          )}
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
