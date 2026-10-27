import { useEffect, useState } from "react"

/**
 * Object URLs for previewing blobs; revoked automatically when the list changes.
 * Pass a memoized array, since a new array identity recreates every URL.
 */
export function useObjectUrls(blobs: (Blob | null | undefined)[]): (string | null)[] {
  const [urls, setUrls] = useState<(string | null)[]>([])

  useEffect(() => {
    const next = blobs.map((blob) => (blob ? URL.createObjectURL(blob) : null))
    setUrls(next)
    return () => next.forEach((url) => url && URL.revokeObjectURL(url))
  }, [blobs])

  return urls
}
