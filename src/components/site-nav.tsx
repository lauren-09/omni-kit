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
import { cn } from "@/lib/utils"
import { CATEGORIES, toolsIn, type Tool } from "@/tools/registry"

/** Featured tools first, then the quick conversions, as in the reference layout. */
const ordered = (tools: Tool[]) => [...tools.filter((t) => t.featured), ...tools.filter((t) => !t.featured)]

/** Desktop: one "All tools" mega-menu with a column per category. */
export function DesktopNav() {
  return (
    <NavigationMenu className="hidden md:flex">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>All tools</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[min(1060px,calc(100vw-6rem))] grid-cols-5 gap-x-2 p-3">
              {CATEGORIES.map((category) => (
                <div key={category.id} className="grid content-start gap-0.5 border-l px-2 first:border-l-0">
                  <NavigationMenuLink asChild>
                    <a href={`#/c/${category.id}`} className="mb-1 flex-row items-center gap-2 font-semibold">
                      <category.icon className="size-4" />
                      {category.name}
                    </a>
                  </NavigationMenuLink>
                  {ordered(toolsIn(category.id)).map((tool) => (
                    <NavigationMenuLink key={tool.id} asChild>
                      <a href={`#/${tool.id}`} className="py-1.5 text-muted-foreground hover:text-foreground">
                        {tool.name}
                      </a>
                    </NavigationMenuLink>
                  ))}
                </div>
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        {CATEGORIES.slice(0, 4).map((category) => (
          <NavigationMenuItem key={category.id} className="hidden lg:block">
            <NavigationMenuLink asChild>
              <a href={`#/c/${category.id}`} className="px-3 py-2 font-medium">
                {category.name}
              </a>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
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
                  {ordered(toolsIn(category.id)).map((tool) => (
                    <li key={tool.id}>
                      <a
                        href={`#/${tool.id}`}
                        className={cn(
                          "block rounded-md px-2 py-1.5 text-muted-foreground no-underline hover:bg-muted hover:text-foreground hover:no-underline",
                          route === tool.id && "bg-muted font-medium text-foreground"
                        )}
                      >
                        {tool.name}
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
