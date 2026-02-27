import { useState } from "react";
import { Search, Sparkles, ShoppingBasket } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  onSemanticSearch: (query: string) => void;
  onPantrySearch: (ingredients: string) => void;
  loading?: boolean;
}

const SearchBar = ({ onSemanticSearch, onPantrySearch, loading }: SearchBarProps) => {
  const [mode, setMode] = useState<"semantic" | "pantry">("semantic");
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (mode === "semantic") {
      onSemanticSearch(query.trim());
    } else {
      onPantrySearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === "semantic"
              ? "Search by vibe... 'cozy winter soup' or 'post-workout meal'"
              : "Type ingredients... 'broccoli, garlic, chili'"
          }
          className="pl-10 h-12 bg-card text-base shadow-card border-border/60"
          disabled={loading}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("semantic")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            mode === "semantic"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          <Sparkles className="w-3 h-3" /> Vibe Search
        </button>
        <button
          type="button"
          onClick={() => setMode("pantry")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            mode === "pantry"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          <ShoppingBasket className="w-3 h-3" /> Pantry Match
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
