import { useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onLocalSearch: (query: string) => void;
  localQuery: string;
  loading?: boolean;
}

const SearchBar = ({ onSearch, onLocalSearch, localQuery, loading }: SearchBarProps) => {
  const [isVibeMode, setIsVibeMode] = useState(false);

  const handleChange = (value: string) => {
    onLocalSearch(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localQuery.trim()) return;
    if (isVibeMode) {
      onSearch(localQuery.trim());
    }
    // In non-vibe mode, local filtering is already active via onChange
  };

  const handleClear = () => {
    onLocalSearch("");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
        <Input
          value={localQuery}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={isVibeMode ? "Describe a vibe... e.g. 'cozy rainy day dinner'" : "Search recipes by name, ingredient, or tag..."}
          className="pl-10 pr-10 h-12 bg-card text-base shadow-card border-border/60"
          disabled={loading}
        />
        {localQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          onClick={() => setIsVibeMode(!isVibeMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[44px] sm:min-h-0 ${
            isVibeMode
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Sparkles className="w-3 h-3" /> AI Vibe Search
        </button>
        {isVibeMode && localQuery.trim() && (
          <Button type="submit" size="sm" disabled={loading} className="min-h-[44px] sm:min-h-0">
            {loading ? "Searching..." : "Search"}
          </Button>
        )}
        <span className="text-xs text-muted-foreground self-center ml-1 hidden sm:inline">
          {isVibeMode
            ? "Submit to search with AI — handles mood, cuisine, vibes"
            : "Real-time filtering by title, ingredients, tags"}
        </span>
      </div>
    </form>
  );
};

export default SearchBar;
