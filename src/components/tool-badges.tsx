import { Badge } from "@/components/ui/badge"
import { isNew, type Tool } from "@/tools/registry"

/** Lightweight marker for menus and link lists, where a full badge is too heavy. */
export function NewTag({ tool }: { tool: Tool }) {
  return isNew(tool) ? <span className="text-xs font-semibold text-primary">New</span> : null
}

export function ToolBadges({ tool }: { tool: Tool }) {
  return (
    <>
      {isNew(tool) && <Badge>New</Badge>}
      {tool.badge && <Badge variant="secondary">{tool.badge}</Badge>}
    </>
  )
}
