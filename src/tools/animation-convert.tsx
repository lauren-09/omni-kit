import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { FilePicker } from "@/components/file-picker"
import { ResultList } from "@/components/result-list"
import { Field, OptionsCard, ProgressPanel, RunButton } from "@/components/tool-parts"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTask } from "@/hooks/use-task"
import { bytesToBlob, withExt, type OutputFile } from "@/lib/files"
import { cancelFFmpeg, openSession } from "@/lib/media/ffmpeg"
import { ANIMATION_TARGETS, animationArgs, type AnimationFormat } from "@/lib/media/formats"

const inputFormat = (file: File): AnimationFormat => (/\.gif$/i.test(file.name) ? "gif" : "apng")

type AnimationConvertProps = {
  accept?: string
  hint?: string
  defaultTarget: AnimationFormat
}

export default function AnimationConvert({ accept = ".gif,.png,.apng", hint = "Animated GIF or APNG", defaultTarget }: AnimationConvertProps) {
  const [files, setFiles] = useState<File[]>([])
  const [target, setTarget] = useState<AnimationFormat>(defaultTarget)
  const [results, setResults] = useState<OutputFile[] | null>(null)
  const { busy, progress, run } = useTask()
  const info = ANIMATION_TARGETS[target]

  const convert = () =>
    run(async (report) => {
      const session = await openSession(report)
      const out: OutputFile[] = []
      try {
        for (const [i, file] of files.entries()) {
          const from = inputFormat(file)
          if (from === target) {
            toast.warning(`Skipped ${file.name}: it's already ${info.label}.`)
            continue
          }
          report(i / files.length, `Converting ${file.name} (${i + 1}/${files.length})`)
          const input = `input-${i}.${from === "gif" ? "gif" : "png"}`
          const output = `output-${i}.${target === "apng" ? "apng" : info.ext}`
          await session.write(input, file)
          const { duration } = await session.probe(input)
          await session.exec(animationArgs(input, from, output, target), {
            duration,
            onProgress: (f) => report((i + f) / files.length),
          })
          out.push({
            name: withExt(file.name, info.ext),
            blob: bytesToBlob(await session.read(output), info.mime),
            originalSize: file.size,
            note: target === "apng" ? "Animated PNG" : undefined,
          })
          await session.dispose()
        }
        if (out.length) setResults(out)
      } finally {
        await session.dispose()
      }
    })

  if (results) {
    return (
      <ResultList
        files={results}
        zipName={`converted-${target}.zip`}
        checkerboard={target === "gif" || target === "apng"}
        onReset={() => {
          setResults(null)
          setFiles([])
        }}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <FilePicker files={files} onChange={setFiles} accept={accept} hint={hint} multiple disabled={busy} />
      <OptionsCard>
        <Field
          label="Convert to"
          className="grid gap-2 sm:col-span-2"
          hint={target === "mp4" || target === "webm" ? "Videos are often 5–10× smaller than the same GIF. Transparency becomes black." : undefined}
        >
          <Tabs value={target} onValueChange={(v) => setTarget(v as AnimationFormat)}>
            <TabsList>
              {(Object.keys(ANIMATION_TARGETS) as AnimationFormat[]).map((key) => (
                <TabsTrigger key={key} value={key} className="px-4">
                  {ANIMATION_TARGETS[key].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Field>
      </OptionsCard>
      <div>
        <RunButton busy={busy} disabled={files.length === 0} onClick={convert} icon={<RefreshCw />}>
          Convert to {info.label}
        </RunButton>
      </div>
      <ProgressPanel progress={progress} onCancel={cancelFFmpeg} />
    </div>
  )
}
