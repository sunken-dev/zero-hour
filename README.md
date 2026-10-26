# Zero Hour

[![Zero Hour: a 3D bomb case with Morse, Signal, Maze, Coolant, Gears and Resistors modules](site/zero-hour-preview.png)](https://zero-hour.sunken.dev/)

**One team. One bomb. One manual.**

A cooperative bomb defusal game that runs in the browser. One of you inspects a 3D bomb case and defuses its modules; the
other reads the manual and cannot see the bomb. Describe what you see, find the rule, keep talking, keep your cool.

Live at **https://zero-hour.sunken.dev/**

- 20 modules, each rated easy, medium or hard, with a front and, for most, a rear plate on the back of the bomb
- needy modules that keep waking up and need attention until the bomb is defused
- choose a difficulty: modules of that rating come up more often, and the case shows it
- a module explorer to read about every module, try it, and switch modules or optional rear plates on and off
- an optional warning beep as the clock runs down
- a 3D case you turn with the mouse, with hints hidden on all sides
- seeds: the same seed with the same settings gives the same bomb
- a manual built from the same source as the game, also as a PDF
- synthesised sound and three adaptive music tracks that speed up as the clock runs down (no audio files)

The whole game is a single page, `site/index.html`, with no build step and no dependencies at run time.

## Try it

```sh
npm ci
npm run serve        # http://localhost:8080
```

Or just open `site/index.html` in a browser.

## Develop

```
site/                the published site (this folder is what gets deployed)
  index.html         the game, its manual and the embedded PDF manual
  zero-hour-manual.pdf, zero-hour-preview.png, icons, CNAME, robots.txt, sitemap.xml, ...
tools/               build scripts, the Typst template for the PDF manual and its fonts
tests/               tests (node:test)
.github/workflows/   CI and deployment
```

| Command | What it does |
| --- | --- |
| `npm test` | Runs all tests. The browser tests need Chrome: set `CHROME_PATH` to a Chrome or Chromium binary. The PDF tests need [Typst](https://typst.app). |
| `npm run pdf` | Rebuilds the PDF manual from the manual's source and embeds it in `site/index.html`. Needs Chrome and Typst. |
| `npm run build` | Copies `site/` to `dist/` and rebuilds the PDF inside `dist/`. This is what gets published. |
| `npm run icons` | Redraws every favicon and app icon from the logo mark. |
| `npm run preview` | Re-renders the link-preview images (`-- --seed 202` picks the bomb). |
| `npm run serve` | Serves `site/` on port 8080. |

### The manual and its PDF

The manual is generated from the modules' own text (`manual()` and `manualBack()` on each module), so it cannot drift from
the rules. `tools/build-manual-pdf.mjs` reads that same manual from the page in headless Chrome and has Typst typeset it
with `tools/manual.typ` and the fonts in `tools/fonts/`. The PDF is stored inside `index.html` with a fingerprint of the
manual text. Typst stops with an error when a manual uses markup the template does not know: teach `tools/manual.typ` the
new element. CI pins the Typst version; use the same one locally (`typst-version` in `.github/workflows/`) so
`npm run pdf` produces the same file. The game only offers the stored PDF while the fingerprint matches; otherwise its buttons
print a fresh copy from the live manual. After changing any rule or manual text, run `npm run pdf` before committing. A
test fails if you forget, and the deploy workflow rebuilds the PDF anyway.

### Adding a module

A module is one `Modules.register({ ... })` block in `site/index.html`: `id`, `title`, `difficulty`, `create(bomb, r)`,
`mount(root, state, ctl)` and `manual()`, plus optional `mountBack` and `manualBack` for a rear plate, `max` and `needs`. The
front and the rear plate get the same `state` object, so a rear plate can be a working part of the puzzle. The comment above the module
registry describes each field, and there is a template just before the "ADD YOUR OWN MODULE" comment. The module explorer
(the Modules button on the main screen) shows any module on its own, front and rear, with its description.

## Deploy to GitHub Pages on zero-hour.sunken.dev

1. Push this repository to GitHub (the default branch is `main`).
2. In the repository, open **Settings, Pages** and set **Source** to **GitHub Actions**.
3. In the same page set **Custom domain** to `zero-hour.sunken.dev`. The `site/CNAME` file already says so.
4. At the DNS provider for `sunken.dev` add a record:

   | Type | Name | Value |
   | --- | --- | --- |
   | `CNAME` | `zero-hour` | `<your-github-user-or-org>.github.io` |

5. When GitHub has issued the certificate, tick **Enforce HTTPS**.
6. Recommended: verify `sunken.dev` under your account's **Settings, Pages** so nobody else can claim a subdomain of it.

Every push to `main` then runs `.github/workflows/deploy.yml`: install, test, build, deploy. Pull requests and other branches run
`.github/workflows/ci.yml`, which tests and builds without publishing.

### Metadata

`site/index.html` carries the canonical address, Open Graph and Twitter card tags (with an absolute link to
`zero-hour-preview.png`, 1200 x 630), structured data (schema.org `VideoGame`), the icon set, the web manifest and the
theme colour. `robots.txt` and `sitemap.xml` name the domain. If the domain ever changes, search the repository for
`zero-hour.sunken.dev`: `site/CNAME`, `site/index.html`, `site/robots.txt`, `site/sitemap.xml`, `tools/` and the tests.

## Licence

None chosen yet. Add a `LICENSE` file before making the repository public.
