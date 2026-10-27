import { Fragment, Suspense } from "react"
import { ChevronRight, ShieldCheck } from "lucide-react"
import { ErrorBoundary } from "@/components/error-boundary"
import { ToolBadges } from "@/components/tool-badges"
import { cn } from "@/lib/utils"
import { QuickLinks, ToolCard } from "@/pages/home"
import { categoryOf, toolsIn, type Tool } from "@/tools/registry"

export function ToolPage({ tool }: { tool: Tool }) {
  const category = categoryOf(tool)
  const siblings = toolsIn(tool.category).filter((t) => t.id !== tool.id)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <a href="#/" className="hover:text-foreground">
          All tools
        </a>
        <ChevronRight className="size-3.5" />
        <a href={`#/c/${category.id}`} className="hover:text-foreground">
          {category.name}
        </a>
      </nav>
      <header className="mb-8 flex items-start gap-4">
        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", category.accent)}>
          <tool.icon className="size-6" />
        </div>
        <div className="grid gap-1">
          <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {tool.name}
            <ToolBadges tool={tool} />
          </h1>
          <p className="text-muted-foreground">{tool.description}</p>
        </div>
      </header>

      {/* Keyed so switching between presets of the same engine starts with fresh state. */}
      <ErrorBoundary key={tool.id}>
        <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-muted" />}>
          <Fragment key={tool.id}>{tool.render()}</Fragment>
        </Suspense>
      </ErrorBoundary>

      <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" />
        Processed on your device. Your files are never uploaded.
      </p>

      {siblings.length > 0 && (
        <section className="mt-14 grid gap-5 border-t pt-10">
          <h2 className="font-heading font-semibold">More {category.name} tools</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {siblings
              .filter((t) => t.featured)
              .slice(0, 3)
              .map((t) => (
                <ToolCard key={t.id} tool={t} />
              ))}
          </div>
          <QuickLinks tools={siblings.filter((t) => !t.featured)} />
        </section>
      )}
    </div>
  )
}
