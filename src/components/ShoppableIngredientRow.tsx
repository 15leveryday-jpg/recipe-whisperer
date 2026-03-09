import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, ShoppingBag } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface ShoppableIngredientRowProps {
  index: number;
  name: string;
  amount?: string;
  unit?: string;
  isChecked: boolean;
  isHighlighted: boolean;
  isAddedToList: boolean;
  onToggleCheck: (checked: boolean) => void;
  onAddToList: () => void;
}

export default function ShoppableIngredientRow({
  name,
  amount,
  unit,
  isChecked,
  isHighlighted,
  isAddedToList,
  onToggleCheck,
  onAddToList,
}: ShoppableIngredientRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isTapRevealed, setIsTapRevealed] = useState(false);

  const showAddButton = isHovered || isTapRevealed;

  const handleRowTap = () => {
    // On mobile (no hover), toggle the add button visibility
    if (!isAddedToList) {
      setIsTapRevealed((prev) => !prev);
    }
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToList();
    setIsTapRevealed(false);
  };

  return (
    <li
      className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg transition-all duration-200 group cursor-default ${
        isHighlighted
          ? "bg-kitchen-herb-light scale-[1.03] border-l-4 border-kitchen-herb"
          : "border-l-4 border-transparent hover:bg-muted/40"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsTapRevealed(false); }}
      onClick={handleRowTap}
    >
      {/* Interactive circle / checkbox area */}
      <div className="relative shrink-0">
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checked) => onToggleCheck(!!checked)}
          onClick={(e) => e.stopPropagation()}
          className={isAddedToList ? "border-kitchen-herb data-[state=checked]:bg-kitchen-herb data-[state=checked]:border-kitchen-herb" : ""}
        />
      </div>

      {/* Ingredient text */}
      <span className={`flex-1 min-w-0 ${isChecked ? "line-through text-muted-foreground" : ""}`}>
        {amount && <span className="font-medium">{amount} </span>}
        {unit && <span className="text-muted-foreground">{unit} </span>}
        {name}
      </span>

      {/* Add-to-list button area */}
      <AnimatePresence mode="wait">
        {isAddedToList ? (
          <motion.div
            key="added"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 400, damping: 20 }}
            className="shrink-0 flex items-center gap-1 text-kitchen-herb"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <Check className="w-3 h-3" />
          </motion.div>
        ) : showAddButton ? (
          <motion.button
            key="add"
            initial={{ scale: 0, opacity: 0, rotate: -90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 400, damping: 20 }}
            onClick={handleAddClick}
            className="shrink-0 w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
            title="Add to shopping list"
          >
            <Plus className="w-3.5 h-3.5" />
          </motion.button>
        ) : (
          /* Invisible spacer to prevent layout shift */
          <div className="w-7 h-7 shrink-0 md:opacity-0 md:group-hover:opacity-100" />
        )}
      </AnimatePresence>
    </li>
  );
}
