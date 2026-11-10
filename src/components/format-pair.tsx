import { ArrowRight } from "lucide-react"

/** "WEBP to PNG" reads as two format tags with an arrow. Other names stay as text. */
export function FormatPair({ name }: { name: string }) {
  const parts = name.split(" to ")
  if (parts.length !== 2) return <>{name}</>
  const tag = "rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide"
  return (
    <>
      <span className={tag}>{parts[0]}</span>
      <ArrowRight className="size-3 text-muted-foreground" />
      <span className={tag}>{parts[1]}</span>
    </>
  )
}
