// Typesets the PDF manual. tools/build-manual-pdf.mjs reads manualHTML() from the game page as a tree of elements
// and writes it to manual.json next to this file: a string is text, { t, c, k } is an element with its tag, class and
// children, and { t: "svg", svg } is an SVG image. The look follows the manual's print stylesheet in site/index.html.
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

#set document(title: "Zero Hour: defusal manual", date: none)
#set page(
  paper: "a4",
  margin: (top: 15mm, bottom: 18mm, x: 14mm),
  footer: context align(center, text(8pt, fill: rgb("#667"))[
    Zero Hour defusal manual #sym.dash.em page #counter(page).display() of #counter(page).final().first()
  ]),
)
#set text(font: "Chakra Petch", size: 10.5pt, fill: ink, lang: "en")
#set par(leading: 0.6em, spacing: 0.9em)
#set list(indent: 0.4em, spacing: 0.75em)
#set enum(indent: 0.4em, spacing: 0.75em)
#show heading: set text(fill: navy)
#show heading.where(level: 1): set text(24pt)
#show heading.where(level: 2): it => block(below: 9pt, sticky: true, width: 100%, {
  place(top + left, dy: -1.5pt, rect(width: 56pt, height: 3pt, fill: teal))
  line(length: 100%, stroke: 1.5pt + teal)
  v(4pt)
  text(16pt, it.body)
})
#show heading.where(level: 3): it => block(above: 14pt, below: 6pt, sticky: true, text(12pt, fill: teal-dark, it.body))

#let has-class(n, name) = n.at("c", default: "").split(" ").contains(name)

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
    return box(baseline: 20%, image(bytes(n.svg.replace("#d6eef3", navy.to-hex())), format: "svg", width: 34pt))
  }
  if t == "svg" { panic("manual.typ only knows the logo and the glyph columns as images") }
  if has-class(n, "no-print") or t == "nav" { return none }
  let kids = n.k
  let inner() = kids.map(render).join()
  if t == "div" and has-class(n, "mh") {
    grid(columns: 2, column-gutter: 10pt, align: horizon, ..kids.map(render))
  }
  else if t == "div" and has-class(n, "gcols") {
    block(breakable: false, grid(columns: (1fr,) * 4, column-gutter: 6pt, ..kids.map(render)))
  }
  else if t == "div" and has-class(n, "gcol") {
    rect(width: 100%, stroke: 0.75pt + rule, inset: 6pt, align(center, stack(spacing: 6pt, ..kids.map(k =>
      if type(k) == dictionary and k.t == "svg" { svg-image(k, 26pt, deep) }
      else { text(font: mono, fill: amber, weight: "bold", render(k)) }
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
  else if t == "section" { block(width: 100%, above: 22pt, inner()) }
  else if t == "div" and n.c in ("", "manual") { block(width: 100%, inner()) }
  else if t == "h1" { heading(level: 1, outlined: false, inner()) }
  else if t == "h2" { heading(level: 2, inner()) }
  else if t == "h3" { heading(level: 3, inner()) }
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
