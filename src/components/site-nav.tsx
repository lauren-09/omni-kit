import { useEffect, useState } from "react"
import { Menu } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { FormatPair } from "@/components/format-pair"
import { NewTag } from "@/components/tool-badges"
import { cn } from "@/lib/utils"
import { CATEGORIES, featuredFirst, isNew, TOOLS, toolsIn } from "@/tools/registry"

const NEW_DOT = "size-1.5 shrink-0 rounded-full bg-emerald-500"

/** Desktop: an "All tools" mega-menu laid out as aligned category blocks. */
export function DesktopNav({ route }: { route: string }) {
  // Close the menu on any navigation, including the browser's Back button.
  const [open, setOpen] = useState("")
  useEffect(() => setOpen(""), [route])

  return (
    <NavigationMenu value={open} onValueChange={setOpen} className="hidden md:flex">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>All tools</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="flex max-h-[calc(100svh-5rem)] w-[min(1100px,calc(100vw-10.5rem))] flex-col">
              <div className="grid gap-x-6 gap-y-6 overflow-y-auto p-5 md:grid-cols-2 lg:grid-cols-3">
                {CATEGORIES.map((category) => {
                  const tools = toolsIn(category.id)
                  const main = tools.filter((t) => t.featured)
                  const quick = tools.filter((t) => !t.featured)
                  return (
                    <section key={category.id} className="grid content-start gap-2">
                      <NavigationMenuLink
                        asChild
                        className="gap-2.5 rounded-none border-b px-1 pb-2.5 font-semibold whitespace-nowrap hover:bg-transparent focus:bg-transparent in-data-[slot=navigation-menu-content]:rounded-none"
                      >
                        <a href={`#/c/${category.id}`}>
                          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", category.accent)}>
                            <category.icon className="size-4" />
                          </span>
                          {category.name}
                          <span className="text-xs font-normal text-muted-foreground tabular-nums">{tools.length}</span>
                        </a>
                      </NavigationMenuLink>
                      <ul className="grid grid-cols-2 gap-x-2">
                        {main.map((tool) => (
                          <li key={tool.id}>
                            <NavigationMenuLink asChild className="block px-2 py-1.5 leading-snug text-muted-foreground hover:text-foreground">
                              <a href={`#/${tool.id}`} title={tool.description}>
                                {tool.name}
                                {isNew(tool) && (
                                  <>
                                    <span aria-hidden className={cn(NEW_DOT, "ml-1.5 inline-block align-middle")} />
                                    <span className="sr-only">(new)</span>
                                  </>
                                )}
                              </a>
                            </NavigationMenuLink>
                          </li>
                        ))}
                      </ul>
                      {quick.length > 0 && (
                        <ul className="flex flex-wrap gap-1 px-1 pt-1">
                          {quick.map((tool) => (
                            <li key={tool.id}>
                              <NavigationMenuLink asChild className="h-7 gap-1 border px-1.5 py-0 hover:border-foreground/20">
                                <a href={`#/${tool.id}`} title={tool.description}>
                                  <FormatPair name={tool.name} />
                                </a>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )
                })}
              </div>
              <div className="flex items-center justify-between gap-4 border-t bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className={NEW_DOT} /> New tool
                </span>
                <span>
                  Press <kbd className="rounded border bg-background px-1 font-mono">/</kbd> to search all {TOOLS.length} tools
                </span>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

/** Mobile: a slide-out drawer with one collapsible section per category. */
export function MobileNav({ route }: { route: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [route])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>All tools</SheetTitle>
        </SheetHeader>
        <Accordion type="single" collapsible className="px-4 pb-6">
          {CATEGORIES.map((category) => (
            <AccordionItem key={category.id} value={category.id}>
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <category.icon className="size-4" />
                  {category.name}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="grid gap-1">
                  {featuredFirst(toolsIn(category.id)).map((tool) => (
                    <li key={tool.id}>
                      <a
                        href={`#/${tool.id}`}
                        className={cn(
                          "block rounded-md px-2 py-1.5 text-muted-foreground no-underline hover:bg-muted hover:text-foreground hover:no-underline",
                          route === tool.id && "bg-muted font-medium text-foreground"
                        )}
                      >
                        {tool.name} <NewTag tool={tool} />
                      </a>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SheetContent>
    </Sheet>
  )
}
