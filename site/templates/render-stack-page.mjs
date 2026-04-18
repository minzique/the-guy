function esc(v) {
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function inlineMd(t) {
  return esc(t).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
}
function mdBlocks(md) {
  const lines = md.split(/\r?\n/), out = []; let p = [], li = [];
  const fP = () => { if (p.length) { out.push(`<p>${inlineMd(p.join(" "))}</p>`); p = []; } };
  const fL = () => { if (li.length) { out.push(`<ul>${li.map(i=>`<li>${inlineMd(i)}</li>`).join("")}</ul>`); li = []; } };
  for (const raw of lines) { const l = raw.trim();
    if (!l) { fP(); fL(); continue; }
    const hm = l.match(/^(###|####)\s+(.*)$/);
    if (hm) { fP(); fL(); out.push(`<${hm[1]==="###"?"h4":"h5"}>${inlineMd(hm[2])}</${hm[1]==="###"?"h4":"h5"}>`); continue; }
    const lm = l.match(/^[-*]\s+(.*)$/);
    if (lm) { fP(); li.push(lm[1]); continue; }
    p.push(l);
  }
  fP(); fL(); return out.join("\n");
}

export function renderStackPage(content, releases, meta) {
  const nav = [["architecture","stack"],["flows","flows"],["packages","packages"],["decisions","bets"],["releases","releases"]];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(content.pageTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500;6..72,600&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
/* ── reset ── */
*,*::before,*::after{box-sizing:border-box}
:root{
  --bg:#faf7f2;--text:#1a1815;--dim:#79736b;--faint:#b0a99f;
  --line:#e5e1da;--line-sub:#edeae4;
  --accent:#c24b2b;--accent-dim:#d4775f;--accent-bg:#fdf1ec;
  --code-bg:#f2efea;--code-border:#e2ded7;
  --col:min(880px,calc(100% - 48px));--wide:min(1100px,calc(100% - 48px));
}
@media(prefers-color-scheme:dark){:root{
  --bg:#161311;--text:#e4e0da;--dim:#9e978e;--faint:#685f54;
  --line:#2a2622;--line-sub:#211e1b;
  --accent:#e8764e;--accent-dim:#b85a3c;--accent-bg:rgba(232,118,78,.07);
  --code-bg:#1d1a17;--code-border:#2a2622;
}}
html{scroll-behavior:smooth}
body{
  margin:0;font:400 1.0625rem/1.7 "DM Sans",system-ui,sans-serif;
  color:var(--text);background:var(--bg);
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
a{color:var(--accent);text-underline-offset:.2em;text-decoration-thickness:1px}
a:hover{text-decoration-thickness:2px}
code{font:400 .84em/.95 "JetBrains Mono",monospace;background:var(--code-bg);border:1px solid var(--code-border);padding:.15em .4em;border-radius:5px;white-space:nowrap}
h1,h2,h3,h4{margin:0;letter-spacing:-.025em}
h1,h2{font-family:"Newsreader",Georgia,serif;font-weight:400}
h1{font-size:clamp(3rem,6vw,4.8rem);line-height:1;font-weight:300}
h2{font-size:clamp(1.5rem,2.6vw,2rem);line-height:1.15}
h3{font:600 .95rem "DM Sans",sans-serif}
p{margin:0}
.col{width:var(--col);margin:0 auto}
.wide{width:var(--wide);margin:0 auto}

/* ── view switching ── */
[data-view=overview] .only-tech,
[data-view=technical] .only-over{
  opacity:0;height:0;overflow:hidden;pointer-events:none;margin:0;padding:0;border:none;
}

/* ── header ── */
header{
  position:sticky;top:0;z-index:10;
  background:color-mix(in srgb,var(--bg) 92%,transparent);
  backdrop-filter:blur(14px);border-bottom:1px solid var(--line);
}
.mast{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;flex-wrap:wrap}
.mast-left{display:flex;align-items:baseline;gap:10px;min-width:0}
.mast-name{font:600 1rem "DM Sans",sans-serif;letter-spacing:-.03em;text-decoration:none;color:var(--text)}
.mast-tag{font:400 .7rem "JetBrains Mono",monospace;color:var(--faint);white-space:nowrap}
.mast-right{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.mast-nav{display:flex;gap:2px}
.mast-nav a{font-size:.82rem;text-decoration:none;color:var(--dim);padding:5px 9px;border-radius:7px;transition:color .15s,background .15s}
.mast-nav a:hover{color:var(--text);background:var(--code-bg)}

/* ── toggle ── */
.toggle{
  position:relative;display:inline-flex;
  border:1px solid var(--line);border-radius:9px;
  font:500 .72rem "JetBrains Mono",monospace;
  padding:3px;gap:2px;
}
.toggle button{
  position:relative;z-index:1;
  background:none;border:none;padding:5px 14px;cursor:pointer;
  color:var(--dim);font:inherit;border-radius:6px;
  transition:color .2s;
}
.toggle button:hover{color:var(--text)}
.toggle button.active{color:var(--bg)}
.toggle-pill{
  position:absolute;top:3px;left:3px;
  height:calc(100% - 6px);border-radius:6px;
  background:var(--accent);
  transition:transform .28s cubic-bezier(.25,1,.5,1),width .28s cubic-bezier(.25,1,.5,1);
  pointer-events:none;
}

/* ── hero ── */
.hero{padding:clamp(56px,10vw,100px) 0 clamp(40px,8vw,72px)}
.hero-sub{color:var(--dim);font-size:clamp(1.05rem,1.6vw,1.2rem);max-width:52ch;margin:20px 0 0;line-height:1.6}
.install-bar{
  margin-top:32px;padding:14px 18px;
  background:var(--code-bg);border:1px solid var(--code-border);border-radius:10px;
  font:400 .82rem "JetBrains Mono",monospace;overflow-x:auto;white-space:nowrap;
  transition:border-color .2s;
}
.install-bar:hover{border-color:var(--accent-dim)}
.install-bar::before{content:"$ ";color:var(--faint)}

/* ── sections ── */
section{padding:clamp(48px,8vw,80px) 0}
section+section{border-top:1px solid var(--line)}
.s-sub{color:var(--dim);max-width:46ch;margin-bottom:36px;font-size:.95rem;line-height:1.65}

/* ═══ OVERVIEW: BIG PICTURE ═══ */
.diagram{display:flex;flex-direction:column;align-items:center;gap:0;padding:12px 0 0}
.d-node{
  padding:14px 32px;border-radius:12px;text-align:center;
  font:500 .82rem "JetBrains Mono",monospace;
  transition:transform .2s cubic-bezier(.25,1,.5,1),box-shadow .2s;
}
.d-node:hover{transform:translateY(-2px)}
.d-bundle{background:var(--code-bg);border:1px solid var(--code-border);color:var(--text)}
.d-cli{background:var(--accent-bg);border:2px solid var(--accent);color:var(--accent);font-weight:600}
.d-cli:hover{box-shadow:0 4px 20px color-mix(in srgb,var(--accent) 18%,transparent)}
.d-connector{width:2px;height:28px;background:var(--line);position:relative}
.d-connector::after{
  content:"";position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);
  border:5px solid transparent;border-top:6px solid var(--line);
}
.d-fan{
  display:flex;align-items:flex-start;gap:0;width:100%;max-width:700px;
  position:relative;padding-top:24px;
}
.d-fan::before{
  content:"";position:absolute;top:0;left:calc(50% - 1px);
  width:2px;height:12px;background:var(--line);
}
.d-fan::after{
  content:"";position:absolute;top:12px;
  left:calc(16.667% + 8px);right:calc(16.667% + 8px);
  height:2px;background:var(--line);
}
.d-branch{
  flex:1;display:flex;flex-direction:column;align-items:center;
  position:relative;padding-top:14px;
}
.d-branch::before{
  content:"";position:absolute;top:0;left:50%;
  width:2px;height:14px;background:var(--line);transform:translateX(-1px);
}
.d-env{
  padding:20px 16px;border-radius:12px;text-align:center;
  border:1px solid var(--line);width:100%;max-width:210px;
  transition:border-color .2s,transform .2s cubic-bezier(.25,1,.5,1);
}
.d-env:hover{border-color:var(--accent-dim);transform:translateY(-2px)}
.d-env-label{font:600 .82rem "DM Sans",sans-serif;letter-spacing:-.01em;margin-bottom:6px}
.d-env-cmd{font:400 .72rem "JetBrains Mono",monospace;color:var(--dim);margin-bottom:6px}
.d-env-desc{font-size:.82rem;color:var(--dim);line-height:1.45}
.d-env-status{
  display:inline-block;margin-top:10px;
  font:500 .64rem "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.12em;
  padding:3px 10px;border-radius:99px;
}
.d-env--shipped .d-env-status{background:color-mix(in srgb,var(--green) 12%,transparent);color:var(--green)}
.d-env--next .d-env-status{background:color-mix(in srgb,var(--faint) 15%,transparent);color:var(--faint)}

/* ═══ OVERVIEW: STACK TOWER ═══ */
.tower{display:grid;gap:3px;max-width:580px}
.tower-row{
  display:grid;grid-template-columns:110px 1fr;
  border-radius:10px;overflow:hidden;
  border:1px solid var(--line);
  transition:border-color .15s;
}
.tower-row:hover{border-color:var(--accent-dim)}
.tower-label{
  font:500 .68rem "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.1em;
  padding:12px 14px;color:var(--accent);background:var(--accent-bg);
  display:flex;align-items:center;
}
.tower-items{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px;align-items:center}
.tower-chip{
  font:400 .74rem "JetBrains Mono",monospace;
  padding:4px 10px;border-radius:6px;
  background:var(--code-bg);border:1px solid var(--code-border);color:var(--text);
}

/* ═══ OVERVIEW: COMPACT FLOWS ═══ */
.flow-pair{display:grid;grid-template-columns:1fr 1fr;gap:36px}
@media(max-width:680px){.flow-pair{grid-template-columns:1fr}}
.flow-label{font:600 .75rem "JetBrains Mono",monospace;color:var(--accent);text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px}
.flow-track{padding-left:22px;border-left:2px solid var(--line)}
.flow-sc{padding:10px 0;font-size:.88rem;position:relative}
.flow-sc::before{
  content:"";position:absolute;left:-27px;top:16px;
  width:8px;height:8px;border-radius:50%;
  border:2px solid var(--accent);background:var(--bg);
  transition:background .15s;
}
.flow-sc:hover::before{background:var(--accent)}

/* ═══ TECHNICAL: DETAILED LAYERS ═══ */
.layer-list{margin-left:22px;padding-left:30px;border-left:2px solid var(--line)}
.layer{padding:24px 0}
.layer+.layer{border-top:1px solid var(--line-sub)}
.layer-dot{
  width:12px;height:12px;border-radius:50%;
  background:var(--bg);border:2px solid var(--accent);
  margin-left:-37px;margin-bottom:-24px;position:relative;top:6px;
  transition:background .2s;
}
.layer:hover .layer-dot{background:var(--accent)}
.layer-label{
  font:500 .72rem "JetBrains Mono",monospace;
  text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin-bottom:6px;
}
.layer-what{font:600 1.05rem "DM Sans",sans-serif;margin-bottom:8px;letter-spacing:-.01em}
.layer-how{color:var(--dim);font-size:.94rem;line-height:1.65;max-width:60ch}

/* ═══ TECHNICAL: DETAILED FLOWS ═══ */
.dflows{display:grid;gap:44px}
.df-title{font:600 1.05rem "DM Sans",sans-serif;margin-bottom:16px;letter-spacing:-.01em}
.df-steps{display:grid;gap:0}
.df-step{
  display:grid;grid-template-columns:170px 1fr;gap:20px;
  padding:12px 0;border-bottom:1px solid var(--line-sub);font-size:.92rem;
  transition:background .15s;
}
.df-step:last-child{border-bottom:none}
.df-step:hover{background:var(--accent-bg);margin:0 -12px;padding-left:12px;padding-right:12px;border-radius:8px}
.df-step-name{font:500 .92rem "DM Sans",sans-serif}
.df-step-detail{color:var(--dim);line-height:1.55}
@media(max-width:600px){.df-step{grid-template-columns:1fr}}

/* ═══ PACKAGES ═══ */
.pkg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:4px}
.pkg{
  padding:16px 18px;background:var(--code-bg);border-radius:10px;
  border:1px solid transparent;
  transition:border-color .15s,transform .2s cubic-bezier(.25,1,.5,1);
}
.pkg:hover{border-color:var(--code-border);transform:translateY(-1px)}
.pkg-role{font:500 .66rem "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin-bottom:3px}
.pkg-path{font:500 .8rem "JetBrains Mono",monospace;color:var(--text);margin-bottom:5px}
.pkg-desc{font-size:.84rem;color:var(--dim);line-height:1.5}

/* ═══ DECISIONS ═══ */
.decs{display:grid;gap:0}
.dec{
  display:grid;grid-template-columns:200px 1fr;gap:20px;
  padding:18px 0;border-bottom:1px solid var(--line-sub);
}
.dec:last-child{border-bottom:none}
.dec-q{font:500 .96rem "DM Sans",sans-serif;letter-spacing:-.01em}
.dec-a{color:var(--dim);font-size:.92rem;line-height:1.6}
@media(max-width:600px){.dec{grid-template-columns:1fr}}

/* ═══ RELEASES ═══ */
.rel-list{display:grid;gap:0}
.rel{padding:24px 0;border-bottom:1px solid var(--line-sub)}
.rel:last-child{border-bottom:none}
.rel-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.rel-head a{font:600 1.05rem "DM Sans",sans-serif;letter-spacing:-.01em}
.rel-date{font:400 .74rem "JetBrains Mono",monospace;color:var(--faint)}
.rel-diff{font-size:.82rem;color:var(--faint);text-decoration:none;transition:color .15s}
.rel-diff:hover{color:var(--accent)}
.rel-body{color:var(--dim);font-size:.92rem;line-height:1.6}
.rel-body p{margin-top:6px}
.rel-body ul{margin:8px 0 0;padding-left:1.2em}
.rel-body li+li{margin-top:4px}

/* ── footer ── */
footer{padding:36px 0;border-top:1px solid var(--line)}
.foot{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap}
.foot-note{color:var(--faint);font-size:.78rem;font-family:"JetBrains Mono",monospace;max-width:60ch}
.foot-top{font-size:.82rem;text-decoration:none;color:var(--dim)}
.foot-top:hover{color:var(--accent)}

/* ── motion ── */
@media(prefers-reduced-motion:no-preference){
  .reveal{opacity:0;transform:translateY(12px);transition:opacity .5s cubic-bezier(.25,1,.5,1),transform .5s cubic-bezier(.25,1,.5,1)}
  .reveal.visible{opacity:1;transform:none}
  .reveal:nth-child(2){transition-delay:40ms}
  .reveal:nth-child(3){transition-delay:80ms}
  .reveal:nth-child(4){transition-delay:120ms}
}

/* ── responsive ── */
@media(max-width:720px){
  .d-fan{flex-direction:column;align-items:center;gap:12px;padding-top:0}
  .d-fan::before,.d-fan::after,.d-branch::before{display:none}
  .d-branch{padding-top:0}
  .d-env{max-width:280px}
  .mast-nav{display:none}
}
</style>
</head>
<body>

<div data-view="overview" id="app">

<header>
<div class="col mast">
  <div class="mast-left">
    <a href="#top" class="mast-name">the-guy</a>
    <span class="mast-tag">${esc(content.tagline)}</span>
  </div>
  <div class="mast-right">
    <div class="toggle" role="group" aria-label="View mode">
      <div class="toggle-pill"></div>
      <button class="active" data-mode="overview">overview</button>
      <button data-mode="technical">technical</button>
    </div>
    <nav class="mast-nav">
      ${nav.map(([id,label]) => `<a href="#${id}">${label}</a>`).join("")}
      <a href="${esc(content.repoUrl)}">repo ↗</a>
    </nav>
  </div>
</div>
</header>

<div class="col hero" id="top">
  <h1 class="reveal">${esc(content.pageTitle)}</h1>
  <p class="hero-sub reveal">${esc(content.hero.oneLiner)}</p>
  <div class="install-bar reveal">${esc(content.installCommand)}</div>
</div>

<!-- ═══ ARCHITECTURE ═══ -->
<section id="architecture">
<div class="col">

  <div class="only-over">
    <h2 class="reveal">Big picture</h2>
    <p class="s-sub reveal">One release bundle, one CLI, three places to run it.</p>
    <div class="diagram reveal">
      <div class="d-node d-bundle">release bundle</div>
      <div class="d-connector"></div>
      <div class="d-node d-cli">guy</div>
      <div class="d-connector"></div>
      <div class="d-fan">
        ${content.envelopes.map(e => `
          <div class="d-branch">
            <div class="d-env d-env--${esc(e.status)}">
              <div class="d-env-label">${esc(e.label)}</div>
              <div class="d-env-cmd">${esc(e.cmd)}</div>
              <div class="d-env-desc">${esc(e.desc)}</div>
              <span class="d-env-status">${esc(e.status)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  </div>

  <div class="only-tech">
    <h2 class="reveal">Stack</h2>
    <p class="s-sub reveal">Six layers, top to bottom.</p>
    <div class="layer-list reveal">
      ${content.layers.map(l => `
        <div class="layer">
          <div class="layer-dot"></div>
          <div class="layer-label">${esc(l.label)}</div>
          <div class="layer-what">${inlineMd(l.what)}</div>
          <div class="layer-how">${esc(l.how)}</div>
        </div>
      `).join("")}
    </div>
  </div>

</div>
</section>

<!-- ═══ OVERVIEW: TOWER ═══ -->
<section class="only-over">
<div class="col">
  <h2 class="reveal">Stack layers</h2>
  <p class="s-sub reveal">Five layers, top to bottom.</p>
  <div class="tower reveal">
    ${content.stack.map(row => `
      <div class="tower-row">
        <div class="tower-label">${esc(row.label)}</div>
        <div class="tower-items">${row.items.map(i => `<span class="tower-chip">${esc(i)}</span>`).join("")}</div>
      </div>
    `).join("")}
  </div>
</div>
</section>

<!-- ═══ FLOWS ═══ -->
<section id="flows">
<div class="col">
  <h2 class="reveal">Flows</h2>

  <div class="only-over">
    <p class="s-sub reveal">Same payload, different envelope.</p>
    <div class="flow-pair reveal">
      <div>
        <div class="flow-label">Native install</div>
        <div class="flow-track">${content.nativeFlow.map(s => `<div class="flow-sc">${inlineMd(s)}</div>`).join("")}</div>
      </div>
      <div>
        <div class="flow-label">Docker sandbox</div>
        <div class="flow-track">${content.sandboxFlow.map(s => `<div class="flow-sc">${inlineMd(s)}</div>`).join("")}</div>
      </div>
    </div>
  </div>

  <div class="only-tech">
    <p class="s-sub reveal">Three paths through the stack, step by step.</p>
    <div class="dflows reveal">
      ${content.detailedFlows.map(f => `
        <div>
          <div class="df-title">${esc(f.title)}</div>
          <div class="df-steps">
            ${f.steps.map(s => `
              <div class="df-step">
                <div class="df-step-name">${esc(s.step)}</div>
                <div class="df-step-detail">${esc(s.detail)}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  </div>

</div>
</section>

<!-- ═══ PACKAGES ═══ -->
<section id="packages">
<div class="wide">
  <h2 class="reveal">Workspace</h2>
  <p class="s-sub reveal">Each package gets one job.</p>
  <div class="pkg-grid reveal">
    ${content.packages.map(p => `
      <div class="pkg">
        <div class="pkg-role">${esc(p.role)}</div>
        <div class="pkg-path">${esc(p.path)}</div>
        <div class="pkg-desc">${esc(p.desc)}</div>
      </div>
    `).join("")}
  </div>
</div>
</section>

<!-- ═══ DECISIONS ═══ -->
<section id="decisions">
<div class="col">
  <h2 class="reveal">Bets</h2>
  <div class="decs reveal">
    ${content.decisions.map(d => `
      <div class="dec">
        <div class="dec-q">${esc(d.q)}</div>
        <div class="dec-a">${esc(d.a)}</div>
      </div>
    `).join("")}
  </div>
</div>
</section>

<!-- ═══ RELEASES ═══ -->
<section id="releases">
<div class="col">
  <h2 class="reveal">Releases</h2>
  <p class="s-sub reveal">Parsed from CHANGELOG.md at build time.</p>
  <div class="rel-list reveal">
    ${releases.length === 0
      ? '<p style="color:var(--dim)">No releases yet.</p>'
      : releases.map(r => `
        <div class="rel">
          <div class="rel-head">
            <a href="${esc(r.url)}">${esc(r.tag)}</a>
            <span class="rel-date">${esc(r.date)}</span>
            <a class="rel-diff" href="${esc(r.fullChangelogUrl)}">diff ↗</a>
          </div>
          <div class="rel-body">${r.htmlBody || "<p>Minimal notes for this version.</p>"}</div>
        </div>
      `).join("")
    }
  </div>
</div>
</section>

<footer>
<div class="col foot">
  <span class="foot-note">${esc(content.footer)} · ${esc(meta.generatedAtLabel)}</span>
  <a class="foot-top" href="#top">back to top ↑</a>
</div>
</footer>

</div>

<script>
(function(){
  /* ── toggle ── */
  const app=document.getElementById("app");
  const btns=[...document.querySelectorAll(".toggle button")];
  const pill=document.querySelector(".toggle-pill");
  const KEY="the-guy-view";

  function measure(btn){
    const r=btn.getBoundingClientRect(),p=btn.parentElement.getBoundingClientRect();
    return{x:r.left-p.left-3,w:r.width};
  }
  function setView(mode){
    app.dataset.view=mode;
    btns.forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
    const active=btns.find(b=>b.dataset.mode===mode);
    if(active&&pill){const m=measure(active);pill.style.width=m.w+"px";pill.style.transform="translateX("+m.x+"px)"}
    try{localStorage.setItem(KEY,mode)}catch{}
  }
  btns.forEach(b=>b.addEventListener("click",()=>setView(b.dataset.mode)));
  try{if(localStorage.getItem(KEY)==="technical")setView("technical");else setView("overview")}catch{setView("overview")}
  window.addEventListener("resize",()=>{const a=btns.find(b=>b.classList.contains("active"));if(a&&pill){const m=measure(a);pill.style.width=m.w+"px";pill.style.transform="translateX("+m.x+"px)"}});

  /* ── scroll reveal ── */
  if(!window.matchMedia("(prefers-reduced-motion:reduce)").matches){
    const obs=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("visible");obs.unobserve(e.target)}})},{threshold:0.12,rootMargin:"0px 0px -40px 0px"});
    document.querySelectorAll(".reveal").forEach(el=>obs.observe(el));
  }else{document.querySelectorAll(".reveal").forEach(el=>el.classList.add("visible"))}
})();
</script>
</body>
</html>`;
}

export { inlineMd as renderInlineMarkdown, mdBlocks as renderMarkdownBlocks };
