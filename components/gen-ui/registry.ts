// The Vue twin of @json-render/shadcn's `shadcnComponents`: all 36 catalog
// components over our components/ui. Stateless ones render here; the rest are
// SFCs in ./shadcn/. Each SFC takes the element's props directly plus
// bindings/emit/on, so the registry only adapts the call shape.

import { defineRegistry, type Components } from "@json-render/vue";
import { h, type Component, type VNode } from "vue";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { catalog } from "./catalog";
import Accordion from "./shadcn/accordion.vue";
import Alert from "./shadcn/alert.vue";
import Avatar from "./shadcn/avatar.vue";
import ButtonGroup from "./shadcn/button-group.vue";
import Card from "./shadcn/card.vue";
import Carousel from "./shadcn/carousel.vue";
import Checkbox from "./shadcn/checkbox.vue";
import Collapsible from "./shadcn/collapsible.vue";
import Dialog from "./shadcn/dialog.vue";
import Drawer from "./shadcn/drawer.vue";
import DropdownMenu from "./shadcn/dropdown-menu.vue";
import Input from "./shadcn/input.vue";
import Pagination from "./shadcn/pagination.vue";
import Popover from "./shadcn/popover.vue";
import Progress from "./shadcn/progress.vue";
import Radio from "./shadcn/radio.vue";
import Select from "./shadcn/select.vue";
import Slider from "./shadcn/slider.vue";
import Switch from "./shadcn/switch.vue";
import Table from "./shadcn/table.vue";
import Tabs from "./shadcn/tabs.vue";
import Textarea from "./shadcn/textarea.vue";
import Toggle from "./shadcn/toggle.vue";
import ToggleGroup from "./shadcn/toggle-group.vue";
import Tooltip from "./shadcn/tooltip.vue";

type Ctx = {
  props: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  bindings?: Record<string, string>;
  emit: (event: string) => void;
  on: (event: string) => { emit: () => void; shouldPreventDefault: boolean };
  slots: Record<string, unknown>;
};
type Fn = (ctx: Ctx) => VNode | VNode[] | null | string;

/** Mount an SFC with the element's props spread on it, children as its slots.
 *  bindings/emit go only to SFCs that declare them (else they'd fall through to the DOM as attrs). */
const sfc =
  (C: Component): Fn =>
  ({ props, bindings, emit, slots }) => {
    const declared = (C as { props?: Record<string, unknown> }).props ?? {};
    return h(C, { ...props, ...("bindings" in declared && { bindings }), ...("emit" in declared && { emit }) }, slots as never);
  };

const GAP = { none: "gap-0", sm: "gap-2", md: "gap-3", lg: "gap-4", xl: "gap-6" } as const;
const ALIGN = { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch" } as const;
const JUSTIFY = { start: "", center: "justify-center", end: "justify-end", between: "justify-between", around: "justify-around" } as const;
const COLS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6" } as const;
const GRID_GAP = { sm: "gap-2", md: "gap-3", lg: "gap-4", xl: "gap-6" } as const;
const HEADING = {
  h1: "text-2xl font-bold",
  h2: "text-lg font-semibold",
  h3: "text-base font-semibold",
  h4: "text-sm font-semibold",
} as const;

const components: Record<string, Fn> = {
  // ── Layout ──
  Card: sfc(Card),
  Stack: ({ props, slots }) =>
    h(
      "div",
      {
        class: cn(
          "flex",
          props.direction === "horizontal" ? "flex-row flex-wrap" : "flex-col",
          GAP[(props.gap ?? "md") as keyof typeof GAP] ?? "gap-3",
          ALIGN[(props.align ?? "start") as keyof typeof ALIGN] ?? "items-start",
          JUSTIFY[(props.justify ?? "") as keyof typeof JUSTIFY] ?? "",
          props.className,
        ),
      },
      (slots.default as () => VNode[] | undefined)?.(),
    ),
  Grid: ({ props, slots }) => {
    const n = Math.max(1, Math.min(6, props.columns ?? 1));
    return h(
      "div",
      { class: cn("grid", COLS[n as keyof typeof COLS] ?? "grid-cols-1", GRID_GAP[(props.gap ?? "md") as keyof typeof GRID_GAP] ?? "gap-3", props.className) },
      (slots.default as () => VNode[] | undefined)?.(),
    );
  },
  Separator: ({ props }) =>
    h(Separator, { orientation: props.orientation ?? "horizontal", class: props.orientation === "vertical" ? "h-full mx-2" : "my-3" }),
  Tabs: sfc(Tabs),
  Accordion: sfc(Accordion),
  Collapsible: sfc(Collapsible),
  Dialog: sfc(Dialog),
  Drawer: sfc(Drawer),
  Carousel: sfc(Carousel),
  // ── Data display ──
  Table: sfc(Table),
  Heading: ({ props }) => {
    const level = (props.level ?? "h2") as keyof typeof HEADING;
    return h(HEADING[level] ? level : "h2", { class: `${HEADING[level] ?? HEADING.h2} text-left` }, props.text);
  },
  Text: ({ props }) => {
    const textClass =
      props.variant === "caption"
        ? "text-xs"
        : props.variant === "muted"
          ? "text-sm text-muted-foreground"
          : props.variant === "lead"
            ? "text-xl text-muted-foreground"
            : props.variant === "code"
              ? "font-mono text-sm bg-muted px-1.5 py-0.5 rounded"
              : "text-sm";
    return h(props.variant === "code" ? "code" : "p", { class: `${textClass} text-left` }, props.text);
  },
  Image: ({ props }) =>
    props.src
      ? h("img", { src: props.src, alt: props.alt ?? "", width: props.width ?? undefined, height: props.height ?? undefined, class: "rounded max-w-full" })
      : h(
          "div",
          {
            class: "bg-muted border border-border rounded flex items-center justify-center text-xs text-muted-foreground",
            style: { width: `${props.width ?? 80}px`, height: `${props.height ?? 60}px` },
          },
          props.alt || "img",
        ),
  Avatar: sfc(Avatar),
  Badge: ({ props }) => h(Badge, { variant: props.variant ?? "default" }, () => props.text),
  Alert: sfc(Alert),
  Progress: sfc(Progress),
  Skeleton: ({ props }) =>
    h(Skeleton, {
      class: props.rounded ? "rounded-full" : "rounded-md",
      style: { width: props.width ?? "100%", height: props.height ?? "1.25rem" },
    }),
  Spinner: ({ props }) => {
    const sizeClass = props.size === "lg" ? "h-8 w-8" : props.size === "sm" ? "h-4 w-4" : "h-6 w-6";
    return h("div", { class: "flex items-center gap-2" }, [
      h("svg", { class: `${sizeClass} animate-spin text-muted-foreground`, viewBox: "0 0 24 24", fill: "none" }, [
        h("circle", { class: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", "stroke-width": "4" }),
        h("path", { class: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" }),
      ]),
      props.label ? h("span", { class: "text-sm text-muted-foreground" }, props.label) : null,
    ]);
  },
  Tooltip: sfc(Tooltip),
  Popover: sfc(Popover),
  // ── Form inputs ──
  Input: sfc(Input),
  Textarea: sfc(Textarea),
  Select: sfc(Select),
  Checkbox: sfc(Checkbox),
  Radio: sfc(Radio),
  Switch: sfc(Switch),
  Slider: sfc(Slider),
  // ── Actions ──
  Button: ({ props, emit }) =>
    h(
      Button,
      {
        variant: props.variant === "danger" ? "destructive" : props.variant === "secondary" ? "secondary" : "default",
        disabled: props.disabled ?? false,
        onClick: () => emit("press"),
      },
      () => props.label,
    ),
  Link: ({ props, on }) =>
    h(
      "a",
      {
        href: props.href ?? "#",
        class: "text-primary underline-offset-4 hover:underline text-sm font-medium",
        onClick: (e: MouseEvent) => {
          const press = on("press");
          if (press.shouldPreventDefault) e.preventDefault();
          press.emit();
        },
      },
      props.label,
    ),
  DropdownMenu: sfc(DropdownMenu),
  Toggle: sfc(Toggle),
  ToggleGroup: sfc(ToggleGroup),
  ButtonGroup: sfc(ButtonGroup),
  Pagination: sfc(Pagination),
};

// Action handlers are per-render (they need the room's send), so they ride
// JSONUIProvider in gen-ui.vue; the registry only satisfies the catalog's typing.
export const { registry } = defineRegistry(catalog, {
  components: components as unknown as Components<typeof catalog>,
  actions: { send_message: async () => {} },
});
