// Typesets the PDF manual. tools/build-manual-pdf.mjs reads manualHTML() from the game page as a tree of elements
// and writes it to manual.json next to this file: a string is text, { t, c, k } is an element with its tag, class and
// children, and { t: "svg", svg } is an SVG image. The `revision` input is the manual's fingerprint.
// The layout is a technical manual: a cover, a contents page, then numbered sections one after another.
// The colours follow the manual's print stylesheet in site/index.html.
// An element this template does not know stops the build, so new markup in a module's manual cannot silently vanish.

#let ink = rgb("#14191c")
#let navy = rgb("#06222b")
#let teal = rgb("#0b7a94")
#let teal-dark = rgb("#0b6f87")
#let deep = rgb("#0b4b5e")
#let amber = rgb("#8a5600")
#let rule = rgb("#8aa3ad")
#let head-fill = rgb("#e3eef2")
#let chips = (
  red: (rgb("#e5412d"), white),
  blue: (rgb("#2f6bff"), white),
  yellow: (rgb("#f2c230"), ink),
  white: (white, ink),
  black: (rgb("#05080a"), white),
  green: (rgb("#2fbf63"), ink),
)
#let mono = "DejaVu Sans Mono"   // built into Typst
#let revision = sys.inputs.at("revision", default: none)

#set document(title: "Zero Hour: defusal manual", date: none)
#set text(font: "Chakra Petch", size: 10.5pt, fill: ink, lang: "en")
#set par(leading: 0.6em, spacing: 0.9em)
#set list(indent: 0.4em, spacing: 0.75em)
#set enum(indent: 0.4em, spacing: 0.75em)

#let section-label(h) = {
  if h.numbering == none { h.body }
  else { [#numbering(h.numbering, ..counter(heading).at(h.location())) #h.body] }
}

// the document on the left, the section of the current page on the right
#let running-head = context {
  let page-now = here().page()
  let seen = query(heading.where(level: 1)).filter(h => h.location().page() <= page-now)
  set text(8pt, fill: deep, tracking: 0.08em)
  grid(columns: (1fr, auto), [ZERO HOUR #sym.dash.em DEFUSAL MANUAL], if seen.len() > 0 { upper(section-label(seen.last())) })
  v(-4pt)
  line(length: 100%, stroke: 0.6pt + rule)
}
#let running-foot = context {
  set text(8pt, fill: deep)
  line(length: 100%, stroke: 0.6pt + rule)
  v(-4pt)
  grid(columns: (1fr, auto),
    if revision != none [Revision #revision],
    [Page #counter(page).display() of #counter(page).final().first()])
}

#set page(
  paper: "a4",
  margin: (top: 22mm, bottom: 22mm, x: 18mm),
  header: running-head,
  footer: running-foot,
)

#set heading(numbering: "1.1")
#show heading: set text(fill: navy)
// sticky: a section title never ends a page on its own; it moves to the next page with its first content
#show heading.where(level: 1): it => block(width: 100%, above: 30pt, below: 16pt, sticky: true, {
  let title = text(22pt, weight: "bold", upper(it.body))
  if it.numbering == none { title } else {
    let number = box(fill: teal, inset: (x: 9pt, y: 6pt), text(18pt, fill: white, weight: "bold", counter(heading).display(it.numbering)))
    grid(columns: (auto, 1fr), column-gutter: 10pt, align: horizon, number, title)
  }
  v(6pt)
  line(length: 100%, stroke: 1.5pt + teal)
})
#show heading.where(level: 2): it => block(above: 16pt, below: 7pt, sticky: true, text(12pt, fill: teal-dark, {
  if it.numbering != none { box(width: 2.4em, counter(heading).display(it.numbering)) }
  it.body
}))
#show outline.entry.where(level: 1): set block(above: 12pt)
#show outline.entry.where(level: 1): set text(weight: "bold")
#show figure: set block(breakable: false, above: 12pt, below: 14pt)
#show figure.caption: set text(9pt, fill: deep)
#set figure.caption(separator: [. ])

#let cover(logo, title, intro) = page(header: none, footer: none, margin: (x: 22mm, top: 40mm, bottom: 25mm), {
  logo
  v(18pt)
  text(44pt, weight: "bold", fill: navy, tracking: 0.04em)[ZERO HOUR]
  v(-12pt)
  text(20pt, fill: teal, tracking: 0.12em, upper(title))
  v(6pt)
  line(length: 100%, stroke: 2pt + teal)
  v(14pt)
  block(width: 85%, text(12pt, intro))
  v(1fr)
  set text(9pt, fill: deep)
  if revision != none [Revision #revision]
})

#let has-class(n, name) = n.at("c", default: "").split(" ").contains(name)
#let is-el(k, tag) = type(k) == dictionary and k.t == tag

#let svg-image(n, width, color) = image(
  bytes(n.svg.replace("currentColor", color.to-hex())),
  format: "svg",
  width: width,
)

#let render(n) = {
  if type(n) == str { return n }
  let t = n.t
  if t == "svg" and n.svg.contains("class=\"logo-mark\"") {
    // the logo is drawn for the dark screen: its pale zero becomes navy on paper, as in the print stylesheet
    return image(bytes(n.svg.replace("#d6eef3", navy.to-hex())), format: "svg", width: 90pt)
  }
  if t == "svg" { panic("manual.typ only knows the logo, the glyph columns, the gate symbols and schematic figures as images") }
  if has-class(n, "no-print") or t == "nav" { return none }
  let kids = n.k
  let inner() = kids.map(render).join()
  if t == "div" and has-class(n, "manual") {
    // the logo, title and introduction make the cover; the sections follow the contents page
    let front = kids.filter(k => not is-el(k, "section"))
    let mh = front.find(k => is-el(k, "div") and has-class(k, "mh"))
    if mh == none { panic("manual.typ expects the manual to open with its logo and title") }
    cover(
      render(mh.k.find(k => is-el(k, "svg"))),
      mh.k.find(k => is-el(k, "h1")).k.map(render).join(),
      front.filter(k => k != mh).map(render).join(),
    )
    counter(page).update(1)
    outline(title: [Contents], depth: 2, indent: 1.6em)
    let sections = kids.filter(k => is-el(k, "section"))
    sections.filter(k => not has-class(k, "appendix")).map(render).join()
    // appendices are lettered: A, A.1, ...
    counter(heading).update(0)
    set heading(numbering: "A.1", supplement: [Appendix])
    sections.filter(k => has-class(k, "appendix")).map(render).join()
  }
  else if t == "div" and has-class(n, "gcols") {
    block(breakable: false, grid(columns: (1fr,) * 4, column-gutter: 6pt, ..kids.map(render)))
  }
  else if t == "div" and has-class(n, "gcol") {
    rect(width: 100%, stroke: 0.75pt + rule, inset: 6pt, align(center, stack(spacing: 6pt, ..kids.map(k =>
      if is-el(k, "svg") { svg-image(k, 26pt, deep) }
      else { text(font: mono, fill: amber, weight: "bold", render(k)) }
    ))))
  }
  else if t == "div" and has-class(n, "gates") {
    block(breakable: false, grid(columns: (1fr,) * kids.len(), column-gutter: 6pt, ..kids.map(render)))
  }
  else if t == "div" and has-class(n, "gate") {
    rect(width: 100%, stroke: 0.75pt + rule, inset: 6pt, align(center, stack(spacing: 5pt, ..kids.map(k =>
      if is-el(k, "svg") { svg-image(k, 40pt, deep) }
      else if is-el(k, "b") { text(font: mono, fill: amber, weight: "bold", render(k)) }
      else if is-el(k, "span") { text(9pt, k.k.map(render).join()) }
      else { render(k) }
    ))))
  }
  else if t == "div" and has-class(n, "mchart") {
    // each dot gets its own box: Typst would otherwise squeeze a run of dots together, and they must be countable
    show "\u{b7}": box
    show strong: set text(fill: teal-dark)
    block(breakable: false, grid(columns: (1fr,) * 4, row-gutter: 5pt, column-gutter: 10pt, ..kids.map(k =>
      text(font: mono, fill: deep, render(k))
    )))
  }
  else if t == "div" and has-class(n, "words") {
    // filled down the columns, like the CSS columns of the on-screen manual
    let rows = calc.ceil(kids.len() / 5)
    let order = range(rows).map(r => range(5).map(c => c * rows + r)).flatten().filter(i => i < kids.len())
    block(breakable: false, grid(columns: (1fr,) * 5, row-gutter: 5pt, ..order.map(i =>
      text(font: mono, size: 12pt, fill: deep, render(kids.at(i)))
    )))
  }
  else if t == "figure" and has-class(n, "schem") {
    // schematics are drawn 520 units wide for the full measure; narrower ones keep their proportion
    let svg = kids.find(k => is-el(k, "svg"))
    let caption = kids.find(k => is-el(k, "figcaption"))
    let width = float(svg.svg.match(regex("viewBox=\"0 0 ([0-9.]+)")).captures.first())
    figure(svg-image(svg, calc.min(100%, width / 520 * 100%), ink), caption: caption.k.map(render).join())
  }
  else if t == "section" { inner() }
  else if t == "div" and n.c == "" { block(width: 100%, inner()) }
  else if t == "h2" { heading(level: 1, inner()) }
  else if t == "h3" { heading(level: 2, inner()) }
  else if t == "p" { par(inner()) }
  else if t == "ul" { list(..kids.map(render)) }
  else if t == "ol" { enum(..kids.map(render)) }
  else if t == "li" { block(breakable: false, inner()) }
  else if t == "b" { strong(inner()) }
  else if t == "em" { emph(inner()) }
  else if t == "br" { linebreak() }
  else if t == "a" { inner() }
  else if t == "span" and has-class(n, "chip") {
    let (bg, fg) = chips.at(n.c.split(" ").find(c => c.starts-with("c-")).slice(2))
    box(fill: bg, inset: (x: 4pt), outset: (y: 2pt), stroke: if bg == white { 0.5pt + rgb("#8a8a8a") },
      text(fill: fg, weight: "semibold", inner()))
  }
  else if t == "table" {
    let rows = kids.map(k => if k.t in ("tbody", "thead") { k.k } else { (k,) }).flatten()
    let cols = calc.max(..rows.map(r => r.k.len()))
    let cell(c) = {
      let body = render(c)
      if c.t == "th" { table.cell(fill: head-fill, strong(body)) }
      else if has-class(c, "pat-c") { table.cell({ set par(leading: 0.35em); text(font: mono, size: 12pt, fill: deep, body) }) }
      else { table.cell(body) }
    }
    block(breakable: false, above: 8pt, below: 12pt, table(
      columns: (auto,) + (1fr,) * (cols - 1),
      stroke: 0.75pt + rule,
      inset: 5pt,
      ..rows.map(r => r.k.map(cell)).flatten(),
    ))
  }
  else if t in ("td", "th") { inner() }
  else { panic("manual.typ does not know how to typeset <" + t + " class=\"" + n.c + "\">") }
}

#render(json("manual.json"))
