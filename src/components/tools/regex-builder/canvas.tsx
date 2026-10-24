"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, type ReactNode } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { describeQuantifier } from "@/lib/utils/regex/explain";
import {
  compileNode,
  createNode,
  getContainer,
  insertAt,
  moveNode,
  removeNode,
  updateNode,
  type NodeType,
  type Path,
  type RegexNode,
} from "@/lib/utils/regex/blocks";
import { cn } from "cn";

export const PALETTE: NodeType[] = [
  "start",
  "literal",
  "digit",
  "letter",
  "word",
  "space",
  "any",
  "charset",
  "group",
  "alt",
  "boundary",
  "end",
];

const containerId = (path: Path) => `container:${path.join(":") || "root"}`;

interface DropData {
  kind: "container" | "block";
  path: Path;
  index?: number;
}

/** Innermost droppable under the pointer wins (nested groups); keyboard falls back to closestCenter. */
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length > 0) {
    const area = (id: string | number) => {
      const r = args.droppableRects.get(id);
      return r ? r.width * r.height : Infinity;
    };
    return [...within].sort((a, b) => area(a.id) - area(b.id));
  }
  return closestCenter(args);
};

function PaletteItem({ type, onAdd }: { type: NodeType; onAdd: (type: NodeType) => void }) {
  const t = useTranslations("regex");
  const tb = useTranslations("tools.regex-builder");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { palette: type },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onAdd(type)}
      aria-label={tb("addBlock", { block: t(`blocks.${type}`) })}
      className={cn(
        "flex touch-none items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:border-primary/60",
        isDragging && "opacity-40",
      )}
    >
      <Plus className="size-3 text-primary" aria-hidden />
      {t(`blocks.${type}`)}
    </button>
  );
}

function summary(node: RegexNode, t: ReturnType<typeof useTranslations>): string {
  const parts: string[] = [];
  if (node.type === "literal") parts.push(`“${node.value}”`);
  if (node.type === "charset") parts.push(`${node.negate ? "≠ " : ""}[${node.chars}]`);
  if (node.type === "group" && node.name) parts.push(`<${node.name}>`);
  if (node.type === "raw") parts.push(node.source);
  const q = describeQuantifier(node.quantifier);
  if (q) parts.push(t(`quantifier.${q.kind}`, { min: q.min, max: q.max ?? 0 }));
  return parts.join(" · ");
}

interface BlockProps {
  node: RegexNode;
  path: Path;
  index: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onChange: (nodes: RegexNode[]) => void;
  nodes: RegexNode[];
}

function Block({ node, path, index, selected, onSelect, onChange, nodes }: BlockProps) {
  const t = useTranslations("regex");
  const tb = useTranslations("tools.regex-builder");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: { kind: "block", path, index } satisfies DropData,
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  const isContainer = node.type === "group" || node.type === "alt";

  return (
    <li ref={setNodeRef} style={style} className={cn("list-none", isDragging && "opacity-40")}>
      <div
        className={cn(
          "group/block rounded-md border bg-surface-1 text-[13px] transition-colors",
          selected === node.id ? "border-primary shadow-glow" : "hover:border-primary/40",
          isContainer && "bg-background",
        )}
      >
        <div className="flex items-center gap-1 px-1.5 py-1">
          <button
            type="button"
            {...listeners}
            {...attributes}
            aria-label={tb("drag", { block: t(`blocks.${node.type}`) })}
            className="grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className="flex min-w-0 flex-1 items-baseline gap-2 text-start"
            aria-pressed={selected === node.id}
          >
            <span className="font-medium">{t(`blocks.${node.type}`)}</span>
            <span className="truncate text-xs text-muted-foreground">{summary(node, t)}</span>
            <code className="ms-auto shrink-0 font-mono text-[11px] text-accent-text">
              {compileNode(node).slice(0, 24)}
            </code>
          </button>
          <button
            type="button"
            onClick={() => onChange(removeNode(nodes, node.id))}
            aria-label={tb("remove", { block: t(`blocks.${node.type}`) })}
            className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-60 group-hover/block:opacity-100 hover:text-destructive"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
        {node.type === "group" && (
          <div className="px-2 pb-2">
            <Container path={[node.id]} list={node.children} {...{ selected, onSelect, onChange, nodes }} />
          </div>
        )}
        {node.type === "alt" && (
          <div className="space-y-1.5 px-2 pb-2">
            {node.branches.map((branch, b) => (
              <div key={b} className="flex gap-1.5">
                <span className="mt-2 w-12 shrink-0 text-[11px] text-muted-foreground uppercase">
                  {t("explain.branch", { n: b + 1 })}
                </span>
                <div className="min-w-0 flex-1">
                  <Container path={[node.id, b]} list={branch} {...{ selected, onSelect, onChange, nodes }} />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                onChange(updateNode(nodes, node.id, { branches: [...node.branches, []] } as Partial<RegexNode>))
              }
              className="ms-14 text-xs text-accent-text hover:underline"
            >
              + {tb("addOption")}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function Container({
  path,
  list,
  selected,
  onSelect,
  onChange,
  nodes,
}: {
  path: Path;
  list: RegexNode[];
  selected: string | null;
  onSelect: (id: string) => void;
  onChange: (nodes: RegexNode[]) => void;
  nodes: RegexNode[];
}) {
  const tb = useTranslations("tools.regex-builder");
  const { setNodeRef, isOver } = useDroppable({
    id: containerId(path),
    data: { kind: "container", path } satisfies DropData,
  });
  return (
    <SortableContext items={list.map((n) => n.id)} strategy={verticalListSortingStrategy}>
      <ol
        ref={setNodeRef}
        className={cn(
          "min-h-10 space-y-1.5 rounded-md border border-dashed p-1.5 transition-colors",
          isOver ? "border-primary bg-primary/5" : "border-border",
        )}
        data-testid={path.length === 0 ? "regex-canvas" : undefined}
      >
        {list.length === 0 && (
          <li className="list-none px-2 py-1.5 text-xs text-muted-foreground">
            {tb(path.length === 0 ? "emptyCanvas" : "emptyGroup")}
          </li>
        )}
        {list.map((node, index) => (
          <Block key={node.id} {...{ node, path, index, selected, onSelect, onChange, nodes }} />
        ))}
      </ol>
    </SortableContext>
  );
}

/** Palette + nested sortable canvas. Tapping a palette block appends it at the end. */
export function BlocksCanvas({
  nodes,
  onChange,
  selected,
  onSelect,
  extra,
}: {
  nodes: RegexNode[];
  onChange: (nodes: RegexNode[]) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  extra?: ReactNode;
}) {
  const t = useTranslations("regex");
  const tb = useTranslations("tools.regex-builder");
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const add = (type: NodeType) => {
    const node = createNode(type);
    onChange(insertAt(nodes, [], nodes.length, node));
    onSelect(node.id);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const target = over.data.current as DropData | undefined;
    if (!target) return;
    const container = getContainer(nodes, target.path) ?? [];
    // Dropping on the lower half of a block inserts after it.
    const dragged = active.rect.current.translated;
    const after = dragged !== null && dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2;
    const index = target.kind === "block" ? (target.index ?? container.length) + (after ? 1 : 0) : container.length;
    const paletteType = (active.data.current as { palette?: NodeType } | undefined)?.palette;
    if (paletteType) {
      const node = createNode(paletteType);
      onChange(insertAt(nodes, target.path, index, node));
      onSelect(node.id);
    } else if (active.id !== over.id) {
      onChange(moveNode(nodes, String(active.id), target.path, index));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }: DragStartEvent) => setDragging(String(active.id))}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-3 p-3">
        <section aria-label={tb("palette")}>
          <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">{tb("palette")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((type) => (
              <PaletteItem key={type} type={type} onAdd={add} />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{tb("paletteHint")}</p>
        </section>
        {extra}
        <section aria-label={tb("canvas")}>
          <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">{tb("canvas")}</h3>
          <Container path={[]} list={nodes} {...{ selected, onSelect, onChange, nodes }} />
        </section>
      </div>
      <DragOverlay>
        {dragging?.startsWith("palette:") ? (
          <div className="rounded-md border border-primary bg-background px-2 py-1 text-xs shadow-glow">
            {t(`blocks.${dragging.slice(8) as NodeType}`)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
