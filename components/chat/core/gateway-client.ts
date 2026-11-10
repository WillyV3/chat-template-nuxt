/**
 * Sontara WebSocket RPC v3 gateway client.
 * Ported from ui/src/ui/gateway.ts for use in Next.js React apps.
 *
 * Protocol frames:
 *   Request:  { type: "req", id, method, params? }
 *   Response: { type: "res", id, ok, payload?, error? }
 *   Event:    { type: "event", event, payload?, seq?, stateVersion? }
 *   Handshake: send "connect" RPC -> server responds with type "hello-ok"
 */

// ---- Frame types ----

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  features?: { methods?: string[]; events?: string[] };
  snapshot?: unknown;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: { tickIntervalMs?: number };
};

// ---- Event payload types ----

export type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

/** The `agent` event as the engine emits it (gateway/mod.rs:1879,1885 and
 *  rpc.rs:1194-1217): one frame per tool call and one per result. */
export type AgentEventPayload =
  | { type: "tool_call"; tool: string; arguments?: Record<string, unknown> }
  | { type: "tool_result"; tool: string; output: string; success: boolean; metadata?: Record<string, unknown> | null };

export type ExecApprovalRequestPayload = {
  id: string;
  request: {
    command: string;
    cwd?: string | null;
    host?: string | null;
    security?: string | null;
    ask?: string | null;
    agentId?: string | null;
    resolvedPath?: string | null;
    sessionKey?: string | null;
  };
  createdAtMs: number;
  expiresAtMs: number;
};

export type McpSetupRequestPayload = {
  id: string;
  service: string;
  domain: string;
  description: string;
  requiredEnv: Array<{ name: string; label: string }>;
  createdAtMs: number;
  expiresAtMs: number;
};

// ---- Connection state ----

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

// ---- Client options ----

export type GatewayClientOptions = {
  url: string;
  token?: string;
  /** Which face is connecting — reaches the agent in the connect frame, so it
   *  can say where a message came from. Defaults to web's values.
   *
   *  These three options exist because apps/mobile shipped a 342-line COPY of
   *  this file whose header lists exactly three deviations: this id, the
   *  platform string, and crypto.randomUUID being absent in React Native. All
   *  three are configuration, not a different client — so they are injected
   *  and there is one implementation. A third face (Android) needs no fourth
   *  copy. */
  clientId?: string;
  platform?: string;
  mode?: string;
  /** Request-id generator. Defaults to crypto.randomUUID; React Native has no
   *  crypto.randomUUID on the global, and these ids are NOT security-sensitive
   *  — they only need to be unique per pending RPC — so a face may pass a
   *  plain random generator. */
  generateRequestId?: () => string;
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onClose?: (info: { code: number; reason: string }) => void;
  onGap?: (info: { expected: number; received: number }) => void;
  onBinary?: (data: ArrayBuffer) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

// 4008 = application-defined close code (browser rejects 1008 "Policy Violation")
const CONNECT_FAILED_CLOSE_CODE = 4008;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectNonce: string | null = null;
  private backoffMs = 800;
  private _connectionState: ConnectionState = "disconnected";

  constructor(private opts: GatewayClientOptions) {}

  start() {
    this.closed = false;
    this.setConnectionState("connecting");
    this.connect();
  }

  /**
   * Update the token used in the connect handshake without tearing down
   * the existing WS. The new token is used on the NEXT connect attempt
   * — either when the current WS drops naturally (Cloud Run idle close,
   * network blip) or when the caller explicitly drops it.
   *
   * Background: the JWT minted by /api/agent-token has a 15-minute TTL.
   * The useAgentToken hook refreshes every 14 minutes. Before this
   * method existed, the useGateway hook's effect deps included `token`,
   * so every refresh tore down the GatewayClient and rebuilt it — which
   * meant a fresh WS handshake every 14 min. Users who pressed send
   * during the ~500ms reconnect window got "Failed to send message"
   * because rpc() rejected with "gateway not connected" while the new
   * client was bootstrapping.
   */
  setToken(token: string | undefined) {
    this.opts.token = token;
  }

  stop() {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error("gateway client stopped"));
    this.setConnectionState("disconnected");
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this._connectionState === "connected";
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  private setConnectionState(state: ConnectionState) {
    if (this._connectionState === state) return;
    this._connectionState = state;
    this.opts.onConnectionStateChange?.(state);
  }

  private connect() {
    if (this.closed) return;

    // Normalize URL: https:// -> wss://, http:// -> ws://, append /ws if needed
    let wsUrl = this.opts.url;
    wsUrl = wsUrl.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
    if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
      wsUrl = "wss://" + wsUrl;
    }
    if (!wsUrl.endsWith("/ws")) {
      wsUrl = wsUrl.replace(/\/$/, "") + "/ws";
    }

    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.queueConnect();
    };

    this.ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        this.opts.onBinary?.(ev.data);
        return;
      }
      this.handleMessage(String(ev.data ?? ""));
    };

    this.ws.onclose = (ev) => {
      const reason = String(ev.reason ?? "");
      this.ws = null;
      this.connectSent = false;
      if (this.connectTimer !== null) {
        clearTimeout(this.connectTimer);
        this.connectTimer = null;
      }
      this.flushPending(new Error(`gateway closed (${ev.code}): ${reason}`));
      this.opts.onClose?.({ code: ev.code, reason });
      if (!this.closed) {
        this.setConnectionState("reconnecting");
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // Ignored — close handler fires after every error.
    };
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    setTimeout(() => {
      if (!this.closed) {
        this.setConnectionState("connecting");
        this.connect();
      }
    }, delay);
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }

  private queueConnect() {
    this.connectSent = false;
    this.connectNonce = null;
    if (this.connectTimer !== null) clearTimeout(this.connectTimer);
    // Small delay to allow the server to send a connect.challenge event first.
    // If a challenge arrives before the timer fires, sendConnect() will be
    // triggered by the challenge handler instead.
    this.connectTimer = setTimeout(() => {
      void this.sendConnect();
    }, 750);
  }

  private async sendConnect() {
    if (this.connectSent) return;
    this.connectSent = true;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.opts.clientId ?? "sontara-web",
        version: "1.0",
        platform: this.opts.platform ?? "web",
        mode: this.opts.mode ?? "webchat",
      },
      auth: this.opts.token ? { token: this.opts.token } : undefined,
    };
    if (this.connectNonce) {
      (params as Record<string, unknown>).nonce = this.connectNonce;
      this.connectNonce = null;
    }

    void this.rpc<GatewayHelloOk>("connect", params)
      .then((hello) => {
        this.backoffMs = 800;
        this.setConnectionState("connected");
        this.opts.onHello?.(hello);
      })
      .catch(() => {
        this.ws?.close(CONNECT_FAILED_CLOSE_CODE, "connect failed");
      });
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: unknown };

    if (frame.type === "event") {
      const evt = parsed as GatewayEventFrame;

      // Server sends connect.challenge before the connect RPC on some configs.
      // Respond immediately instead of waiting for the queued timer.
      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: string } | undefined;
        if (payload?.nonce) {
          this.connectNonce = payload.nonce;
        }
        void this.sendConnect();
        return;
      }

      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq > this.lastSeq + 1) {
          this.opts.onGap?.({ expected: this.lastSeq + 1, received: seq });
        }
        this.lastSeq = seq;
      }

      try {
        this.opts.onEvent?.(evt);
      } catch (err) {
        console.error("[gateway] event handler error:", err);
      }
      return;
    }

    if (frame.type === "res") {
      const res = parsed as GatewayResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) return;
      this.pending.delete(res.id);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        const code = res.error?.code ? `[${res.error.code}] ` : "";
        pending.reject(new Error(`${code}${res.error?.message ?? "request failed"}`));
      }
    }
  }

  /** Send raw binary data (e.g. voice PCM) over the WebSocket. */
  sendBinary(data: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  rpc<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = this.opts.generateRequestId?.() ?? crypto.randomUUID();
    const frame = { type: "req", id, method, params };
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });
    });
    this.ws.send(JSON.stringify(frame));
    return p;
  }
}
