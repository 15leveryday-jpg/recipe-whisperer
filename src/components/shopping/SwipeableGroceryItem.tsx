import { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Trash2 } from "lucide-react";
import type { GroceryItem } from "@/types/grocery";

const SWIPE_THRESHOLD = 80;

interface Props {
  item: GroceryItem;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onFavorite: (id: string) => void;
  onEdit?: (item: GroceryItem) => void;
}

export function SwipeableGroceryItem({ item, onToggle, onRemove, onFavorite, onEdit }: Props) {
  const x = useMotionValue(0);
  const [swiping, setSwiping] = useState<"left" | "right" | null>(null);
  const [didSwipe, setDidSwipe] = useState(false);

  // Background colors based on swipe direction
  const bgColor = useTransform(x, [-150, -SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD, 150], [
    "hsl(0, 72%, 51%)",    // red (delete)
    "hsl(0, 72%, 60%)",
    "transparent",
    "hsl(43, 90%, 55%)",
    "hsl(43, 90%, 50%)",   // gold (favorite)
  ]);

  const bgOpacity = useTransform(x, [-150, -40, 0, 40, 150], [1, 0.6, 0, 0.6, 1]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const offset = info.offset.x;
    if (offset < -SWIPE_THRESHOLD) {
      onRemove(item.id);
    } else if (offset > SWIPE_THRESHOLD) {
      onFavorite(item.id);
    }
    setDidSwipe(Math.abs(offset) > 10);
    setSwiping(null);
  };

  const handleTap = () => {
    if (!didSwipe && onEdit) {
      onEdit(item);
    }
    setDidSwipe(false);
  };

  const handleDrag = (_: any, info: PanInfo) => {
    if (info.offset.x < -40) setSwiping("left");
    else if (info.offset.x > 40) setSwiping("right");
    else setSwiping(null);
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Swipe background indicators */}
      <motion.div
        className="absolute inset-0 flex items-center justify-between px-4 rounded-lg"
        style={{ backgroundColor: bgColor, opacity: bgOpacity }}
      >
        <div className="flex items-center gap-2 text-white">
          <Star className="w-4 h-4" />
          <span className="text-xs font-medium">Favorite</span>
        </div>
        <div className="flex items-center gap-2 text-white">
          <span className="text-xs font-medium">Delete</span>
          <Trash2 className="w-4 h-4" />
        </div>
      </motion.div>

      {/* Draggable item */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={`relative z-10 flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${
          item.is_bought
            ? "bg-muted/60 opacity-50"
            : "bg-card"
        }`}
      >
        <Checkbox
          checked={item.is_bought}
          onCheckedChange={() => onToggle(item.id)}
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {item.is_favorite && (
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
            )}
            <span
              className={`text-sm leading-tight ${
                item.is_bought
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {item.name}
            </span>
            {item.quantity && (
              <span className="text-xs text-muted-foreground/70">
                {item.quantity}
              </span>
            )}
          </div>
          {item.recipe_source && (
            <p className="text-[11px] text-muted-foreground/60 italic leading-tight mt-0.5">
              For: {item.recipe_source}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
