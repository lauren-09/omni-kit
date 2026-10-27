import { ArrowLeft } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CategorySection } from "@/pages/home"
import type { Category } from "@/tools/registry"

export function CategoryPage({ category }: { category: Category }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <a href="#/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-6 -ml-2.5")}>
        <ArrowLeft /> All tools
      </a>
      <CategorySection category={category} showAll />
    </div>
  )
}
