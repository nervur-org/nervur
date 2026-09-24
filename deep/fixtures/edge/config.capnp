# The edge's run on workerd: one Worker, one Durable Object namespace kept
# on disk as `wrangler dev` keeps it, and an outbound network that reaches
# this machine, since the carry suite's listeners stand on localhost. The
# run copies this file beside the bundle it builds and starts workerd
# there, so `store` is a folder beside them.
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "edge", worker = .edge),
    (name = "internet", network = (allow = ["public", "private", "local"])),
    (name = "store", disk = (path = "store", writable = true)),
  ],
  sockets = [(name = "http", address = "127.0.0.1:0", http = (), service = "edge")],
);

const edge :Workerd.Worker = (
  modules = [(name = "bodies.js", esModule = embed "bodies.js")],
  compatibilityDate = "2026-09-01",
  durableObjectNamespaces = [(className = "Bodies", uniqueKey = "nervur-edge-bodies", enableSql = true)],
  durableObjectStorage = (localDisk = "store"),
  bindings = [(name = "BODIES", durableObjectNamespace = "Bodies")],
  globalOutbound = "internet",
);
