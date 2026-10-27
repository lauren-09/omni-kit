import { Component, type ReactNode } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Catches tool crashes and stale chunks after a redeploy, instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">This tool couldn't load.</p>
        <p className="text-sm text-muted-foreground">The site may have just been updated. Reloading usually fixes it.</p>
        <Button variant="outline" onClick={() => location.reload()}>
          <RotateCcw /> Reload
        </Button>
      </div>
    )
  }
}
