# The family's station on workerd, as `wrangler dev` runs a Worker: its one
# Durable Object namespace kept on disk in `store`, so an object killed and
# started again finds what it wrote, and an outbound network that reaches
# this machine. The run copies this file beside the bundle and starts
# workerd there, naming the station's address in its environment once it
# has chosen the port. The two secrets stand here because the run is
# local; a deploy sets them as Worker secrets.
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "station", worker = .station),
    (name = "internet", network = (allow = ["public", "private", "local"])),
    (name = "store", disk = (path = "store", writable = true)),
  ],
  sockets = [(name = "http", address = "127.0.0.1:0", http = (), service = "station")],
);

const station :Workerd.Worker = (
  modules = [(name = "station.js", esModule = embed "station.js")],
  compatibilityDate = "2026-09-01",
  durableObjectNamespaces = [(className = "Ground", uniqueKey = "nervur-edge-station", enableSql = true)],
  durableObjectStorage = (localDisk = "store"),
  bindings = [
    (name = "GROUND", durableObjectNamespace = "Ground"),
    (name = "NERVUR_SECRET", text = "5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e"),
    (name = "NERVUR_HAND", text = "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1"),
    (name = "NERVUR_ALLOW_PRIVATE", text = "1"),
    (name = "NERVUR_ADDRESSES", fromEnvironment = "NERVUR_ADDRESSES"),
  ],
  globalOutbound = "internet",
);
