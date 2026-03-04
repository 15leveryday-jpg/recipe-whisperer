import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Ingredient } from "@/types/recipe";

interface EditableIngredientsProps {
  ingredients: Ingredient[];
  onChange: (ingredients: Ingredient[]) => void;
}

function isIngredientHeader(ing: Ingredient): boolean {
  const name = ing.name.trim();
  if (name.startsWith("**") && name.endsWith("**")) return true;
  if (name.endsWith(":")) return true;
  if (!ing.amount && !ing.unit && /^[A-Z\s&,]{2,}$/.test(name)) return true;
  return false;
}

/** Individual sortable ingredient row */
function SortableIngredientRow({
  id,
  ingredient,
  index,
  isHeader,
  onUpdate,
  onRemove,
}: {
  id: string;
  ingredient: Ingredient;
  index: number;
  isHeader: boolean;
  onUpdate: (index: number, field: keyof Ingredient, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-1 items-center group ${
        isHeader ? "mt-3 first:mt-0" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {isHeader ? (
        /* Section header row — full width, serif styled */
        <>
          <Input
            value={ingredient.name}
            onChange={(e) => onUpdate(index, "name", e.target.value)}
            placeholder="Section name (e.g. For the Dough:)"
            className="flex-1 bg-background text-sm font-display font-semibold border-b-2 border-primary/30"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(index)}
          >
            <X className="w-3 h-3" />
          </Button>
        </>
      ) : (
        /* Normal ingredient row */
        <>
          <Input
            value={ingredient.amount || ""}
            onChange={(e) => onUpdate(index, "amount", e.target.value)}
            placeholder="Amt"
            className="w-16 bg-background text-sm"
          />
          <Input
            value={ingredient.unit || ""}
            onChange={(e) => onUpdate(index, "unit", e.target.value)}
            placeholder="Unit"
            className="w-16 bg-background text-sm"
          />
          <Input
            value={ingredient.name}
            onChange={(e) => {
              const val = e.target.value;
              onUpdate(index, "name", val);
            }}
            placeholder="Ingredient name"
            className="flex-1 bg-background text-sm"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(index)}
          >
            <X className="w-3 h-3" />
          </Button>
        </>
      )}
    </div>
  );
}

export default function EditableIngredients({
  ingredients,
  onChange,
}: EditableIngredientsProps) {
  // Generate stable IDs for each ingredient
  const [idMap] = useState(() => new Map<number, string>());
  const getIdForIndex = useCallback(
    (index: number) => {
      if (!idMap.has(index)) {
        idMap.set(index, `ing-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`);
      }
      return idMap.get(index)!;
    },
    [idMap]
  );

  // Rebuild IDs when ingredients change length
  const ids = ingredients.map((_, i) => getIdForIndex(i));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newArr = arrayMove(ingredients, oldIndex, newIndex);
    // Rebuild ID map for new order
    const entries = arrayMove([...idMap.entries()].sort((a, b) => a[0] - b[0]).slice(0, ingredients.length), oldIndex, newIndex);
    idMap.clear();
    entries.forEach(([, id], i) => idMap.set(i, id));

    onChange(newArr);
  };

  const handleUpdate = (index: number, field: keyof Ingredient, value: string) => {
    const arr = [...ingredients];
    arr[index] = { ...arr[index], [field]: value };
    onChange(arr);
  };

  const handleRemove = (index: number) => {
    const arr = ingredients.filter((_, j) => j !== index);
    // Rebuild ID map
    const oldEntries = [...idMap.entries()].sort((a, b) => a[0] - b[0]);
    idMap.clear();
    let newIdx = 0;
    for (const [origIdx, id] of oldEntries) {
      if (origIdx === index) continue;
      idMap.set(newIdx, id);
      newIdx++;
    }
    onChange(arr);
  };

  const addIngredient = () => {
    const newIdx = ingredients.length;
    idMap.set(newIdx, `ing-${Date.now()}-${newIdx}-${Math.random().toString(36).slice(2, 6)}`);
    onChange([...ingredients, { name: "" }]);
  };

  const addSection = () => {
    const newIdx = ingredients.length;
    idMap.set(newIdx, `ing-${Date.now()}-${newIdx}-${Math.random().toString(36).slice(2, 6)}`);
    onChange([...ingredients, { name: "New Section:", amount: undefined, unit: undefined }]);
  };

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ingredients.map((ing, i) => (
            <SortableIngredientRow
              key={ids[i]}
              id={ids[i]}
              ingredient={ing}
              index={i}
              isHeader={isIngredientHeader(ing)}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={addIngredient}>
          <Plus className="w-3 h-3 mr-1" /> Add Ingredient
        </Button>
        <Button variant="outline" size="sm" onClick={addSection}>
          <Type className="w-3 h-3 mr-1" /> Add Section
        </Button>
      </div>
    </div>
  );
}
