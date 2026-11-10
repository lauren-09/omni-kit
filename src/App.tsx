import { useEffect, useMemo, useState } from "react"
import { Layers, ShieldCheck } from "lucide-react"
import { DesktopNav, MobileNav } from "@/components/site-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { ToolSearch } from "@/components/tool-search"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { HomePage } from "@/pages/home"
import { ToolPage } from "@/pages/tool-page"
import { CATEGORIES, searchTools, TOOLS } from "@/tools/registry"

/** Hash routing (#/tool-id, #/c/category) works on any static host without rewrite rules. */
function useHashRoute(): string {
  const read = () => location.hash.replace(/^#\/?/, "")
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])
  return route
}

export default function App() {
  const route = useHashRoute()
  const tool = TOOLS.find((t) => t.id === route)
  const category = route.startsWith("c/") ? CATEGORIES.find((c) => c.id === route.slice(2)) : undefined
  const [query, setQuery] = useState("")
  const results = useMemo(() => (query.trim() ? searchTools(query) : null), [query])
  const visibleResults = results && category ? results.filter((t) => t.category === category.id) : results

  // Opening a tool ends the search. Category pages keep it, filtered to that category.
  useEffect(() => {
    if (tool) setQuery("")
  }, [tool])

  useEffect(() => {
    const page = tool?.name ?? (category && `${category.name} tools`)
    document.title = page ? `${page} · OmniKit` : "OmniKit · Free, private tools"
    window.scrollTo(0, 0)
  }, [tool, category])

  function search(value: string) {
    setQuery(value)
    // Results live in the tool directory; the header input stays mounted, so typing continues.
    if (tool && value.trim()) location.hash = "#/"
  }

  function openTopResult() {
    if (visibleResults?.[0]) location.hash = `#/${visibleResults[0].id}`
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-2 px-4 py-2.5 sm:h-15 sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-0">
          <MobileNav route={route} />
          <a href="#/" onClick={() => setQuery("")} className="flex shrink-0 items-center gap-2 font-heading font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Layers className="size-4" />
            </span>
            OmniKit
          </a>
          <DesktopNav route={route} />
          <ToolSearch
            query={query}
            onQueryChange={search}
            onSubmit={openTopResult}
            className="order-last w-full sm:order-none sm:mx-auto sm:max-w-xl sm:flex-1"
          />
          <div className="ml-auto sm:ml-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className={cn("flex-1", !(tool && !results) && "bg-muted/40 dark:bg-transparent")}>
        {tool && !results ? <ToolPage tool={tool} /> : <HomePage category={category} query={query} results={results} />}
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-muted-foreground sm:px-6">
          <span>
            <span className="font-medium text-foreground">OmniKit</span> · Free. No accounts, ads or tracking.
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4" /> Everything runs in your browser
          </span>
        </div>
      </footer>
      <Toaster position="top-center" richColors />
    </div>
  )
}
