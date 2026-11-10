import { Fragment, Suspense } from "react"
import { ChevronRight, ShieldCheck } from "lucide-react"
import { ErrorBoundary } from "@/components/error-boundary"
import { ToolBadges } from "@/components/tool-badges"
import { cn } from "@/lib/utils"
import { QuickLinks, ToolGrid } from "@/pages/home"
import { categoryOf, toolsIn, type Tool } from "@/tools/registry"

export function ToolPage({ tool }: { tool: Tool }) {
  const category = categoryOf(tool)
  const siblings = toolsIn(tool.category).filter((t) => t.id !== tool.id)

  return (
    <div className={cn("mx-auto px-4 py-6 sm:py-8", tool.wide ? "max-w-6xl" : "max-w-3xl")}>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <a href="#/" className="hover:text-foreground">
          All tools
        </a>
        <ChevronRight className="size-3.5" />
        <a href={`#/c/${category.id}`} className="hover:text-foreground">
          {category.name}
        </a>
      </nav>
      <header className="mb-6 flex items-center gap-3">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", category.accent)}>
          <tool.icon className="size-5" />
        </div>
        <div className="grid min-w-0 gap-0.5">
          <h1 className="flex flex-wrap items-center gap-2 font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            {tool.name}
            <ToolBadges tool={tool} />
          </h1>
          <p className="text-sm text-muted-foreground">{tool.description}</p>
        </div>
      </header>

      {/* Keyed so switching between presets of the same engine starts with fresh state. */}
      <ErrorBoundary key={tool.id}>
        <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-muted" />}>
          <Fragment key={tool.id}>{tool.render()}</Fragment>
        </Suspense>
      </ErrorBoundary>

      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" />
        Runs on your device. Nothing is uploaded.
      </p>

      {siblings.length > 0 && (
        <section className="mt-10 grid gap-4 border-t pt-8">
          <h2 className="font-heading font-semibold">More {category.name} tools</h2>
          <ToolGrid variant="tile" tools={siblings.filter((t) => t.featured).slice(0, tool.wide ? 8 : 4)} className={tool.wide ? undefined : "sm:grid-cols-2 lg:grid-cols-2"} />
          <QuickLinks tools={siblings.filter((t) => !t.featured)} />
        </section>
      )}
    </div>
  )
}
