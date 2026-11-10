// The room's composable: gateway wiring (WS events → dispatch), history with its
// retry and resyncs, the send path, the composer draft and its pills, all driven
// by a ChatRoomConfig. State TRANSITIONS live in core's chatReducer (composed
// with the host's); the IO itself is plain functions in room-io.ts so it can be
// tested against a fake gateway. This composable only binds them to Vue.
//
// It knows nothing about any host: no Clerk, no routes, no `@/`.
//
// The returned handle is ONE object whose `state`, `input` and `connected` are
// getters over refs: read them inside a computed / watch / template and they are
// reactive. Pass it around instead of destructuring those three.

import { toast } from "vue-sonner";
import {
  computed,
  onMounted,
  onBeforeUnmount,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import {
  initialChatState,
  rewindText,
  type ChatAction,
  type ChatMessage,
  type ChatState,
} from "@/components/chat/core/chat-model";

import type { StickToBottomContext } from "../hooks/use-stick-to-bottom";
import type { ChatRoomConfig, RoomApi } from "./room-config";
import {
  JOINED_RUN_RESYNC_MS,
  bindChatStream,
  bindToolEvents,
  composeReduce,
  createInitialPromptGate,
  resolveTimezone,
  resyncHistory,
  routeKey,
  runSend,
  startHistoryLoad,
  type AnyAction,
  type SendEnv,
} from "./room-io";
import { EMPTY_COMPOSER, composerReducer, type ComposerAction } from "./composer-state";
import { useRoomAttachments } from "./use-room-attachments";

type LooseRoom = RoomApi<string, object, object, unknown>;

/** RoomApi plus what <ChatRoomView> needs to draw the room. */
export type ChatRoomHandle<
  R extends string = never,
  E extends object = object,
  S extends object = object,
  A = never,
  X extends object = object,
> = RoomApi<R, E, S, A> & {
  config: ChatRoomConfig<R, E, S, A, X>;
  readonly connected: boolean;
  textareaRef: Ref<HTMLTextAreaElement | null>;
  conversationRef: Ref<StickToBottomContext | null>;
  /** Re-arm stick-to-bottom after the user acts. */
  pinToBottom: () => void;
  files: ReturnType<typeof useRoomAttachments>;
  /** A typed change in the textarea (runs composer.onInput). */
  onInputChange: (text: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  /** The composer's send button / Enter. */
  submit: () => void;
  /** Rewind by message id: that message's text goes back into the composer. */
  rewind: (msgId: string) => void;
};

/** `config` may be a plain object, a ref or a getter. The latest value is read at
 *  event time, so a host that rebuilds its config never forces a rebind or a
 *  stale read. */
export function useChatRoom<
  R extends string = never,
  E extends object = object,
  S extends object = object,
  A = never,
  X extends object = object,
>(configInput: MaybeRefOrGetter<ChatRoomConfig<R, E, S, A, X>>): ChatRoomHandle<R, E, S, A, X> {
  const cfg = () => toValue(configInput);
  const { rpc, on, off } = cfg().gateway;
  const connected = computed(() => !!toValue(cfg().gateway.connected));

  const reduce = computed(() =>
    composeReduce<ChatState<S, R, E>, A | ChatAction<R, E>>(cfg().state?.reduce),
  );
  const state = shallowRef(
    initialChatState(cfg().state?.initial ?? ({} as S)) as ChatState<S, R, E>,
  );
  const dispatch = (a: A | ChatAction<R, E>) => {
    state.value = reduce.value(state.value, a);
  };
  const dispatchAny = dispatch as unknown as (a: AnyAction) => void;

  const composer = shallowRef(EMPTY_COMPOSER);
  const dispatchComposer = (a: ComposerAction) => {
    composer.value = composerReducer(composer.value, a);
  };
  const input = computed(() => composer.value.input);
  const textareaRef = ref<HTMLTextAreaElement | null>(null);

  // Handle onto the transcript's stick-to-bottom instance. The library pins the
  // view while content GROWS (a streaming reply) but stops sticking once you
  // scroll up, and cannot tell a message YOU just sent from more arriving
  // content. One scrollToBottom() on the send path re-arms it.
  const conversationRef = ref<StickToBottomContext | null>(null);
  const pinToBottom = () => {
    void conversationRef.value?.scrollToBottom();
  };

  const hasParse = computed(() => !!cfg().history?.parseUserText);
  const parseUserText = (content: string) =>
    cfg().history?.parseUserText?.(content) ?? { text: content };
  const parse = () => (hasParse.value ? parseUserText : undefined);

  // ── History ─────────────────────────────────────────────────────────────

  watch(
    [connected, () => state.value.history.loaded, () => state.value.history.attempt, hasParse],
    ([isConnected, loaded, attempt], _old, onCleanup) => {
      if (!isConnected || loaded) return;
      onCleanup(
        startHistoryLoad({
          rpc,
          dispatch: dispatchAny,
          attempt,
          parseUserText: parse(),
        }),
      );
    },
    { immediate: true },
  );

  // Resync on reconnect. The initial load above never re-runs, so if the socket
  // drops mid-run (laptop sleep, backgrounded tab) the agent keeps going and
  // persists its final message server-side, but the reconnected client never
  // refetches it and sits on a stale "typing" state. On every genuine
  // reconnect edge we re-pull chat.history, the authoritative record. The
  // history/resynced reducer case preserves a message streaming on the new
  // socket and otherwise clears the typing indicator.
  const resync = (onlyIfEnded = false) =>
    resyncHistory({ rpc, dispatch: dispatchAny, parseUserText: parse() }, onlyIfEnded);
  let everConnected = false;
  let prevConnected = false;
  watch(
    [connected, () => state.value.history.loaded],
    ([isConnected, loaded]) => {
      const wasConnected = prevConnected;
      prevConnected = isConnected;
      if (!isConnected || !loaded) return;
      if (!everConnected) {
        // First connect: the initial-load watcher owns this one.
        everConnected = true;
        return;
      }
      if (wasConnected) return; // re-render while already connected, not an edge
      resync();
    },
    { immediate: true },
  );

  // Joined a run this mount did not start. Its end normally arrives as a chat
  // event, but it can end in the gap before this mount listens. The engine's
  // record settles it either way.
  watch(
    () => state.value.history.joinedRun,
    (joined, _old, onCleanup) => {
      if (!joined) return;
      const timer = setInterval(() => resync(true), JOINED_RUN_RESYNC_MS);
      onCleanup(() => clearInterval(timer));
    },
    { immediate: true },
  );

  // ── Gateway events ──────────────────────────────────────────────────────

  let unbind: Array<() => void> = [];
  onMounted(() => {
    unbind = [
      bindChatStream({
        on,
        off,
        dispatch: dispatchAny,
        onDelta: () => cfg().voice?.onStreamDelta,
      }),
      bindToolEvents({ on, off, dispatch: dispatchAny }),
    ];
  });
  onBeforeUnmount(() => {
    unbind.forEach((fn) => fn());
    unbind = [];
  });

  // ── Attachments + composer ──────────────────────────────────────────────

  const getRoom = () => handle as unknown as LooseRoom;
  const files = useRoomAttachments({
    agent: () => cfg().agent,
    onFiles: () => cfg().attach?.onFiles as never,
    getRoom,
    composer,
    dispatch: dispatchComposer,
  });

  const setInput = (text: string, opts?: { focus?: boolean }) => {
    dispatchComposer({ type: "input/set", text });
    if (opts?.focus) {
      requestAnimationFrame(() => {
        const el = textareaRef.value;
        el?.focus();
        el?.setSelectionRange(text.length, text.length);
      });
    }
  };

  // Auto-resize the textarea with its content.
  const autosize = () => {
    const el = textareaRef.value;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };
  watch(input, autosize, { flush: "post" });
  onMounted(autosize);

  // ── Sends ───────────────────────────────────────────────────────────────

  const sendEnv = (): SendEnv => ({
    send: cfg().send as SendEnv["send"],
    rpc,
    dispatch: dispatchAny,
    room: handle as unknown as LooseRoom,
    timezone: resolveTimezone(cfg().user.timezone),
    notify: cfg().notify ?? ((text) => void toast.info(text)),
  });

  const send: RoomApi<R, E, S, A>["send"] = (text, opts) => {
    pinToBottom();
    void runSend(sendEnv(), {
      text,
      attachments: opts?.attachments ?? [],
      attached: opts?.attached ?? [],
      composer: false,
    });
  };

  let submitting = false;
  const submit = () => {
    const c = cfg();
    const text = input.value.trim();
    const hasContent = text.length > 0 || files.images.value.length > 0 || files.pills.value.length > 0;
    if (!hasContent || !connected.value || submitting) return;
    if (c.send?.canSend && !c.send.canSend()) return;
    if (c.attach?.canSend && !c.attach.canSend()) return;
    if (text) pinToBottom();
    submitting = true;
    void runSend(sendEnv(), {
      text,
      attachments: files.images.value,
      attached: files.pills.value,
      composer: true,
    })
      .then((out) => {
        // A failed send keeps the draft: "Pick a case first" is useless if the
        // text it refers to is gone.
        if (out.status === "failed") return;
        dispatchComposer({ type: "sent" });
        requestAnimationFrame(() => textareaRef.value?.focus());
      })
      .finally(() => {
        submitting = false;
      });
  };

  const abort = () => {
    rpc("chat.abort", {}).catch(() => {});
    dispatchAny({ type: "stream/aborted" });
  };

  const appendRows = (rows: ChatMessage<R, E>[]) => {
    for (const message of rows) dispatchAny({ type: "message/appended", message } as AnyAction);
  };

  const rewind = (msgId: string) => {
    const text = rewindText(state.value.messages as ChatMessage<string, object>[], msgId);
    if (text) setInput(text, { focus: true });
  };

  const onInputChange = (text: string) => {
    dispatchComposer({ type: "input/set", text });
    cfg().composer?.onInput?.(text, handle);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const host = cfg().composer?.onKeyDown;
    routeKey<KeyboardEvent>(host && ((ev) => host(ev, handle)), e, submit);
  };

  const handle = {
    get state() {
      return state.value;
    },
    dispatch,
    send,
    appendRows,
    abort,
    get input() {
      return input.value;
    },
    setInput,
    attach: files.attach,
    get connected() {
      return connected.value;
    },
    rpc,
    on,
    off,
    get config() {
      return cfg();
    },
    textareaRef,
    conversationRef,
    pinToBottom,
    files,
    onInputChange,
    onKeyDown,
    submit,
    rewind,
  } as unknown as ChatRoomHandle<R, E, S, A, X>;

  // initialPrompt: once, after history has loaded.
  const promptGate = createInitialPromptGate();
  watch(
    [() => state.value.history.loaded, () => cfg().initialPrompt],
    ([loaded, prompt]) => promptGate(loaded, prompt, (text) => handle.send(text)),
    { immediate: true },
  );

  // Runs once, in setup: the host may call composables (watch, onMounted, ...).
  (cfg().useHost ?? (() => {}))(handle);

  return handle;
}
