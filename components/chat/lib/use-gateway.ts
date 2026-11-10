// The client itself lives in packages/core (2026-08-07): apps/mobile had
// already shipped a 342-line copy of it, so a third face would have been a
// third copy. Web keeps the defaults (sontara-web / platform "web"), so this
// import is the only change here.
import { computed, onMounted, onBeforeUnmount, shallowRef, toValue, watch, type ComputedRef, type MaybeRefOrGetter, type ShallowRef } from "vue";
import {
  GatewayClient,
  type ConnectionState,
  type GatewayEventFrame,
  type GatewayHelloOk,
} from "@/components/chat/core/gateway-client";

export type GatewayHook = {
  connectionState: ShallowRef<ConnectionState>;
  connected: ComputedRef<boolean>;
  hello: ShallowRef<GatewayHelloOk | null>;
  rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  sendBinary: (data: ArrayBuffer) => void;
  /** Payload type is the CALLER's to declare: the gateway multiplexes every
   *  event name over one socket and cannot know each shape. Callers narrow at
   *  the call site (`on<HitlRequest>(...)`, or by the handler's own signature);
   *  `unknown` would force every consumer to re-cast, and `any` erases the
   *  check for all of them. */
  on: <T = unknown>(event: string, handler: (payload: T) => void) => void;
  off: <T = unknown>(event: string, handler: (payload: T) => void) => void;
};

/** How handlers are STORED, payload type erased. Registration casts once, here,
 *  rather than at each of the ~20 call sites. */
type StoredHandler = (payload: unknown) => void;

/**
 * Composable for the Sontara WebSocket RPC v3 gateway.
 *
 * @param url   WebSocket URL (wss://...) or null to stay disconnected.
 * @param token Bearer token for auth or null for unauthenticated.
 */
export function useGateway(
  url: MaybeRefOrGetter<string | null>,
  token: MaybeRefOrGetter<string | null>,
): GatewayHook {
  let client: GatewayClient | null = null;
  const connectionState = shallowRef<ConnectionState>("disconnected");
  const hello = shallowRef<GatewayHelloOk | null>(null);

  // Map of event name -> set of handlers.
  const listeners = new Map<string, Set<StoredHandler>>();

  const dispatchEvent = (evt: GatewayEventFrame) => {
    const handlers = listeners.get(evt.event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(evt.payload);
        } catch (err) {
          console.error("[useGateway] event handler error:", evt.event, err);
        }
      }
    }
    // Also dispatch to wildcard listeners.
    const wildcards = listeners.get("*");
    if (wildcards) {
      for (const handler of wildcards) {
        try {
          handler(evt);
        } catch (err) {
          console.error("[useGateway] wildcard handler error:", err);
        }
      }
    }
  };

  // The socket only runs in the browser: onMounted keeps the server render (and
  // hydration) free of it.
  onMounted(() => {
    // We separately track the LATEST token so a JWT refresh (which happens every
    // 14 min via useAgentToken) doesn't tear down the WebSocket client. Without
    // this split, the url watcher below would re-run on every token change,
    // calling client.stop() and rebuilding: a fresh WS handshake every 14 min
    // and a ~500ms reconnect window where rpc() rejected with "gateway not
    // connected" (the user's "Failed to send message" symptom).
    //
    // The new behavior: the WS only tears down when the URL changes (which is
    // per-instance, rare). Token refreshes call setToken() on the existing
    // client; the new token is used the next time the WS reconnects naturally
    // (Cloud Run idle close, network blip).
    watch(
      () => toValue(token),
      (t) => {
        if (client && t) client.setToken(t);
      },
    );

    // Intentionally NOT watching `token` here: token updates flow through the
    // setToken watcher above to avoid tearing the WS down every 14 minutes on
    // JWT refresh. If a future contributor adds it, the 14-min disconnect storm
    // returns.
    watch(
      () => toValue(url),
      (u) => {
        // Stop previous client if url changed (genuinely different instance),
        // or if url becomes null.
        if (client) {
          client.stop();
          client = null;
        }
        hello.value = null;
        if (!u) {
          connectionState.value = "disconnected";
          return;
        }

        const next = new GatewayClient({
          url: u,
          token: toValue(token) ?? undefined,
          onConnectionStateChange: (state) => {
            connectionState.value = state;
          },
          onHello: (h) => {
            hello.value = h;
          },
          onEvent: (evt) => {
            dispatchEvent(evt);
          },
          onClose: ({ code, reason }) => {
            // Propagate as a synthetic close event so listeners can react.
            const handlers = listeners.get("gateway.close");
            if (handlers) {
              for (const handler of handlers) {
                try {
                  handler({ code, reason });
                } catch (err) {
                  console.error("[useGateway] close handler error:", err);
                }
              }
            }
          },
          onGap: ({ expected, received }) => {
            console.warn(`[useGateway] event gap: expected seq ${expected}, got ${received}`);
          },
        });

        client = next;
        next.start();
      },
      { immediate: true },
    );
  });

  onBeforeUnmount(() => {
    client?.stop();
    client = null;
  });

  const rpc = <T = unknown>(method: string, params?: unknown): Promise<T> => {
    if (!client) return Promise.reject(new Error("gateway not connected"));
    return client.rpc<T>(method, params);
  };

  const sendBinary = (data: ArrayBuffer) => {
    client?.sendBinary(data);
  };

  const on = <T>(event: string, handler: (payload: T) => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler as StoredHandler);
  };

  const off = <T>(event: string, handler: (payload: T) => void) => {
    // Same reference the caller passed to on(): the cast does not change
    // identity, so Set.delete still finds it.
    listeners.get(event)?.delete(handler as StoredHandler);
  };

  return {
    connectionState,
    connected: computed(() => connectionState.value === "connected"),
    hello,
    rpc,
    sendBinary,
    on,
    off,
  };
}
