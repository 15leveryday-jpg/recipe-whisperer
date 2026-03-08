import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChefHat, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Recipe } from "@/types/recipe";

const MAX_MEALS = 10;

interface MealPlanDockProps {
  meals: Recipe[];
  onExpand: () => void;
  onRemove: (id: string) => void;
  onReorder: (reordered: Recipe[]) => void;
}

function SortableThumbnail({
  recipe,
  onExpand,
  onRemove,
}: {
  recipe: Recipe;
  onExpand: () => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: recipe.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div ref={setNodeRef} style={style} className="relative group flex-shrink-0">
          <button
            className="w-12 h-12 rounded-lg overflow-hidden border border-border/50 hover:ring-2 hover:ring-primary transition-all cursor-grab active:cursor-grabbing touch-none"
            onClick={onExpand}
            {...attributes}
            {...listeners}
          >
            {recipe.image_url ? (
              <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-accent flex items-center justify-center">
                <ChefHat className="w-4 h-4 text-muted-foreground/50" />
              </div>
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(recipe.id); }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="bg-[hsl(30,10%,12%)] text-white border-none pointer-events-none animate-scale-in max-w-[200px] text-center"
      >
        {recipe.title}
      </TooltipContent>
    </Tooltip>
  );
}

const MealPlanDock = ({ meals, onExpand, onRemove, onReorder }: MealPlanDockProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = meals.findIndex((m) => m.id === active.id);
    const newIndex = meals.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(meals, oldIndex, newIndex));
  };

  if (meals.length === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none">
      <div className="pointer-events-auto inline-flex flex-col mx-4 mb-4 bg-card border border-border rounded-2xl shadow-float p-3 animate-fade-in max-w-[calc(100vw-2rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 px-1 gap-4">
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            {meals.length}/{MAX_MEALS}
          </span>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={onExpand}>
            <ChevronUp className="w-4 h-4" /> View Plan
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-muted mb-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(meals.length / MAX_MEALS) * 100}%` }}
          />
        </div>

        {/* Sortable Thumbnails - scrollable */}
        <div className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={meals.map((m) => m.id)} strategy={horizontalListSortingStrategy}>
              {meals.map((recipe) => (
                <SortableThumbnail
                  key={recipe.id}
                  recipe={recipe}
                  onExpand={onExpand}
                  onRemove={onRemove}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
};

export default MealPlanDock;
