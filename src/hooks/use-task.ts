import { useCallback, useState } from "react"
import { toast } from "sonner"

export type Report = (fraction: number, label?: string) => void
export type Progress = { value: number; label: string }

/** Runs one async job at a time with progress reporting and error toasts. */
export function useTask() {
  const [progress, setProgress] = useState<Progress | null>(null)

  const run = useCallback(async <T,>(job: (report: Report) => Promise<T>): Promise<T | undefined> => {
    setProgress({ value: 0, label: "Starting…" })
    try {
      return await job((fraction, label) =>
        setProgress((prev) => ({
          value: Math.round(Math.min(1, Math.max(0, fraction)) * 100),
          label: label ?? prev?.label ?? "",
        }))
      )
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast("Cancelled.")
        return
      }
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setProgress(null)
    }
  }, [])

  return { busy: progress !== null, progress, run }
}
