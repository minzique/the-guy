export const stackOverview = {
  pageTitle: "The Guy",
  tagline: "Agent runtime distribution",
  repoUrl: "https://github.com/minzique/the-guy",
  installCommand:
    "curl -fsSL https://raw.githubusercontent.com/minzique/the-guy/main/install.sh | bash",
  hero: {
    oneLiner: "One payload. Install it natively or sandbox it in Docker. Same pack, same health checks, same repair.",
  },

  // ── visual mode: big picture diagram ──
  envelopes: [
    { id: "native", label: "Native", cmd: "guy install", desc: "Renders into your real home directory", status: "shipped" },
    { id: "sandbox", label: "Docker sandbox", cmd: "guy sandbox start", desc: "Warm container with persistent home", status: "shipped" },
    { id: "remote", label: "Remote exec", cmd: "guy sandbox exec --remote", desc: "Same contract over SSH", status: "next" },
  ],

  // ── visual mode: compact stack tower ──
  stack: [
    { label: "Distribution", items: ["install.sh", "GitHub Releases", "tar.gz bundle"] },
    { label: "CLI", items: ["guy install", "guy doctor", "guy sandbox *"] },
    { label: "Runtime", items: ["@the-guy/core", "@the-guy/doctor", "@the-guy/sandbox"] },
    { label: "Payload", items: ["@the-guy/pi-pack", "profiles/power-user"] },
    { label: "Providers", items: ["pi", "claude", "codex", "docker"] },
  ],

  // ── visual mode: compact flows ──
  nativeFlow: ["resolve bundle", "load profile + pack", "render ~/.pi/**", "write state + doctor log"],
  sandboxFlow: ["rebuild bundle context", "docker build image", "create container + volume", "guy install inside", "warm reattach"],

  // ── technical mode: detailed layers ──
  layers: [
    {
      id: "distribution",
      label: "Distribution",
      what: "install.sh + GitHub Releases",
      how: "A shell script resolves the latest release tarball from GitHub, drops it onto the machine, and installs a launcher at ~/.local/bin/guy. That is the entire job of bash. Everything else is TypeScript.",
    },
    {
      id: "cli",
      label: "CLI surface",
      what: "guy install | status | doctor | repair | auth | sandbox",
      how: "One binary routes every operator flow. No separate daemons, no hidden config UIs. If you can type guy, you can see what the runtime thinks is true.",
    },
    {
      id: "runtime",
      label: "Runtime kernel",
      what: "@the-guy/core, @the-guy/doctor, @the-guy/sandbox",
      how: "Core owns install state, asset rendering, and profile resolution. Doctor turns hidden drift into explicit check results. Sandbox owns the Docker driver contract and warm-container lifecycle.",
    },
    {
      id: "payload",
      label: "Payload",
      what: "@the-guy/pi-pack + profiles/power-user",
      how: "The Pi pack is the canonical home of shipped runtime files — agents, prompts, skills, extensions, settings. Profiles are presets that choose which pack to use and which tools to manage. ~/.pi/** is disposable render output, not a source of truth.",
    },
    {
      id: "envelopes",
      label: "Execution envelopes",
      what: "native home · docker sandbox · (future remote)",
      how: "guy install writes into a real macOS home. guy sandbox start builds the same payload into a Docker container with its own persistent home volume. The future Paperclip remote surface will use the same exec contract without inventing a new packaging model.",
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
        { step: "Run guy install", detail: "The TypeScript runtime resolves the power-user profile and loads the shipped Pi pack." },
        { step: "Render runtime", detail: "Managed assets land in ~/.pi/**; state, logs, backups, and render metadata land in ~/.guy/**." },
        { step: "Verify health", detail: "Doctor checks confirm runtime state, managed assets, Pi readiness, and provider auth handoffs." },
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

  // ── shared: packages ──
  packages: [
    { path: "apps/guy-installer", role: "CLI", desc: "Command routing, routes every user flow through guy." },
    { path: "packages/guy-core", role: "Runtime", desc: "Install state, asset rendering, profile chains, platform detection." },
    { path: "packages/guy-doctor", role: "Health", desc: "Checks runtime state, managed assets, Pi readiness, provider auth." },
    { path: "packages/guy-sandbox", role: "Sandbox", desc: "Docker image build, container lifecycle, warm attach, exec surface." },
    { path: "packages/guy-pi-pack", role: "Payload", desc: "Canonical shipped Pi runtime files — agents, skills, prompts, settings." },
    { path: "packages/guy-profile-schema", role: "Types", desc: "Shared types for profiles, packs, assets, channels, platforms." },
    { path: "packages/guy-auth-*", role: "Auth", desc: "Claude and Codex login/status contracts, kept narrow." },
  ],

  // ── shared: decisions ──
  decisions: [
    { q: "Why one payload?", a: "Native and sandbox should not diverge. One pack, one doctor, one repair path." },
    { q: "Why Docker first?", a: "Fastest to ship. Driver seam exists for OpenShell or VMs later." },
    { q: "Why release notes here?", a: "If the public page doesn't update from the changelog, the story drifts." },
  ],

  footer: "site/content/stack-overview.mjs · site/templates/render-stack-page.mjs · releases from CHANGELOG.md",
};
