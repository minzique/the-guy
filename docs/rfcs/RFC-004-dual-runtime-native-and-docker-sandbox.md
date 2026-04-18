# RFC-004: Dual Runtime Contract for Native Install and Docker Sandbox

| Field | Value |
|-------|-------|
| **Author** | Minzi |
| **Status** | Draft |
| **Created** | 2026-04-18 |
| **Last Updated** | 2026-04-18 |
| **Scope** | The Guy dual-runtime v0 work |
| **Supersedes** | None |
| **Related** | `docs/rfcs/RFC-001-the-guy-managed-agent-harness-distribution.md`, `docs/rfcs/RFC-002-the-guy-v0-1-installer-and-profile-contract.md`, `docs/rfcs/RFC-003-pack-owned-pi-payloads-and-overrides.md`, `docs/exec-plans/active/the-guy-dual-runtime-native-and-sandbox.md` |

## Abstract

This RFC defines the next runtime boundary for **The Guy**: one payload with two execution envelopes.

1. **Native envelope** — `guy install` manages a real local runtime in the user’s home directory.
2. **Sandbox envelope** — `guy sandbox ...` manages an isolated runtime inside a warm Docker container.

The key decision is: **keep one The Guy payload, keep one CLI, and add a Docker-first sandbox driver behind a stable capability contract.** The user-facing product is not “Docker mode vs some other product.” The user-facing product is still The Guy.

For v0, Docker is the only implemented sandbox backend. OpenShell and macOS guest/VM modes remain explicitly deferred backends, not rejected directions.

**Current execution note (2026-04-18):** the first Docker CLI slice is allowed to use a bundle-style runtime image assembled from the current The Guy build output before the later OCI-publish flow exists. That keeps the first sandbox path shippable now while preserving a clean artifact contract later.

## Motivation

`RFC-002` gave The Guy a clean native install/runtime contract. `RFC-003` gave the Pi payload a better ownership boundary. That is enough to ship a local native runtime. It is not enough to answer the next product question:

> How does the same The Guy payload run in a disposable or remotely hosted environment without turning into a different product?

The current native-only shape has three problems:

1. **Freshness and isolation are expensive on macOS.** Real clean-room testing often means a second user, a VM, or a machine reset.
2. **Hosted execution has no contract yet.** Paperclip and other remote control-plane work need a way to start, inspect, exec into, and stop a runtime without pretending to be an interactive local terminal.
3. **The runtime envelope is implicit.** Today “The Guy” mostly means “copy files into my real home directory.” That is too narrow for local isolation, remote workers, or future hardened backends.

The product needs one clean runtime contract that can support:
- founder dogfood on a real host,
- local isolated sessions with fast reattach,
- later remote/container-host execution,
- and later hardened drivers like OpenShell.

## Goals and Non-Goals

**Goals**
- Keep **one The Guy payload** across native and sandbox execution.
- Add a user-visible sandbox surface: `guy sandbox start|status|shell|exec|stop|doctor`.
- Ship a **Docker-first** local sandbox backend with warm-container reattach.
- Express permissions in The Guy terms: workspace access, network access, sandbox home ownership, and future credential forwarding.
- Make the non-interactive execution path clear enough for future Paperclip integration.
- Preserve a clean migration path to later Docker-host-over-SSH and later OpenShell/macOS guest backends.

**Non-Goals**
- Implementing OpenShell in this slice.
- Making macOS guest mode the default sandbox path.
- Building the full remote/Paperclip control plane in this RFC.
- Designing the final OCI publish pipeline in the same document.
- Hiding all Docker details from debugging; the backend is abstracted, but Docker remains an inspectable implementation.

## Core Decisions

### 1. One payload, multiple envelopes

The Guy remains one product boundary:

```text
+-----------------------+
| The Guy payload       |
| - CLI                 |
| - profile manifests   |
| - Pi pack             |
| - doctor/runtime code |
+-----------+-----------+
            |
            +--> native envelope (`guy install`)
            +--> sandbox envelope (`guy sandbox ...`)
            +--> later Paperclip-hosted envelope
```

The payload must not fork into:
- “native The Guy”
- “Docker The Guy”
- “Paperclip The Guy”

Those are envelopes around the same payload, not separate products.

### 2. Docker is the first backend, not the permanent abstraction leak

The first sandbox driver is **local Docker**. That decision is intentionally pragmatic:
- faster to ship than OpenShell-first,
- fast enough for local interactive use with a warm container,
- already understood by founder users,
- and easy to debug when a command fails.

But Docker is not the product contract. The product contract is a **sandbox driver interface** with explicit capabilities.

### 3. Capability model is backend-neutral

The user-facing permission model should not be raw Docker flags. The stable concepts are:

- **workspace access**
  - which host path is mounted into the sandbox
  - read/write vs read-only
- **sandbox home**
  - private Guy-owned runtime home for `~/.guy` and `~/.pi`
- **network**
  - enabled vs later restricted modes
- **credentials**
  - none for v0
  - explicit forwarding hooks later

For the Docker v0 backend, that maps to:
- one bind-mounted workspace path
- one persistent Docker volume for sandbox home
- default Docker networking
- no host credential forwarding by default

### 4. Warm sandbox is a hard product requirement

Cold-start-only sandboxing is not enough. The local UX target is:
- build/bootstrap once,
- keep a named container around,
- reattach quickly with `guy sandbox shell`,
- run one-off commands with `guy sandbox exec -- <cmd>`.

That means v0 uses a long-lived container rather than starting a new container for every command.

### 5. Paperclip needs a machine-friendly exec surface, not an interactive shell hack

The future Paperclip/control-plane seam is not:
- “pretend to be a terminal and scrape it.”

The seam is:
- ensure/start sandbox,
- inspect sandbox status,
- execute a command,
- return exit code + output,
- stop or recycle sandbox.

So the CLI must distinguish:
- **interactive human flow**: `guy sandbox shell`
- **machine flow**: `guy sandbox exec -- <cmd>`

The machine flow becomes the narrow substrate for later remote execution.

### 6. macOS guest mode is later-only

True macOS semantics still matter for some auth and Keychain-sensitive workflows. But macOS guest isolation is too heavy to be the default product path.

So:
- local default = Docker sandbox
- later special/high-isolation mode = macOS guest/VM

### 7. OpenShell is a later hardened driver, not the first shipping dependency

OpenShell remains attractive for stronger policy and isolation. It is not the first dependency because:
- it adds product and operational complexity now,
- it is not the shortest path to a real working CLI,
- and the runtime contract should be proven before hardening-specific backend work expands.

## Detailed Design

### Runtime envelopes

#### Native envelope
- command: `guy install`
- target: real host home directory
- state: `~/.guy/**`
- rendered runtime: `~/.pi/**`
- current v0 host platform: macOS

#### Sandbox envelope
- commands:
  - `guy sandbox start`
  - `guy sandbox status`
  - `guy sandbox shell`
  - `guy sandbox exec -- <cmd>`
  - `guy sandbox stop`
  - `guy sandbox doctor`
- target: a Docker container with a persistent sandbox home
- state on host: sandbox metadata under `~/.guy/sandboxes/**`
- state in sandbox: sandbox-local `~/.guy/**` and `~/.pi/**`
- first implemented backend: local Docker

### Platform model

The product now has two different platform ideas:

1. **Host platform**
   - native v0 install still targets macOS
2. **Runtime platform**
   - sandbox runtime may run inside a Linux container

That means the platform model must allow a The Guy runtime inside a Docker-managed Linux container without pretending that native host support broadened to general Linux desktop support.

The clean label for that runtime target is:
- **`linux-container`**

This is intentionally narrower than “Linux support.” It means:
- supported as a The Guy sandbox runtime target
- not a promise that native host install/support suddenly covers arbitrary Linux machines

### First Docker-backed sandbox shape

```text
host macOS
  |
  +--> `guy sandbox start`
         |
         +--> ensure bundle-style build context exists
         +--> docker build image from The Guy runtime payload
         +--> ensure persistent named container exists
         +--> ensure persistent sandbox-home volume exists
         +--> bootstrap `guy install` / `guy repair` inside container
         +--> keep container warm
```

The first Docker runtime grants:
- current working directory mounted as `/workspace`
- persistent sandbox home volume mounted as `/home/guy`
- default network
- no credential forwarding

### Bootstrap contract for the first CLI slice

The first CLI slice may build the image from a **bundle-style runtime context** assembled from the current The Guy build output.

That means:
- installed release bundles should already contain what the Dockerfile needs,
- repo checkouts may first assemble a local bundle-style context before image build,
- later OCI publishing can reuse the same runtime shape instead of inventing a separate image contract.

This is a bridge, not a fork in product shape.

### State layout

Host-side sandbox metadata should live under The Guy’s existing root:

```text
~/.guy/
  sandboxes/
    default/
      sandbox.json
      bootstrap.log
```

Sandbox-local runtime state remains inside the sandbox home itself:

```text
/home/guy/
  .guy/
    state/
    logs/
    rendered/
  .pi/
    agent/
```

### Driver interface

The first code slice should treat Docker as an implementation of a driver interface that can later grow to include:
- local Docker
- remote Docker-over-SSH
- OpenShell
- VM/macOS guest

Minimum driver responsibilities:
- ensure image/runtime artifact
- ensure sandbox exists
- inspect sandbox
- open interactive shell
- exec non-interactive command
- stop/remove sandbox
- report doctor/debug information

## Alternatives Considered

### Approach A — OpenShell first

**Pros**
- stronger isolation story
- policy controls align well with future hosted use

**Cons**
- slower to ship
- more moving parts for first local UX
- weakens momentum toward a working CLI now

### Approach B — macOS guest/VM first

**Pros**
- real macOS semantics
- useful for certain auth/system-level testing

**Cons**
- too heavy for default use
- slower startup, more operational friction
- bad first wedge for a lightweight sandbox story

### Approach C — Docker first with backend-neutral contract **(recommended)**

**Pros**
- ships quickly
- preserves future backend flexibility
- enables local and later remote flows without a product fork

**Cons**
- weaker isolation than OpenShell/macOS guest
- Linux container semantics differ from native macOS runtime semantics

## Acceptance Criteria

This RFC is successful when the codebase can cleanly support all of the following:
- `guy install` still works unchanged for native macOS usage
- `guy sandbox start` can create a working warm Docker sandbox
- `guy sandbox shell` can reattach to that sandbox with low latency
- `guy sandbox exec -- <cmd>` can run a non-interactive command and return its status cleanly
- the sandbox’s granted workspace/network model is explicit in code and output
- the runtime contract still points to one payload, not separate native vs Docker products
- later remote Docker-host and OpenShell drivers can fit without redesigning the user-facing command surface

## Deferred Work

Explicitly deferred from this RFC:
- remote Docker-over-SSH implementation
- OCI publishing and release workflow updates
- OpenShell backend implementation
- macOS guest backend implementation
- credential forwarding model beyond “none by default”
- multiple named sandboxes and richer capability policy presets

## Risks and Mitigations

### Risk: Docker-first becomes the accidental permanent contract
**Mitigation:** keep capability terms and driver boundaries explicit in code and docs now.

### Risk: Linux container semantics are confused with native Linux host support
**Mitigation:** use the explicit platform label `linux-container` and document that this is a sandbox runtime target, not a broad native Linux promise.

### Risk: image build and runtime payload drift apart
**Mitigation:** build the first image from a bundle-style runtime context that mirrors the shipped payload layout.

### Risk: sandbox startup becomes too slow
**Mitigation:** keep a warm long-lived container and reserve OCI publishing/cache work for the next milestone.
