import { useState } from "react";
import { Search, Sparkles, ShoppingBasket } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}

const SearchBar = ({ onSearch, loading }: SearchBarProps) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim());
  };

  // Auto-detect mode for display hint
  const isPantry = query.includes(",");

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by vibe... or type ingredients separated by commas"
          className="pl-10 h-12 bg-card text-base shadow-card border-border/60"
          disabled={loading}
        />
      </div>
      <div className="flex gap-2">
        <span
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            !isPantry
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Sparkles className="w-3 h-3" /> Vibe Search
        </span>
        <span
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            isPantry
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <ShoppingBasket className="w-3 h-3" /> Pantry Match
        </span>
        <span className="text-xs text-muted-foreground self-center ml-1">
          {isPantry ? "Comma-separated → ingredient match" : "Natural language → semantic search"}
        </span>
      </div>
    </form>
  );
};

export default SearchBar;
