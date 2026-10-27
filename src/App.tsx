import { useEffect, useState } from "react"
import { Layers, ShieldCheck } from "lucide-react"
import { DesktopNav, MobileNav } from "@/components/site-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Toaster } from "@/components/ui/sonner"
import { CategoryPage } from "@/pages/category-page"
import { HomePage } from "@/pages/home"
import { ToolPage } from "@/pages/tool-page"
import { CATEGORIES, TOOLS } from "@/tools/registry"

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

  useEffect(() => {
    const page = tool?.name ?? (category && `${category.name} tools`)
    document.title = page ? `${page} · OmniKit` : "OmniKit · Free, private file tools"
    window.scrollTo(0, 0)
  }, [tool, category])

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <MobileNav route={route} />
          <a href="#/" className="mr-2 flex items-center gap-2 font-heading font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Layers className="size-4" />
            </span>
            OmniKit
          </a>
          <DesktopNav route={route} />
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="hidden xl:inline-flex">
              <ShieldCheck /> Files stay on your device
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {tool ? <ToolPage tool={tool} /> : category ? <CategoryPage category={category} /> : <HomePage />}
      </main>

      <footer className="border-t">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-6">
          <div className="grid content-start gap-2 lg:col-span-1">
            <p className="font-heading font-semibold">OmniKit</p>
            <p className="text-muted-foreground">Free file tools. No accounts, no ads, no tracking. Everything runs in your browser.</p>
          </div>
          {CATEGORIES.map((c) => (
            <div key={c.id} className="grid content-start gap-2">
              <a href={`#/c/${c.id}`} className="font-medium hover:underline">
                {c.name}
              </a>
              <ul className="grid gap-1.5 text-muted-foreground">
                {TOOLS.filter((t) => t.category === c.id && t.featured)
                  .slice(0, 5)
                  .map((t) => (
                    <li key={t.id}>
                      <a href={`#/${t.id}`} className="hover:text-foreground">
                        {t.name}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
      <Toaster position="top-center" richColors />
    </div>
  )
}
