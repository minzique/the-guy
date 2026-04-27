export const stackOverview = {
  pageTitle: "The Guy",
  tagline: "Agent runtime distribution",
  repoUrl: "https://github.com/minzique/the-guy",
  siteUrl: "https://minzique.github.io/the-guy/",
  installCommand:
    "curl -fsSL https://raw.githubusercontent.com/minzique/the-guy/main/install.sh | bash",
  hero: {
    oneLiner: "One payload. Install it natively or run it in Docker. Same pack, same doctor, same repair path.",
  },

  statusCards: [
    { label: "Native host", value: "macOS", detail: "v0.1 native install writes into your real home directory." },
    { label: "Sandbox", value: "Docker", detail: "Warm local container with a persistent Guy-owned home volume." },
    { label: "Profile", value: "power-user", detail: "The only selectable shipped profile. Guided onboarding is deferred." },
    { label: "Payload", value: "Pi-first", detail: "Agents, prompts, extensions, skills, settings, and vendor browser-tools." },
  ],

  commands: [
    "guy install",
    "guy status",
    "guy doctor [--fix]",
    "guy repair",
    "guy auth claude",
    "guy auth codex",
    "guy sandbox start",
    "guy sandbox status",
    "guy sandbox shell",
    "guy sandbox exec -- <cmd>",
    "guy sandbox stop",
    "guy sandbox doctor",
  ],

  // ── visual mode: big picture diagram ──
  envelopes: [
    { id: "native", label: "Native", cmd: "guy install", desc: "Renders into your real home directory", status: "shipped" },
    { id: "sandbox", label: "Docker sandbox", cmd: "guy sandbox start", desc: "Warm container with persistent home", status: "shipped" },
    { id: "remote", label: "Remote envelope", cmd: "future SSH driver", desc: "Same exec contract, deferred backend", status: "future" },
  ],

  // ── visual mode: compact stack tower ──
  stack: [
    { label: "Distribution", items: ["install.sh", "GitHub Releases", "tar.gz bundle", "Pages"] },
    { label: "CLI", items: ["install", "doctor", "repair", "auth", "sandbox"] },
    { label: "Runtime", items: ["@the-guy/core", "@the-guy/doctor", "@the-guy/sandbox"] },
    { label: "Payload", items: ["@the-guy/pi-pack", "power-user", "vendor-skills"] },
    { label: "Quality", items: ["node:test", "Claude Opus review", "Codex ready"] },
  ],

  // ── visual mode: compact flows ──
  nativeFlow: ["resolve bundle", "load profile + pack", "render ~/.pi/**", "prune stale managed assets", "doctor + repair drift"],
  sandboxFlow: ["rebuild bundle context", "docker build image", "create container + volume", "guy install inside", "warm shell/exec reattach"],

  // ── technical mode: detailed layers ──
  layers: [
    {
      id: "distribution",
      label: "Distribution",
      what: "install.sh + GitHub Releases + Pages",
      how: "A shell script resolves the latest release tarball from GitHub, drops it onto the machine, and installs a launcher at ~/.local/bin/guy. The public site is generated from structured content plus CHANGELOG.md and deployed by GitHub Pages.",
    },
    {
      id: "cli",
      label: "CLI surface",
      what: "guy install | status | doctor | repair | auth | sandbox",
      how: "One binary routes every operator flow. No separate daemons, no hidden config UIs. If you can type guy, you can see what the runtime thinks is true and repair drift when it breaks.",
    },
    {
      id: "runtime",
      label: "Runtime kernel",
      what: "@the-guy/core, @the-guy/doctor, @the-guy/sandbox",
      how: "Core owns install state, asset rendering, stale asset pruning, profile resolution, and pack post-install tasks. Doctor turns hidden drift into explicit check results. Sandbox owns the Docker driver contract and warm-container lifecycle.",
    },
    {
      id: "payload",
      label: "Payload boundary",
      what: "@the-guy/pi-pack + generated profile mirror",
      how: "The Pi pack is the canonical product payload. ~/.pi/** is disposable render output. profiles/power-user/assets is still generated as a founder-compatibility mirror, not the authoring source.",
    },
    {
      id: "source",
      label: "Source of truth",
      what: "dotfiles-agents + pi-curated-skills → guy-pi-pack",
      how: "First-party harness files come from dotfiles-agents/home/.pi/agent. Third-party curated skills come from pi-curated-skills exports. The Guy consumes both through pnpm sync:power-user-payload and records vendor provenance in upstream-skills.manifest.json.",
    },
    {
      id: "envelopes",
      label: "Execution envelopes",
      what: "native home · docker sandbox · future remote",
      how: "guy install writes into a real macOS home. guy sandbox start builds the same payload into a Docker container with its own persistent home volume. Remote execution is a future driver over the same start/status/exec/doctor contract, not a shipped command yet.",
    },
    {
      id: "providers",
      label: "External deps",
      what: "pi · claude · codex · gh · docker",
      how: "Pi is the managed requirement. Claude, Codex, GitHub CLI, and Docker are checked at doctor time but not force-installed. The product tells you what it needs instead of hiding the dependency.",
    },
  ],

  // ── technical mode: detailed flows ──
  detailedFlows: [
    {
      id: "native",
      title: "Native install",
      steps: [
        { step: "Resolve bundle", detail: "install.sh downloads or reuses the release tarball and installs a launcher." },
        { step: "Run guy install", detail: "The TypeScript runtime resolves the power-user profile, loads the shipped Pi pack, and merges pack/profile post-install tasks." },
        { step: "Render runtime", detail: "Managed assets land in ~/.pi/**; state, logs, backups, and render metadata land in ~/.guy/**." },
        { step: "Prune stale assets", detail: "Files that used to be managed but disappeared from the next payload are removed during install." },
        { step: "Verify health", detail: "Doctor checks confirm runtime state, managed assets, Pi readiness, platform support, and provider auth handoffs." },
      ],
    },
    {
      id: "sandbox",
      title: "Docker sandbox",
      steps: [
        { step: "Start sandbox", detail: "guy sandbox start rebuilds a bundle-style image context from the current repo or installed release." },
        { step: "Build image", detail: "Docker bakes the runtime bundle plus Pi into an image tagged for the current version." },
        { step: "Warm container", detail: "A named container and persistent home volume come up with the repo mounted as /workspace." },
        { step: "Bootstrap inside", detail: "The container runs guy install or guy repair in its own home so the sandbox stays self-consistent." },
        { step: "Operate", detail: "Humans use shell; automation and future control planes use exec, status, and doctor." },
      ],
    },
    {
      id: "payload-sync",
      title: "Payload sync",
      steps: [
        { step: "Update source", detail: "First-party changes land in dotfiles-agents; curated third-party skills land in pi-curated-skills." },
        { step: "Render curated skills", detail: "pi-curated-skills produces exported skill payloads plus provenance metadata." },
        { step: "Sync into The Guy", detail: "pnpm sync:power-user-payload copies allowed source paths into packages/guy-pi-pack and mirrors them into profiles/power-user/assets." },
        { step: "Verify", detail: "pnpm test checks the pack manifest, post-install tasks, schema, runtime, CLI, and sandbox driver." },
      ],
    },
    {
      id: "release",
      title: "Release + site publish",
      steps: [
        { step: "Tag release", detail: "GitHub Actions runs tests, builds the bundle, publishes assets, and creates release notes." },
        { step: "Refresh changelog", detail: "The release workflow writes release notes back into CHANGELOG.md." },
        { step: "Rebuild this page", detail: "The site generator re-renders from structured content plus the latest changelog entries." },
        { step: "Deploy", detail: "GitHub Pages publishes the architecture story and release ledger without manual editing." },
      ],
    },
  ],

  payload: {
    sourceTruth: [
      { label: "First-party harness", value: "dotfiles-agents/home/.pi/agent", detail: "AGENTS.md, settings, agents, prompts, selected extensions, and first-party skills." },
      { label: "Curated vendor skills", value: "pi-curated-skills/exports", detail: "Generated third-party skills with provenance and post-install metadata." },
      { label: "Product payload", value: "packages/guy-pi-pack/assets", detail: "Generated consumer copy that ships in The Guy bundles." },
      { label: "Legacy mirror", value: "profiles/power-user/assets", detail: "Generated fallback mirror kept until all consumers use the pack boundary." },
    ],
    shipped: [
      { label: "Agents", items: ["scout", "planner", "reviewer", "worker"] },
      { label: "Prompts", items: ["feature", "scout-and-plan", "implement", "implement-and-review", "worktree"] },
      { label: "Extensions", items: ["context-awareness", "session-browser", "subagent"] },
      { label: "Skills", items: ["clean-code", "code-reviewer", "debug", "dev-rfc", "exec-plan", "find-skills", "humanizer", "refactor", "shell", "team-debate", "think", "visual-explainer", "worktree", "x-cli"] },
      { label: "Vendor", items: ["browser-tools", "npm ci post-install", "MIT provenance", "replaces agent-browser"] },
    ],
  },

  docs: [
    { label: "Pack boundary", href: "https://github.com/minzique/the-guy/blob/main/docs/rfcs/RFC-003-pack-owned-pi-payloads-and-overrides.md", desc: "Why the Pi payload lives in a pack and ~/.pi is render output." },
    { label: "Dual runtime", href: "https://github.com/minzique/the-guy/blob/main/docs/rfcs/RFC-004-dual-runtime-native-and-docker-sandbox.md", desc: "Native install, local Docker sandbox, and the future remote driver contract." },
    { label: "Payload sync", href: "https://github.com/minzique/the-guy/blob/main/docs/payload-sync.md", desc: "How dotfiles-agents and curated skills flow into The Guy." },
  ],

  // ── shared: packages ──
  packages: [
    { path: "apps/guy-installer", role: "CLI", desc: "Command routing, routes every user flow through guy." },
    { path: "packages/guy-core", role: "Runtime", desc: "Install state, asset rendering, stale asset pruning, profile chains, post-install tasks." },
    { path: "packages/guy-doctor", role: "Health", desc: "Checks runtime state, managed assets, Pi readiness, provider auth." },
    { path: "packages/guy-sandbox", role: "Sandbox", desc: "Docker image build, container lifecycle, warm attach, exec surface." },
    { path: "packages/guy-pi-pack", role: "Payload", desc: "Canonical shipped Pi runtime files — agents, skills, prompts, settings." },
    { path: "packages/guy-profile-schema", role: "Types", desc: "Shared types for profiles, packs, assets, channels, platforms." },
    { path: "packages/guy-auth-*", role: "Auth", desc: "Claude and Codex login/status contracts, kept narrow." },
    { path: ".github/workflows", role: "Quality", desc: "Release, Pages, Claude Opus review, and Codex review-ready automation." },
  ],

  // ── shared: decisions ──
  decisions: [
    { q: "Why one payload?", a: "Native and sandbox should not diverge. One pack, one doctor, one repair path." },
    { q: "Why Docker first?", a: "Fastest to ship. Driver seam exists for SSH, OpenShell, or VMs later." },
    { q: "Why not sync ~/.pi directly?", a: "Rendered files drift. The product payload must be reproducible from source repos plus explicit metadata." },
    { q: "Why vendor-skills?", a: "Third-party skills need provenance and dependency setup without pretending The Guy authored them." },
    { q: "Why release notes here?", a: "If the public page doesn't update from the changelog, the story drifts." },
  ],

  footer: "site/content/stack-overview.mjs · site/templates/render-stack-page.mjs · releases from CHANGELOG.md · payload from docs/payload-sync.md",
};
