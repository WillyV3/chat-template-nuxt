// Types, icon/accent tables, legacy-event adapters and resolve routing for the
// human-in-the-loop cards (hitl-cards.vue, hitl-card.vue, hitl-field-input.vue).
import type { Component } from "vue";
import { Shield, Plug, Layers, Clock } from "@lucide/vue";

import type { GatewayHook } from "@/components/chat/lib/use-gateway";

// ─── Generic HITL types ─────────────────────────────────────────────────────

export type HitlFieldType = "text" | "password" | "textarea" | "readonly" | "code" | "details";

export type HitlField = {
  key: string;
  label: string;
  type?: HitlFieldType;
  placeholder?: string;
  required?: boolean;
  value?: string; // pre-filled by agent
};

export type HitlAction = {
  key: string;
  label: string;
  variant?: "default" | "secondary" | "ghost" | "destructive";
};

export type HitlRequest = {
  id: string;
  tool: string;
  /** Frontend-only routing hint: which RPC resolves this card. Absent = the
   *  unified `hitl.resolve`; the legacy adapters set it during the image
   *  migration so old-image cards resolve via their old RPC. */
  _resolveVia?: "exec" | "mcp_setup";
  variant: "confirm" | "form";
  title: string;
  description?: string;
  icon?: string;
  accent?: "primary" | "amber" | "emerald" | "destructive";
  fields?: HitlField[];
  actions: HitlAction[];
  metadata?: Record<string, unknown>;
  createdAtMs?: number;
  expiresAtMs?: number;
};

// ─── Icon resolver ──────────────────────────────────────────────────────────

const ICON_MAP: Record<string, Component> = {
  shield: Shield,
  plug: Plug,
  clock: Clock,
  layers: Layers,
};

export function resolveIcon(name?: string): Component | null {
  if (!name) return null;
  return ICON_MAP[name] ?? null;
}

// ─── Accent styles ──────────────────────────────────────────────────────────

// Accent is carried by a 2px LEFT RAIL and the tool badge, not by a tinted
// wash over the whole card. The amber fill made an ordinary permission prompt
// read as an error state, and on a phone, where the card is most of the
// screen, it dominated the transcript.
export const ACCENT_STYLES: Record<string, { rail: string; badge: string }> = {
  primary: {
    rail: "border-l-primary",
    badge: "bg-primary/10 text-primary",
  },
  amber: {
    rail: "border-l-amber-500",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  emerald: {
    rail: "border-l-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  destructive: {
    rail: "border-l-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
};

// ─── Legacy event compat (image migration) ──────────────────────────────────
// The unified agent image emits generic `hitl.*`; OLD images still emit
// `exec.approval.*` / `mcp.setup.*`. The web renders BOTH so a rolling/canary
// image update never breaks approvals or connect cards on not-yet-updated
// instances (the web is one shared deploy). The `_resolveVia` marker
// routes each card's resolve back to the matching RPC. REMOVE this whole block
// once the entire fleet is on the unified image.

function toolDisplayName(command?: string): string {
  if (!command) return "agent";
  if (command.startsWith("shell")) return "run a command";
  if (command.startsWith("file_write")) return "modify a file";
  if (command.startsWith("file_read")) return "read a file";
  return "take an action";
}

export function adaptExecApproval(payload: Record<string, unknown>): HitlRequest {
  const req = payload.request as Record<string, string> | undefined;
  const display = toolDisplayName(req?.command);
  const ask = req?.ask?.trim();
  const humanAction = ask && ask.length > 0 && ask.length < 120 ? ask : null;
  return {
    id: payload.id as string,
    tool: "exec",
    _resolveVia: "exec",
    variant: "confirm",
    title: humanAction
      ? `Your agent wants to ${humanAction.charAt(0).toLowerCase()}${humanAction.slice(1)}`
      : `Your agent wants to ${display}`,
    description: humanAction ? undefined : ask,
    icon: "shield",
    accent: "amber",
    fields: req?.command
      ? [{ key: "command", label: "command", type: "details", value: req.command }]
      : [],
    actions: [
      { key: "allow-once", label: "Allow", variant: "default" },
      { key: "allow-always", label: "Always Allow", variant: "secondary" },
      { key: "deny", label: "Skip", variant: "ghost" },
    ],
    createdAtMs: payload.createdAtMs as number,
    expiresAtMs: payload.expiresAtMs as number,
  };
}

export function adaptMcpSetup(payload: Record<string, unknown>): HitlRequest {
  const requiredEnv = (payload.requiredEnv ?? []) as { name: string; label: string }[];
  return {
    id: payload.id as string,
    tool: "mcp_setup",
    _resolveVia: "mcp_setup",
    variant: "form",
    title: `Connect ${payload.service}`,
    description: payload.description as string,
    icon: "plug",
    accent: "primary",
    fields: requiredEnv.map((e) => ({
      key: e.name,
      label: e.label,
      type: "password" as HitlFieldType,
      placeholder: e.name,
      required: true,
    })),
    actions: [
      { key: "submit", label: "Connect", variant: "default" },
      { key: "cancel", label: "Cancel", variant: "ghost" },
    ],
    metadata: { service: payload.service, domain: payload.domain },
    createdAtMs: payload.createdAtMs as number,
    expiresAtMs: payload.expiresAtMs as number,
  };
}

// ─── Resolve: route by source: unified `hitl.resolve`, or the legacy RPC ─────

export function resolveAction(
  rpc: GatewayHook["rpc"],
  request: HitlRequest,
  action: string,
  values: Record<string, string>,
) {
  if (request._resolveVia === "exec") {
    rpc("exec.approval.resolve", { id: request.id, decision: action }).catch(console.error);
  } else if (request._resolveVia === "mcp_setup") {
    rpc("mcp.setup.resolve", {
      id: request.id,
      env: action === "cancel" ? {} : values,
      cancelled: action === "cancel",
    }).catch(console.error);
  } else {
    rpc("hitl.resolve", { id: request.id, action, values }).catch(console.error);
  }
}
