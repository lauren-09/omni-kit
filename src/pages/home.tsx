import { useState } from "react"
import { ArrowRight, Gift, Lock, Search, Sparkles, Zap } from "lucide-react"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { NewTag, ToolBadges } from "@/components/tool-badges"
import { CATEGORIES, categoryOf, newTools, searchTools, toolsIn, type Category, type Tool } from "@/tools/registry"

const PROMISES = [
  { icon: Lock, title: "Private by design", text: "Everything runs in your browser. Your files are never uploaded to a server." },
  { icon: Gift, title: "Free, no catch", text: "No sign-up, no watermarks, no limits, no ads, no tracking." },
  { icon: Zap, title: "Fast", text: "No waiting on uploads or downloads. Your own device does the work." },
]

export function ToolCard({ tool }: { tool: Tool }) {
  return (
    <a href={`#/${tool.id}`} className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
        <CardHeader>
          <div className={cn("mb-2 flex size-10 items-center justify-center rounded-lg", categoryOf(tool).accent)}>
            <tool.icon className="size-5" />
          </div>
          <CardTitle className="flex items-center gap-2">
            {tool.name}
            <ToolBadges tool={tool} />
          </CardTitle>
          <CardDescription>{tool.description}</CardDescription>
        </CardHeader>
      </Card>
    </a>
  )
}

export function QuickLinks({ tools, label = "Quick conversions" }: { tools: Tool[]; label?: string }) {
  if (tools.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-muted-foreground">{label}:</span>
      {tools.map((tool) => (
        <a key={tool.id} href={`#/${tool.id}`} className={cn(badgeVariants({ variant: "outline" }), "h-7 px-3 text-sm hover:bg-muted")}>
          {tool.name}
          <NewTag tool={tool} />
        </a>
      ))}
    </div>
  )
}

/** A category's featured tools as cards, with its presets as quick links. */
export function CategorySection({ category, showAll }: { category: Category; showAll?: boolean }) {
  const tools = toolsIn(category.id)
  // The category page lists every tool as a card; the home page keeps presets as compact links.
  const cards = showAll ? [...tools.filter((t) => t.featured), ...tools.filter((t) => !t.featured)] : tools.filter((t) => t.featured)
  const quick = showAll ? [] : tools.filter((t) => !t.featured)
  const Heading = showAll ? "h1" : "h2"

  return (
    <section id={`cat-${category.id}`} className="grid scroll-mt-20 gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex shrink-0 items-center justify-center rounded-xl", category.accent, showAll ? "size-12" : "size-10")}>
            <category.icon className={showAll ? "size-6" : "size-5"} />
          </div>
          <div>
            <Heading className={cn("font-heading font-semibold tracking-tight", showAll ? "text-2xl sm:text-3xl" : "text-xl")}>
              {category.name}
            </Heading>
            <p className="text-sm text-muted-foreground">{category.description}</p>
          </div>
        </div>
        {!showAll && (
          <a href={`#/c/${category.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            View all {tools.length} <ArrowRight />
          </a>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
      <QuickLinks tools={quick} />
    </section>
  )
}

export function HomePage() {
  const [query, setQuery] = useState("")
  const results = query.trim() ? searchTools(query) : null
  const latest = newTools()[0]

  return (
    <>
      <section className="border-b bg-linear-to-b from-muted/60 to-background">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:py-20">
          {latest ? (
            <a href={`#/${latest.id}`} className={cn(badgeVariants({ variant: "outline" }), "mb-5 h-7 gap-1.5 bg-background px-3 hover:bg-muted")}>
              <Badge className="h-4 px-1.5 text-[10px]">New</Badge>
              {latest.name} is here
              <ArrowRight />
            </a>
          ) : (
            <Badge variant="outline" className="mb-5 bg-background">
              <Sparkles /> 100% free · No sign-up · Files never leave your device
            </Badge>
          )}
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Every file tool you need.
            <br />
            <span className="text-muted-foreground">Free and private.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">
            Convert images, documents, ebooks, video and audio, make GIFs, and edit PDFs, all inside your browser.
          </p>
          <div className="relative mx-auto mt-8 max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search tools"
              placeholder='Search tools, e.g. "heic to jpg" or "mp4 to mp3"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 bg-background pl-9 text-base shadow-sm"
            />
          </div>
          {!results && (
            <nav aria-label="Categories" className="mt-6 flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => document.getElementById(`cat-${category.id}`)?.scrollIntoView({ behavior: "smooth" })}
                  className={cn(badgeVariants({ variant: "outline" }), "h-8 cursor-pointer gap-1.5 bg-background px-3 text-sm hover:bg-muted")}
                >
                  <category.icon /> {category.name}
                </button>
              ))}
            </nav>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-14 px-4 py-12">
        {results ? (
          results.length ? (
            <section className="grid gap-4">
              <h2 className="font-heading text-lg font-semibold">
                {results.length} tool{results.length === 1 ? "" : "s"} found
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          ) : (
            <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">No tool matches "{query}".</p>
          )
        ) : (
          CATEGORIES.map((category) => <CategorySection key={category.id} category={category} />)
        )}

        <section className="grid gap-6 rounded-2xl border bg-muted/30 p-6 sm:grid-cols-3 sm:p-8">
          {PROMISES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="grid gap-2">
              <Icon className="size-5" />
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
