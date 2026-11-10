// Split an assistant message into its prose and the UI spec in its ```spec
// fence(s). Works on partial text mid-stream: complete patch lines apply, the
// half-written last line waits for the next delta.

import { applySpecPatch, parseSpecStreamLine, type Spec } from "@json-render/core";

const FENCE_OPEN = /^\s*```spec\s*$/;
const FENCE_CLOSE = /^\s*```\s*$/;

export function hasSpec(content: string): boolean {
  return content.split("\n").some((l) => FENCE_OPEN.test(l));
}

// ponytail: reparses the whole message per delta, O(n) each; fine for chat-sized
// replies. Move to createSpecStreamCompiler if specs get huge.
export function splitSpec(content: string, streaming = false): { text: string; spec: Spec | null } {
  const lines = content.split("\n");
  // Mid-stream the last line may be cut off: never parse it as a patch.
  const complete = streaming ? lines.length - 1 : lines.length;
  const text: string[] = [];
  let spec: Spec | null = null;
  let inFence = false;
  lines.forEach((line, i) => {
    if (!inFence && FENCE_OPEN.test(line)) return void (inFence = true);
    if (inFence && FENCE_CLOSE.test(line)) return void (inFence = false);
    if (!inFence) return void text.push(line);
    if (i >= complete) return;
    const patch = parseSpecStreamLine(line.trim());
    if (!patch) return;
    // Model output: a failing "test" op or a bad path skips that line instead
    // of taking the transcript down.
    try {
      spec = applySpecPatch(spec ?? { root: "", elements: {} }, patch);
    } catch {}
  });
  return { text: text.join("\n").trim(), spec };
}
