// The two modules the edge's run names that carry no types of their own:
// the Worker's outbound sockets, and the path of the workerd binary.

declare module 'cloudflare:sockets' {
  export function connect(address: { hostname: string; port: number }): {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;
    readonly opened: Promise<unknown>;
    close(): Promise<void>;
  };
}

// A CommonJS module: Node hands its exports whole as the default, the binary's path under `default`.
declare module 'workerd' {
  const exported: { readonly default: string; readonly compatibilityDate: string };
  export default exported;
}
