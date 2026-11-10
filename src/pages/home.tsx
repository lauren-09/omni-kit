import { ArrowRight, Repeat2, SearchX, ShieldCheck } from "lucide-react"
import { FormatPair } from "@/components/format-pair"
import { NewTag, ToolBadges } from "@/components/tool-badges"
import { cn } from "@/lib/utils"
import { CATEGORIES, categoryOf, featuredFirst, TOOLS, toolsIn, type Category, type CategoryId, type Tool } from "@/tools/registry"

/** Category colour as a dot (filters) and a top strip (cards). Literal classes so Tailwind sees them. */
const CATEGORY_DOT: Record<CategoryId, string> = {
  image: "bg-violet-500",
  document: "bg-rose-500",
  media: "bg-sky-500",
  gif: "bg-emerald-500",
  archive: "bg-amber-500",
  data: "bg-indigo-500",
}

/** A large card: colour strip, icon tile, name and one-line purpose. */
export function ToolCard({ tool }: { tool: Tool }) {
  const category = categoryOf(tool)
  return (
    <a
      href={`#/${tool.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card p-4 shadow-xs transition-[box-shadow,border-color] outline-none hover:border-foreground/20 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5"
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1 opacity-80", CATEGORY_DOT[tool.category])} />
      <span className={cn("flex size-11 items-center justify-center rounded-xl shadow-sm sm:size-12", category.solid)}>
        <tool.icon className="size-5 sm:size-6" />
      </span>
      <span className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-heading text-base leading-snug font-semibold sm:text-lg">
        {tool.name}
        <ToolBadges tool={tool} />
      </span>
      <span className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">{tool.description}</span>
      <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-muted-foreground group-hover:text-foreground max-sm:hidden">
        Open <ArrowRight className="size-3.5" />
      </span>
    </a>
  )
}

/** A small tile: icon and name. Used for "More tools" under a tool. */
function ToolTile({ tool }: { tool: Tool }) {
  return (
    <a
      href={`#/${tool.id}`}
      title={tool.description}
      className="flex h-full items-center gap-3 rounded-xl border bg-card p-2.5 text-sm font-medium transition-colors outline-none hover:border-foreground/20 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", categoryOf(tool).accent)}>
        <tool.icon className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 leading-snug">
        {tool.name}
        <ToolBadges tool={tool} />
      </span>
    </a>
  )
}

export function ToolGrid({ tools, variant = "card", className }: { tools: Tool[]; variant?: "card" | "tile"; className?: string }) {
  const Item = variant === "card" ? ToolCard : ToolTile
  return (
    <div
      className={cn(
        variant === "card"
          ? "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
          : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4",
        className
      )}
    >
      {tools.map((tool) => (
        <Item key={tool.id} tool={tool} />
      ))}
    </div>
  )
}

function ConversionChip({ tool }: { tool: Tool }) {
  return (
    <a
      href={`#/${tool.id}`}
      title={tool.description}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2 text-sm transition-colors hover:border-foreground/20 hover:bg-muted/50"
    >
      <FormatPair name={tool.name} />
      <NewTag tool={tool} />
    </a>
  )
}

export function QuickLinks({ tools, label = "Quick conversions" }: { tools: Tool[]; label?: string }) {
  if (tools.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm text-muted-foreground">{label}:</span>
      {tools.map((tool) => (
        <ConversionChip key={tool.id} tool={tool} />
      ))}
    </div>
  )
}

function Pill({ href, active, dot, label, count }: { href: string; active: boolean; dot?: string; label: string; count: number }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground/30"
      )}
    >
      {dot && <span aria-hidden className={cn("size-2 rounded-full", dot)} />}
      {label}
      <span className={cn("text-xs tabular-nums", active ? "opacity-60" : "text-muted-foreground")}>{count}</span>
    </a>
  )
}

/** Category filter. Centred and wrapping on wide screens; one sideways-scrolling row on phones. */
function CategoryFilter({ active }: { active?: CategoryId }) {
  return (
    <nav
      aria-label="Filter by category"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0"
    >
      <Pill href="#/" active={!active} label="All" count={TOOLS.length} />
      {CATEGORIES.map((c) => (
        <Pill key={c.id} href={`#/c/${c.id}`} active={active === c.id} dot={CATEGORY_DOT[c.id]} label={c.name} count={toolsIn(c.id).length} />
      ))}
    </nav>
  )
}

function Intro({ category }: { category?: Category }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        100% in your browser · nothing is uploaded
      </p>
      <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
        {category ? `${category.name} tools` : "All your file tools in one place"}
      </h1>
      <p className="mt-3 text-pretty text-muted-foreground sm:text-lg">
        {category
          ? category.description
          : `${TOOLS.length} free tools to convert, compress, merge and edit images, PDFs, video, audio, GIFs and data. No sign-up, no limits.`}
      </p>
    </div>
  )
}

function SearchResults({ query, results, category }: { query: string; results: Tool[]; category?: Category }) {
  const where = category ? ` in ${category.name}` : ""
  if (results.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground" aria-live="polite">
        <SearchX className="size-5" />
        <p>
          No tool{where} matches “{query.trim()}”.
        </p>
        {category && (
          <a href="#/" className="font-medium text-foreground underline underline-offset-4">
            Search all categories
          </a>
        )}
      </div>
    )
  }
  return (
    <section className="grid gap-4">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted-foreground" aria-live="polite">
        <span>
          {results.length} tool{results.length === 1 ? "" : "s"}
          {where} for “{query.trim()}”
        </span>
        <span className="hidden sm:inline">
          <kbd className="rounded border bg-card px-1 font-mono text-xs">Enter</kbd> opens {results[0].name}
        </span>
      </p>
      <ToolGrid tools={results} />
    </section>
  )
}

type HomePageProps = {
  /** Set on #/c/<id>: only that category's tools. */
  category?: Category
  query: string
  /** Search results across all tools, or null when not searching. */
  results: Tool[] | null
}

/** The tool directory for home (#/) and category pages (#/c/<id>). */
export function HomePage({ category, query, results }: HomePageProps) {
  const filtered = results && category ? results.filter((t) => t.category === category.id) : results
  const quick = TOOLS.filter((t) => !t.featured)

  return (
    <div className="mx-auto grid max-w-screen-2xl gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <Intro category={category} />
        <CategoryFilter active={category?.id} />

        {filtered ? (
          <SearchResults query={query} results={filtered} category={category} />
        ) : category ? (
          <ToolGrid tools={featuredFirst(toolsIn(category.id))} />
        ) : (
          <>
            <ToolGrid tools={TOOLS.filter((t) => t.featured)} />
            <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
              <h2 className="flex items-center gap-2 font-heading font-semibold">
                <Repeat2 className="size-4 text-muted-foreground" /> One-click conversions
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {quick.map((tool) => (
                  <ConversionChip key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          </>
        )}
    </div>
  )
}
