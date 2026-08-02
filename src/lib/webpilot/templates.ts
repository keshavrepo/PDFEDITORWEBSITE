/**
 * WebPilot template registry.
 *
 * The template list is product metadata: it tells the new-session menu
 * what is available, what category it belongs to, and what the starter
 * body looks like. Starter bodies are loaded lazily from the runtime
 * so the directory stays small and a session kind never imports a body
 * it does not need.
 *
 * Every registered session ships a blank-template descriptor so the
 * new-session menu has real entries out of the box. Future categories
 * can add richer templates here.
 *
 * Mirrors the SocialPilot / FinancePilot / DevPilot `templates.ts`
 * shape.
 */

import { sessionCategoryOrder } from "./sessions";
import {
  DEFAULT_ASSETS_BODY,
  DEFAULT_CSS_BODY,
  DEFAULT_DASHBOARD_BODY,
  DEFAULT_EXPORT_BODY,
  DEFAULT_HISTORY_BODY,
  DEFAULT_HTML_BODY,
  DEFAULT_IMPORT_BODY,
  DEFAULT_INTELLIGENCE_BODY,
  DEFAULT_JS_BODY,
  DEFAULT_PREVIEW_BODY,
  DEFAULT_PRODUCTIVITY_BODY,
  DEFAULT_PROJECT_HISTORY_BODY,
  DEFAULT_PROJECTS_BODY,
  DEFAULT_SEARCH_BODY,
  DEFAULT_SETTINGS_BODY,
  DEFAULT_TERMINAL_BODY,
  DEFAULT_UTILITIES_BODY,
  DEFAULT_VALIDATION_BODY,
  DEFAULT_WORKSPACE_BODY,
  cloneDashboardBody,
  cloneIntelligenceBody,
  cloneProductivityBody,
  cloneProjectHistoryBody,
  cloneProjectsBody,
  cloneSettingsBody,
  cloneTerminalBody,
} from "./bodies";
import type {
  WebSessionCategory,
  WebSessionKind,
  WebTemplate,
} from "./types";

/**
 * Returns the default body for a session kind.
 *
 * Each registered kind maps to its typed default body so the new-session
 * menu and the runtime both speak the same schema.
 */
export function createBlankBody(kind: WebSessionKind): unknown {
  switch (kind) {
    case "html":
      return { ...DEFAULT_HTML_BODY };
    case "css":
      return { ...DEFAULT_CSS_BODY };
    case "javascript":
      return { ...DEFAULT_JS_BODY };
    case "preview":
      return { ...DEFAULT_PREVIEW_BODY };
    case "history":
      return { ...DEFAULT_HISTORY_BODY };
    case "projects":
      return cloneProjectsBody(DEFAULT_PROJECTS_BODY);
    case "assets":
      return { ...DEFAULT_ASSETS_BODY };
    case "workspace":
      return { ...DEFAULT_WORKSPACE_BODY };
    case "search":
      return { ...DEFAULT_SEARCH_BODY };
    case "utilities":
      return { ...DEFAULT_UTILITIES_BODY };
    case "terminal":
      return cloneTerminalBody(DEFAULT_TERMINAL_BODY);
    case "intelligence":
      return cloneIntelligenceBody(DEFAULT_INTELLIGENCE_BODY);
    case "validation":
      return { ...DEFAULT_VALIDATION_BODY };
    case "export":
      return { ...DEFAULT_EXPORT_BODY };
    case "import":
      return { ...DEFAULT_IMPORT_BODY };
    case "productivity":
      return cloneProductivityBody(DEFAULT_PRODUCTIVITY_BODY);
    case "settings":
      return cloneSettingsBody(DEFAULT_SETTINGS_BODY);
    case "templates":
      return { kind: "templates", note: "" };
    case "project-history":
      return cloneProjectHistoryBody(DEFAULT_PROJECT_HISTORY_BODY);
    case "dashboard-integration":
      return cloneDashboardBody(DEFAULT_DASHBOARD_BODY);
    case "blank":
    case "custom":
    default:
      return {
        kind,
        notes: "",
        fields: {},
      };
  }
}

/**
 * Professional project templates.
 *
 * Each template is a curated, opinionated starting point. The
 * user picks one from the templates surface, the body is built
 * and persisted as a regular WebPilot session, and the user is
 * dropped into the Multi-file Workspace with the new project
 * already loaded.
 *
 * The ten templates mirror the most common LaunchStack use-cases
 * the rest of the platform has shipped for: Landing Page,
 * Portfolio, Business Website, SaaS Landing Page, Dashboard,
 * Blog, Documentation, Login Page, Pricing Page, Contact Page.
 */
export interface ProfessionalProjectTemplate {
  id: string;
  name: string;
  description: string;
  /** Tags used for the templates surface search. */
  tags: string[];
  /** When the template was added. */
  addedAt: string;
  /** Starter body the templates surface builds when the user
   * picks the template. The shape is a `WebProjectsBody` because
   * the templates surface persists its output as a project, not
   * as a flat list of files. */
  build: () => {
    projectName: string;
    description: string;
    files: Array<{
      path: string;
      kind: "html" | "css" | "javascript";
      source: string;
    }>;
    folders: string[];
  };
}

/**
 * Static template descriptors. Starter bodies are loaded from
 * `createBlankBody` so the session stays the single source of truth
 * for its default inputs.
 */
export const templates: WebTemplate[] = [
  {
    id: "web-blank",
    kind: "blank",
    category: "blank",
    name: "Blank session",
    description: "An empty session ready for any future web tool.",
    hasStarter: true,
    highlights: ["Single screen", "Default fields", "Saves as you type"],
  },
  ...sessionCategoryOrder
    .filter((category) => category !== "blank")
    .map<WebTemplate>((category) => ({
      id: `web-${category}`,
      kind: category,
      category,
      name: `${category.charAt(0).toUpperCase()}${category.slice(1)} foundation`,
      description: `A blank ${category} session with the standard fields ready for the future ${category} tool.`,
      hasStarter: true,
      highlights: ["Single screen", "Default fields", "Saves as you type"],
    })),
];

/** Templates for a given session kind, including the session-kind template itself. */
export function templatesForKind(kind: WebSessionKind): WebTemplate[] {
  return templates.filter((template) => template.kind === kind);
}

/** Loads a starter body for a template. */
export function loadTemplateBody(template: WebTemplate): unknown {
  return createBlankBody(template.kind);
}

/** Professional project templates the user can scaffold. */
export const PROFESSIONAL_PROJECT_TEMPLATES: ProfessionalProjectTemplate[] = [
  {
    id: "tpl-landing",
    name: "Landing Page",
    description:
      "Hero, features, social proof and footer. Ready to ship as a single-page marketing site.",
    tags: ["landing", "marketing", "hero", "features"],
    addedAt: "2026-08-02",
    build: () => ({
      projectName: "Landing Page",
      description:
        "A complete landing page with a hero, feature grid, social proof and footer.",
      folders: ["assets"],
      files: [
        {
          path: "index.html",
          kind: "html",
          source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Landing Page</title>
  </head>
  <body>
    <header class="hero">
      <nav>
        <a class="brand" href="#">Brand</a>
        <ul>
          <li><a href="#features">Features</a></li>
          <li><a href="#testimonials">Testimonials</a></li>
          <li><a class="cta" href="#cta">Get started</a></li>
        </ul>
      </nav>
      <h1>Build something people love.</h1>
      <p>A short, sharp tagline that explains what the product does.</p>
      <a class="cta primary" href="#cta">Get started</a>
    </header>
    <section id="features">
      <h2>Features</h2>
      <ul class="grid">
        <li><h3>Fast</h3><p>Built on a modern stack.</p></li>
        <li><h3>Reliable</h3><p>Backed by a 99.9% SLA.</p></li>
        <li><h3>Easy</h3><p>One-click onboarding.</p></li>
      </ul>
    </section>
    <section id="testimonials">
      <h2>Loved by teams</h2>
      <blockquote>“The product paid for itself in a week.” — Acme Inc.</blockquote>
    </section>
    <footer id="cta">
      <p>© Brand</p>
    </footer>
  </body>
</html>
`,
        },
        {
          path: "style.css",
          kind: "css",
          source: `:root {
  --bg: #0f172a;
  --fg: #f8fafc;
  --accent: #38bdf8;
  --muted: #94a3b8;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: var(--bg);
  color: var(--fg);
}

.hero { padding: 6rem 1.5rem; text-align: center; }
.hero h1 { font-size: clamp(2rem, 5vw, 3.5rem); margin: 0 0 1rem; }
.hero p { color: var(--muted); max-width: 36rem; margin: 0 auto 2rem; }
.cta { display: inline-block; padding: 0.75rem 1.25rem; border-radius: 0.5rem; }
.cta.primary { background: var(--accent); color: var(--bg); }
nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; }
nav ul { display: flex; gap: 1rem; list-style: none; padding: 0; }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
section { padding: 4rem 1.5rem; max-width: 64rem; margin: 0 auto; }
`,
        },
        {
          path: "script.js",
          kind: "javascript",
          source: `document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});
`,
        },
      ],
    }),
  },
  {
    id: "tpl-portfolio",
    name: "Portfolio",
    description:
      "Hero, work grid, about, and contact. Tailored for designers and developers.",
    tags: ["portfolio", "work", "showcase", "designer", "developer"],
    addedAt: "2026-08-02",
    build: () => ({
      projectName: "Portfolio",
      description: "A personal portfolio with a hero, work grid, about and contact.",
      folders: ["assets"],
      files: [
        {
          path: "index.html",
          kind: "html",
          source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Portfolio</title>
  </head>
  <body>
    <header><h1>Jane Doe</h1><p>Designer & developer based in Berlin.</p></header>
    <section id="work">
      <h2>Selected work</h2>
      <ul class="grid">
        <li><h3>Project A</h3><p>Case study</p></li>
        <li><h3>Project B</h3><p>Case study</p></li>
        <li><h3>Project C</h3><p>Case study</p></li>
      </ul>
    </section>
    <section id="about"><h2>About</h2><p>Ten years of design and engineering work.</p></section>
    <section id="contact"><h2>Contact</h2><p>hello@example.com</p></section>
  </body>
</html>
`,
        },
        {
          path: "style.css",
          kind: "css",
          source: `body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
header, section { padding: 4rem 1.5rem; max-width: 60rem; margin: 0 auto; }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); padding: 0; }
ul.grid li { list-style: none; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; }
`,
        },
        {
          path: "script.js",
          kind: "javascript",
          source: `// Portfolio — placeholder for any custom behaviour you want to add.
`,
        },
      ],
    }),
  },
  {
    id: "tpl-business",
    name: "Business Website",
    description:
      "Header, services, team, testimonials, and contact — the canonical small-business site.",
    tags: ["business", "services", "team", "contact"],
    addedAt: "2026-08-02",
    build: () => ({
      projectName: "Business Website",
      description: "A canonical small-business site with services, team, testimonials and contact.",
      folders: ["assets"],
      files: [
        {
          path: "index.html",
          kind: "html",
          source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Acme Inc.</title>
  </head>
  <body>
    <header><h1>Acme Inc.</h1><p>Building better businesses since 1999.</p></header>
    <section id="services"><h2>Services</h2><ul><li>Consulting</li><li>Implementation</li><li>Support</li></ul></section>
    <section id="team"><h2>Team</h2><ul><li>Jane — CEO</li><li>Joe — CTO</li></ul></section>
    <section id="testimonials"><h2>Testimonials</h2><blockquote>“Great partner.” — Customer</blockquote></section>
    <section id="contact"><h2>Contact</h2><p>hello@acme.example</p></section>
  </body>
</html>
`,
        },
        {
          path: "style.css",
          kind: "css",
          source: `body { font-family: system-ui, sans-serif; margin: 0; }
header, section { padding: 3rem 1.5rem; max-width: 60rem; margin: 0 auto; }
ul { padding-left: 1.25rem; }
`,
        },
        {
          path: "script.js",
          kind: "javascript",
          source: `// Business — placeholder.
`,
        },
      ],
    }),
  },
  {
    id: "tpl-saas",
    name: "SaaS Landing Page",
    description:
      "Hero, features, pricing, FAQ and final CTA. Optimised for conversion.",
    tags: ["saas", "landing", "pricing", "faq", "conversion"],
    addedAt: "2026-08-02",
    build: () => ({
      projectName: "SaaS Landing Page",
      description: "A conversion-optimised SaaS landing page with hero, features, pricing and FAQ.",
      folders: ["assets"],
      files: [
        {
          path: "index.html",
          kind: "html",
          source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>SaaS — Pro Plan</title>
  </head>
  <body>
    <section class="hero">
      <h1>The all-in-one platform for your team.</h1>
      <p>One subscription. Every tool. Zero glue code.</p>
      <a class="cta" href="#pricing">Start free</a>
    </section>
    <section id="features">
      <h2>Features</h2>
      <ul><li>Realtime collaboration</li><li>Audit log</li><li>SSO</li></ul>
    </section>
    <section id="pricing">
      <h2>Pricing</h2>
      <ul><li><strong>Starter</strong> — $0</li><li><strong>Pro</strong> — $19/mo</li><li><strong>Team</strong> — $49/mo</li></ul>
    </section>
    <section id="faq">
      <h2>FAQ</h2>
      <details><summary>Is there a free plan?</summary><p>Yes — the Starter plan is free forever.</p></details>
      <details><summary>Can I cancel any time?</summary><p>Yes, from the billing page.</p></details>
    </section>
  </body>
</html>
`,
        },
        {
          path: "style.css",
          kind: "css",
          source: `body { font-family: system-ui, sans-serif; margin: 0; }
section { padding: 4rem 1.5rem; max-width: 60rem; margin: 0 auto; }
.cta { display: inline-block; padding: 0.75rem 1.25rem; background: #0ea5e9; color: white; border-radius: 0.5rem; }
details { margin: 0.5rem 0; }
`,
        },
        {
          path: "script.js",
          kind: "javascript",
          source: `document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});
`,
        },
      ],
    }),
  },
  {
    id: "tpl-dashboard",
    name: "Dashboard",
    description:
      "Sidebar, top bar, KPI grid, table, and chart placeholder. The classic app shell.",
    tags: ["dashboard", "admin", "kpi", "table", "chart"],
    addedAt: "2026-08-02",
    build: () => ({
      projectName: "Dashboard",
      description: "A canonical app dashboard with sidebar, top bar, KPI grid, table and chart placeholder.",
      folders: ["assets"],
      files: [
        {
          path: "index.html",
          kind: "html",
          source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Dashboard</title>
  </head>
  <body>
    <aside class="sidebar">
      <h1>App</h1>
      <nav><ul><li>Overview</li><li>Reports</li><li>Settings</li></ul></nav>
    </aside>
    <main>
      <header><h2>Overview</h2></header>
      <section class="kpis">
        <div class="kpi"><h3>Users</h3><p>1,284</p></div>
        <div class="kpi"><h3>Revenue</h3><p>$48,210</p></div>
        <div class="kpi"><h3>Churn</h3><p>2.1%</p></div>
      </section>
      <section>
        <h2>Recent orders</h2>
        <table>
          <thead><tr><th>Order</th><th>Customer</th><th>Total</th></tr></thead>
          <tbody>
            <tr><td>#1001</td><td>Alice</td><td>$120</td></tr>
            <tr><td>#1002</td><td>Bob</td><td>$90</td></tr>
          </tbody>
        </table>
      </section>
      <section>
        <h2>Chart</h2>
        <div class="chart" aria-label="Chart placeholder"></div>
      </section>
    </main>
  </body>
</html>
`,
        },
        {
          path: "style.css",
          kind: "css",
          source: `body { margin: 0; font-family: system-ui, sans-serif; display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.sidebar { padding: 1.5rem; border-right: 1px solid #e5e7eb; }
main { padding: 1.5rem; display: grid; gap: 1.5rem; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
.kpi { padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #e5e7eb; }
.chart { height: 220px; background: #f1f5f9; border-radius: 0.5rem; }
`,
        },
        {
          path: "script.js",
          kind: "javascript",
          source: `// Dashboard — replace the chart placeholder with a real
// implementation when you wire your data source in.
`,
        },
      ],
    }),
  },
  {
    id: "tpl-blog",
    name: "Blog",
    description:
      "Header, post list, post detail placeholder, and a footer. Tuned for a personal blog.",
    tags: ["blog", "post", "writing", "newsletter"],
    addedAt: "2026-08-02",
    build: () => ({
      projectName: "Blog",
      description: "A personal blog with header, post list, post detail and footer.",
      folders: ["assets"],
      files: [
        {
          path: "index.html",
          kind: "html",
          source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Blog</title>
  </head>
  <body>
    <header><h1>The Blog</h1><p>Essays on web development.</p></header>
    <main>
      <article>
        <h2>Post 1</h2>
        <p>An introduction to the WebPilot workspace.</p>
        <a href="#">Read more →</a>
      </article>
      <article>
        <h2>Post 2</h2>
        <p>How to ship a project in 60 seconds.</p>
        <a href="#">Read more →</a>
      </article>
    </main>
    <footer><p>© Blog</p></footer>
  </body>
</html>
`,
        },
        {
          path: "style.css",
          kind: "css",
          source: `body { font-family: system-ui, sans-serif; margin: 0; color: #1f2937; }
header, main, footer { max-width: 60rem; margin: 0 auto; padding: 2rem 1.5rem; }
article { padding: 1.5rem 0; border-bottom: 1px solid #e5e7eb; }
`,
        },
        {
          path: "script.js",
          kind: "javascript",
          source: `// Blog — placeholder.
`,
        },
      ],
    }),
  },
  {
    id: "tpl-documentation",
    name: "Documentation",
    description:
      "Sidebar with sections, article area, table of contents, and a search box.",
    tags: ["docs", "documentation", "reference", "api"],
    addedAt: "2026-08-02",
    build: () => ({
      projectName: "Documentation",
      description: "A documentation site with sidebar, article, table of contents and search box.",
      folders: ["assets"],
      files: [
        {
          path: "index.html",
          kind: "html",
          source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Documentation</title>
  </head>
  <body>
    <aside class="sidebar">
      <h1>Docs</h1>
      <nav>
        <ul>
          <li><a href="#getting-started">Getting started</a></li>
          <li><a href="#guides">Guides</a></li>
          <li><a href="#reference">Reference</a></li>
        </ul>
      </nav>
    </aside>
    <main>
      <input class="search" placeholder="Search the docs…" aria-label="Search the docs" />
      <article>
        <h2 id="getting-started">Getting started</h2>
        <p>Welcome to the docs. Pick a topic from the sidebar.</p>
        <h2 id="guides">Guides</h2>
        <p>Step-by-step guides for common tasks.</p>
        <h2 id="reference">Reference</h2>
        <p>The complete API reference lives here.</p>
      </article>
    </main>
  </body>
</html>
`,
        },
        {
          path: "style.css",
          kind: "css",
          source: `body { margin: 0; font-family: system-ui, sans-serif; display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; }
.sidebar { padding: 1.5rem; border-right: 1px solid #e5e7eb; }
main { padding: 1.5rem; }
.search { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-bottom: 1.5rem; }
`,
        },
        {
          path: "script.js",
          kind: "javascript",
          source: `// Documentation — wire your search index here.
`,
        },
      ],
    }),
  },
  {
    id: "tpl-login",
    name: "Login Page",
    description:
      "Centred card, email and password fields, sign-in button, and a forgot-password link.",
    tags: ["login", "auth", "sign in", "form"],
    addedAt: "2026-08-02",
    build: () => ({
      projectName: "Login Page",
      description: "A clean login page with email, password, sign-in button and forgot-password link.",
      folders: ["assets"],
      files: [
        {
          path: "index.html",
          kind: "html",
          source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Sign in</title>
  </head>
  <body>
    <main class="card">
      <h1>Sign in</h1>
      <form>
        <label>Email <input type="email" required autocomplete="email" /></label>
        <label>Password <input type="password" required autocomplete="current-password" /></label>
        <button type="submit">Sign in</button>
      </form>
      <p><a href="#">Forgot password?</a></p>
    </main>
  </body>
</html>
`,
        },
        {
          path: "style.css",
          kind: "css",
          source: `body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #f8fafc; }
.card { width: min(24rem, 92vw); padding: 2rem; border: 1px solid #e5e7eb; border-radius: 0.75rem; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
form { display: grid; gap: 0.75rem; }
label { display: grid; gap: 0.25rem; font-size: 0.875rem; }
input { padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; }
button { padding: 0.6rem 1rem; background: #0ea5e9; color: white; border: 0; border-radius: 0.5rem; cursor: pointer; }
`,
        },
        {
          path: "script.js",
          kind: "javascript",
          source: `document.querySelector("form").addEventListener("submit", (event) => {
  event.preventDefault();
  console.log("Sign in submitted");
});
`,
        },
      ],
    }),
  },
  {
    id: "tpl-pricing",
    name: "Pricing Page",
    description:
      "Three-tier pricing table with feature comparison, FAQ, and a final CTA.",
    tags: ["pricing", "tiers", "comparison", "faq"],
    addedAt: "2026-08-02",
    build: () => ({
      projectName: "Pricing Page",
      description: "A three-tier pricing table with feature comparison, FAQ and final CTA.",
      folders: ["assets"],
      files: [
        {
          path: "index.html",
          kind: "html",
          source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Pricing</title>
  </head>
  <body>
    <header><h1>Pricing</h1><p>Simple, transparent pricing.</p></header>
    <main>
      <section class="tiers">
        <article><h2>Starter</h2><p><strong>$0</strong>/mo</p><ul><li>1 user</li><li>10 projects</li></ul><button>Choose</button></article>
        <article class="featured"><h2>Pro</h2><p><strong>$19</strong>/mo</p><ul><li>10 users</li><li>Unlimited projects</li><li>Priority support</li></ul><button>Choose</button></article>
        <article><h2>Team</h2><p><strong>$49</strong>/mo</p><ul><li>Unlimited users</li><li>SSO</li><li>Audit log</li></ul><button>Choose</button></article>
      </section>
      <section>
        <h2>FAQ</h2>
        <details><summary>Can I cancel?</summary><p>Yes, from the billing page.</p></details>
        <details><summary>Do you offer a free trial?</summary><p>Yes — 14 days, no credit card.</p></details>
      </section>
    </main>
  </body>
</html>
`,
        },
        {
          path: "style.css",
          kind: "css",
          source: `body { font-family: system-ui, sans-serif; margin: 0; }
header, main { max-width: 64rem; margin: 0 auto; padding: 2rem 1.5rem; }
.tiers { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
article { padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 0.75rem; }
article.featured { border-color: #0ea5e9; box-shadow: 0 1px 4px rgba(14,165,233,0.2); }
button { padding: 0.5rem 1rem; background: #0ea5e9; color: white; border: 0; border-radius: 0.5rem; cursor: pointer; }
`,
        },
        {
          path: "script.js",
          kind: "javascript",
          source: `// Pricing — placeholder.
`,
        },
      ],
    }),
  },
  {
    id: "tpl-contact",
    name: "Contact Page",
    description:
      "Header, contact form with validation, contact details, and a map placeholder.",
    tags: ["contact", "form", "support", "message"],
    addedAt: "2026-08-02",
    build: () => ({
      projectName: "Contact Page",
      description: "A contact page with header, contact form, contact details and a map placeholder.",
      folders: ["assets"],
      files: [
        {
          path: "index.html",
          kind: "html",
          source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Contact</title>
  </head>
  <body>
    <header><h1>Contact</h1><p>We'd love to hear from you.</p></header>
    <main>
      <form>
        <label>Name <input type="text" required /></label>
        <label>Email <input type="email" required /></label>
        <label>Message <textarea required rows="5"></textarea></label>
        <button type="submit">Send</button>
      </form>
      <aside>
        <h2>Details</h2>
        <p>hello@example.com</p>
        <p>+1 555 010 0000</p>
        <div class="map" aria-label="Map placeholder"></div>
      </aside>
    </main>
  </body>
</html>
`,
        },
        {
          path: "style.css",
          kind: "css",
          source: `body { font-family: system-ui, sans-serif; margin: 0; }
header, main { max-width: 64rem; margin: 0 auto; padding: 2rem 1.5rem; }
main { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
form { display: grid; gap: 0.75rem; }
label { display: grid; gap: 0.25rem; font-size: 0.875rem; }
input, textarea { padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; }
button { padding: 0.5rem 1rem; background: #0ea5e9; color: white; border: 0; border-radius: 0.5rem; cursor: pointer; }
.map { height: 220px; background: #f1f5f9; border-radius: 0.5rem; }
`,
        },
        {
          path: "script.js",
          kind: "javascript",
          source: `document.querySelector("form").addEventListener("submit", (event) => {
  event.preventDefault();
  console.log("Contact form submitted");
});
`,
        },
      ],
    }),
  },
];

/**
 * The same ten professional templates, exposed as `WebTemplate`
 * entries the new-session menu can list. Picking one of these from
 * the new-session menu creates a fresh `projects` session whose
 * body is the output of `build()`.
 */
export const PROFESSIONAL_TEMPLATE_DESCRIPTORS: WebTemplate[] =
  PROFESSIONAL_PROJECT_TEMPLATES.map((entry) => ({
    id: `web-tpl-${entry.id}`,
    kind: "templates",
    category: "templates",
    name: entry.name,
    description: entry.description,
    hasStarter: true,
    highlights: entry.tags.slice(0, 4),
  }));

/** Build a `WebProjectsBody` for a given template. The body is the
 * starter content the templates surface persists when the user
 * picks the template from the new-session menu. */
export function buildProjectTemplateBody(
  template: ProfessionalProjectTemplate
): {
  projectName: string;
  description: string;
  files: Array<{
    id: string;
    path: string;
    kind: "html" | "css" | "javascript";
    source: string;
    savedSource: string;
    updatedAt: string;
  }>;
  folders: string[];
} {
  const built = template.build();
  const now = new Date(0).toISOString();
  return {
    projectName: built.projectName,
    description: built.description,
    folders: built.folders,
    files: built.files.map((file: { path: string; kind: "html" | "css" | "javascript"; source: string }) => ({
      id: `file-${file.path}`,
      path: file.path,
      kind: file.kind,
      source: file.source,
      savedSource: "",
      updatedAt: now,
    })),
  };
}
