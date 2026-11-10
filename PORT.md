# React -> Vue port contract

Source of truth: the React template at `~/hfl-projects/chat-template` (read-only for
you). Its `node_modules` (React libs: thinking-orbs, streamdown, use-stick-to-bottom,
motion, radix, @json-render/shadcn) live on homelab only:
`ssh ubuntu-homelab 'cat ~/hfl-projects/chat-template/node_modules/<pkg>/...'`.

Target: this repo, Nuxt 4.6, Vue 3.5, `srcDir` = repo root, `@/` = repo root.
The goal is a HIGH-QUALITY 1:1 port: same look, same feel, same behaviour, same
animations. Not a reinterpretation. Port the load-bearing comments too.

## Paths and names (deterministic, so parallel agents can import each other)

- An exported React component `FooBar` in `dir/x.tsx` becomes `dir/foo-bar.vue`
  (kebab-case of the COMPONENT name, same directory as the original file).
- Non-component exports of `dir/x.tsx` (types, helpers, constants) go to `dir/x.ts`.
- Hook `useX` in `dir/use-x.ts` becomes a composable in the same file path.
- shadcn primitives: React `@/components/chat/ui/<p>` and `@/components/ui/<p>` both
  map to Vue `@/components/ui/<p>` (shadcn-vue layout: `<p>/index.ts` + `Xxx.vue`).
  Exception: Sontara-custom files in `components/chat/ui/` with no shadcn
  equivalent (chat-shell, conversation, message, response, hint, sidebar-nav)
  stay at `components/chat/ui/<kebab-component>.vue`.
- `@/lib/utils` exports `cn`. Use it.

## Component API

- `<script setup lang="ts">`, typed `defineProps<...>()`.
- Same prop names as React. Callback props (`onRewind`, `onOpenFile`, ...) stay
  FUNCTION PROPS, not emits, so the API is identical and registries can pass them.
- `children` -> default slot. Render props -> named/scoped slots, or a component prop
  where React passed a component (renderer registry: `Component: <Vue component>`).
- `className` -> accept a `class` prop (`HTMLAttributes["class"]`) merged with `cn`.
- Composables take `MaybeRefOrGetter` inputs and return refs/computed.
- Auto-imports are OFF. Import everything explicitly (`vue`, `#app`/`#imports`).

## Library map (already installed; do NOT npm install unless your brief says so)

| React | Vue |
|---|---|
| radix-ui | reka-ui 2.11 |
| motion | motion-v 2.10 (`motion.div`, `AnimatePresence`, `layoutId`) |
| lucide-react | @lucide/vue 1.66 (same icon names) |
| sonner | vue-sonner 2.0 (`toast` same API) |
| next-themes | `.dark` class on `<html>`, owned by app.vue (theme agent) |
| next/headers cookies() | `useCookie` / `useRequestHeaders` from `#app` |
| use-stick-to-bottom | write it (small composable), owned by the room agent |
| thinking-orbs (React only) | port it to Vue, owned by the messages agent |
| streamdown | messages agent picks a Vue streaming-markdown lib (shiki 4 installed) |
| recharts | plain SVG (only the skin-editor preview uses it) |
| @json-render/react + shadcn | @json-render/vue 0.21.4 + our own registry over components/ui |
| useState/useEffect/useMemo/useRef | ref/watch/computed/shallowRef; useLayoutEffect -> watch(..., {flush:"post"}) or onMounted |

## Ownership (no two agents edit one file)

- room: `components/chat/chat/**` (except tool-run-group), `components/chat/lib/use-gateway.ts`,
  `components/chat/hooks/**`, `components/chat/use-shrinkwrap.ts`, `components/chat/use-smoothed-text.ts`,
  `components/chat/ui/conversation*.vue`
- messages: `components/chat/chat-message-row*`, `components/chat/chat/tool-run-group*`,
  `components/chat/hitl-cards*`, `components/chat/agent-orb*`, `components/chat/orb/**`,
  `components/chat/lib/orb-state*`, `components/chat/ui/{message,response,hint}*`
- shell: `components/ui/**`, `components/chat/ui/{chat-shell,sidebar-nav}*`, `components/chat/ui/sidebar*`
- files: `components/chat/files/**`, `components/chat/lib/{download,upload}*`
- theme: `components/theme/**`, `lib/theme/**`, `app.vue`, `app.css`
- app: `components/app/**`, `components/gen-ui/**`, `lib/mock-gateway*`, `README.md`

Need a change in a file you don't own? Don't make it. Put it in your final report.

## Verify (homelab; never run builds or dev servers locally)

`scripts/hl.sh "<cmd>"` rsyncs this tree to homelab and runs `<cmd>` in the repo there.

- Types: `scripts/hl.sh "npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json 2>&1 | grep -E '<your paths>'"`
  (other agents' files will have errors mid-port; yours must have none).
- Tests: `scripts/hl.sh "npx vitest run <your paths>"`. Port the React tests for your
  files; component tests use `@vue/test-utils` with `// @vitest-environment happy-dom`.
- Do NOT start dev servers, do NOT git commit, do NOT run `npm install` (unless your brief says).
