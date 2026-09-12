import type { Browser, ConsoleMessage, Page } from 'playwright'

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

type MessageKind =
  | 'console-error'
  | 'console-trace'
  | 'console-warning'
  | 'http-error'
  | 'page-error'
  | 'request-failed'

type SweepMessage = {
  count: number
  kind: MessageKind
  text: string
}

type FieldResult = {
  durationMs: number
  fieldId: string
  hasMounted: boolean
  messages: SweepMessage[]
  screenshot: string | null
  sweptAt: string
  title: string
}

type SweepOptions = {
  baseUrl: string
  channel: string | undefined
  fieldFilter: string[] | undefined
  isFresh: boolean
  isHeaded: boolean
  isReportOnly: boolean
  limit: number | undefined
  maxDistinctMessages: number
  mountTimeoutMs: number
  navigationTimeoutMs: number
  outputDirectory: string
  progress: string | undefined
  restartEvery: number
  settleMs: number
  shouldStartServer: boolean
  viewportHeight: number
  viewportWidth: number
}

const ROOT_DIRECTORY = fileURLToPath(new URL('..', import.meta.url))
const MAPDATA_DIRECTORY = join(ROOT_DIRECTORY, 'extractor/data/converted/field/mapdata')
const TITLE_SUFFIX = ' - Final Fantasy VIII GL'
const REPORT_EVERY = 25

const parseArguments = (argv: string[]) => {
  const flags = new Map<string, string>()
  for (let index = 0; index < argv.length; index++) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(argv[index])
    if (!match) {
      continue
    }
    const [, name, inlineValue] = match
    if (inlineValue !== undefined) {
      flags.set(name, inlineValue)
      continue
    }
    const nextArgument = argv[index + 1]
    if (nextArgument && !nextArgument.startsWith('--')) {
      flags.set(name, nextArgument)
      index++
      continue
    }
    flags.set(name, 'true')
  }
  return flags
}

const readNumberFlag = (flags: Map<string, string>, name: string, fallback: number) => {
  const raw = flags.get(name)
  if (raw === undefined) {
    return fallback
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

const buildOptions = (argv: string[]): SweepOptions => {
  const flags = parseArguments(argv)
  const fieldFilter = flags.get('fields')
  const limit = flags.get('limit')

  return {
    baseUrl: (flags.get('base-url') ?? 'http://localhost:5173').replace(/\/$/, ''),
    channel: flags.get('channel'),
    fieldFilter: fieldFilter ? fieldFilter.split(',').map((field) => field.trim()) : undefined,
    isFresh: flags.has('fresh'),
    isHeaded: flags.has('headed'),
    isReportOnly: flags.has('report-only'),
    limit: limit ? Number(limit) : undefined,
    maxDistinctMessages: readNumberFlag(flags, 'max-messages', 150),
    mountTimeoutMs: readNumberFlag(flags, 'mount-timeout', 30_000),
    navigationTimeoutMs: readNumberFlag(flags, 'navigation-timeout', 60_000),
    outputDirectory: resolve(ROOT_DIRECTORY, flags.get('out') ?? 'sweep'),
    progress: flags.get('progress'),
    restartEvery: readNumberFlag(flags, 'restart-every', 40),
    settleMs: readNumberFlag(flags, 'settle', 10_000),
    shouldStartServer: !flags.has('no-server'),
    viewportHeight: readNumberFlag(flags, 'viewport-height', 896),
    viewportWidth: readNumberFlag(flags, 'viewport-width', 1280),
  }
}

const getFieldIds = async (options: SweepOptions) => {
  if (options.fieldFilter) {
    return options.fieldFilter
  }
  const entries = await readdir(MAPDATA_DIRECTORY, { withFileTypes: true })
  const fieldIds = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(MAPDATA_DIRECTORY, name, 'data.json')))
    .sort()

  return options.limit ? fieldIds.slice(0, options.limit) : fieldIds
}

const isServerReachable = async (baseUrl: string) => {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) })
    return response.ok
  } catch {
    return false
  }
}

const waitForServer = async (baseUrl: string, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isServerReachable(baseUrl)) {
      return true
    }
    await delay(500)
  }
  return false
}

const startDevServer = async (options: SweepOptions) => {
  if (await isServerReachable(options.baseUrl)) {
    console.log(`Using the server already running at ${options.baseUrl}`)
    return undefined
  }
  if (!options.shouldStartServer) {
    throw new Error(`No server at ${options.baseUrl} and --no-server was passed.`)
  }

  const port = new URL(options.baseUrl).port || '5173'
  console.log(`Starting vite on port ${port}...`)
  const server = spawn(join(ROOT_DIRECTORY, 'node_modules/.bin/vite'), ['--port', port, '--strictPort'], {
    cwd: ROOT_DIRECTORY,
    stdio: 'ignore',
  })

  if (!(await waitForServer(options.baseUrl, 120_000))) {
    server.kill()
    throw new Error(`vite did not become reachable at ${options.baseUrl}`)
  }
  return server
}

const launchBrowser = async (options: SweepOptions): Promise<Browser> => {
  const launchOptions = {
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--enable-unsafe-swiftshader'],
    headless: !options.isHeaded,
  }
  if (options.channel) {
    return chromium.launch({ ...launchOptions, channel: options.channel })
  }
  try {
    return await chromium.launch(launchOptions)
  } catch {
    console.warn("Bundled Chromium unavailable, falling back to the machine's Chrome.")
    return chromium.launch({ ...launchOptions, channel: 'chrome' })
  }
}

const shortenUrl = (baseUrl: string, url: string) => url.replace(baseUrl, '').slice(0, 300)

const getConsoleKind = (message: ConsoleMessage): MessageKind | undefined => {
  if (message.type() === 'error') {
    return 'console-error'
  }
  if (message.type() === 'warning') {
    return 'console-warning'
  }
  if (message.type() === 'trace') {
    return 'console-trace'
  }
  return undefined
}

const createMessageCollector = (page: Page, options: SweepOptions) => {
  const messages = new Map<string, SweepMessage>()

  const record = (kind: MessageKind, rawText: string) => {
    const text = rawText.trim().slice(0, 600)
    const key = `${kind}::${text}`
    const existing = messages.get(key)
    if (existing) {
      existing.count++
      return
    }
    if (messages.size >= options.maxDistinctMessages) {
      return
    }
    messages.set(key, { count: 1, kind, text })
  }

  page.on('console', (message) => {
    const kind = getConsoleKind(message)
    if (!kind) {
      return
    }
    record(kind, message.text())
  })

  page.on('pageerror', (error) => {
    const [, firstFrame] = (error.stack ?? '').split('\n')
    record('page-error', `${error.message}${firstFrame ? ` @ ${shortenUrl(options.baseUrl, firstFrame.trim())}` : ''}`)
  })

  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? 'unknown failure'
    // Closing the page cancels whatever is still in flight; that is not a field bug.
    if (errorText.includes('ERR_ABORTED')) {
      return
    }
    record('request-failed', `${errorText} ${shortenUrl(options.baseUrl, request.url())}`)
  })

  page.on('response', (response) => {
    if (response.status() < 400) {
      return
    }
    record('http-error', `HTTP ${response.status()} ${shortenUrl(options.baseUrl, response.url())}`)
  })

  return { getMessages: () => [...messages.values()], record }
}

const buildFieldUrl = (options: SweepOptions, fieldId: string) => {
  const url = new URL(options.baseUrl)
  url.searchParams.set('field', fieldId)
  if (options.progress) {
    url.searchParams.set('progress', options.progress)
  }
  return url.toString()
}

// Field.tsx sets document.title once the field has mounted, which is the only
// signal the running app exposes to the outside world.
const waitForFieldMount = async (page: Page, timeoutMs: number) => {
  try {
    await page.waitForFunction((suffix) => document.title.includes(suffix), TITLE_SUFFIX, { timeout: timeoutMs })
    return true
  } catch {
    return false
  }
}

const readTitle = async (page: Page) => {
  try {
    return await page.title()
  } catch {
    return ''
  }
}

const visitField = async (page: Page, fieldId: string, options: SweepOptions) => {
  await page.goto(buildFieldUrl(options, fieldId), {
    timeout: options.navigationTimeoutMs,
    waitUntil: 'domcontentloaded',
  })

  const hasMounted = await waitForFieldMount(page, options.mountTimeoutMs)
  await delay(options.settleMs)
  const title = await readTitle(page)

  const screenshot = `${fieldId}.jpg`
  await page.screenshot({
    path: join(options.outputDirectory, 'screenshots', screenshot),
    quality: 70,
    type: 'jpeg',
  })

  return { hasMounted, screenshot, title }
}

const runField = async (browser: Browser, fieldId: string, options: SweepOptions): Promise<FieldResult> => {
  const startedAt = Date.now()
  const collected: SweepMessage[] = []
  let visit = { hasMounted: false, screenshot: null as string | null, title: '' }

  const context = await browser
    .newContext({ viewport: { height: options.viewportHeight, width: options.viewportWidth } })
    .catch(() => undefined)

  if (context) {
    const page = await context.newPage()
    const { getMessages, record } = createMessageCollector(page, options)
    try {
      visit = await visitField(page, fieldId, options)
    } catch (error) {
      record('page-error', `sweep failure: ${error instanceof Error ? error.message : String(error)}`)
    }
    collected.push(...getMessages())
    await context.close().catch(() => undefined)
  } else {
    collected.push({ count: 1, kind: 'page-error', text: 'sweep failure: could not open a browser context' })
  }

  return {
    durationMs: Date.now() - startedAt,
    fieldId,
    hasMounted: visit.hasMounted,
    messages: collected,
    screenshot: visit.screenshot,
    sweptAt: new Date().toISOString(),
    title: visit.title,
  }
}

const countKind = (result: FieldResult, kinds: MessageKind[]) =>
  result.messages.filter((message) => kinds.includes(message.kind)).reduce((total, message) => total + message.count, 0)

const getErrorCount = (result: FieldResult) => countKind(result, ['console-error', 'page-error'])
const getWarningCount = (result: FieldResult) => countKind(result, ['console-trace', 'console-warning'])
const getAssetFailureCount = (result: FieldResult) => countKind(result, ['http-error', 'request-failed'])

const getSeverity = (result: FieldResult) => {
  if (!result.hasMounted) {
    return 4
  }
  if (countKind(result, ['page-error']) > 0) {
    return 3
  }
  if (getErrorCount(result) > 0 || getAssetFailureCount(result) > 0) {
    return 2
  }
  if (getWarningCount(result) > 0) {
    return 1
  }
  return 0
}

const normalizeMessageText = (text: string) =>
  text
    .replace(/\b\d+(\.\d+)?\b/g, 'N')
    .replace(/0x[0-9a-f]+/gi, 'N')
    .slice(0, 200)

const groupMessages = (results: FieldResult[]) => {
  const groups = new Map<string, { fieldIds: Set<string>; kind: MessageKind; text: string; total: number }>()
  for (const result of results) {
    for (const message of result.messages) {
      const key = `${message.kind}::${normalizeMessageText(message.text)}`
      const existing = groups.get(key)
      if (existing) {
        existing.fieldIds.add(result.fieldId)
        existing.total += message.count
        continue
      }
      groups.set(key, {
        fieldIds: new Set([result.fieldId]),
        kind: message.kind,
        text: normalizeMessageText(message.text),
        total: message.count,
      })
    }
  }
  return [...groups.values()]
    .map((group) => ({ ...group, fieldCount: group.fieldIds.size, fieldIds: [...group.fieldIds].sort() }))
    .sort((first, second) => second.fieldCount - first.fieldCount || second.total - first.total)
}

const readResults = async (options: SweepOptions) => {
  const directory = join(options.outputDirectory, 'results')
  if (!existsSync(directory)) {
    return []
  }
  const files = (await readdir(directory)).filter((file) => file.endsWith('.json'))
  const results = await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(join(directory, file), 'utf8')) as FieldResult),
  )
  return results.sort(
    (first, second) => getSeverity(second) - getSeverity(first) || first.fieldId.localeCompare(second.fieldId),
  )
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const renderMessageRows = (result: FieldResult) =>
  result.messages
    .slice()
    .sort((first, second) => second.count - first.count)
    .map(
      (message) =>
        `<li><span class="kind ${message.kind}">${message.kind}</span> <span class="count">×${message.count}</span> ${escapeHtml(message.text)}</li>`,
    )
    .join('')

const renderFieldCard = (result: FieldResult) => {
  const severity = getSeverity(result)
  const badges = [
    !result.hasMounted ? '<span class="badge fail">never mounted</span>' : '',
    getErrorCount(result) ? `<span class="badge error">${getErrorCount(result)} errors</span>` : '',
    getAssetFailureCount(result) ? `<span class="badge error">${getAssetFailureCount(result)} asset fails</span>` : '',
    getWarningCount(result) ? `<span class="badge warn">${getWarningCount(result)} warnings</span>` : '',
  ].join('')

  const image = result.screenshot
    ? `<img loading="lazy" src="screenshots/${result.screenshot}" alt="${escapeHtml(result.fieldId)}">`
    : '<div class="noshot">no screenshot</div>'

  return `<article class="card" data-severity="${severity}">
  ${image}
  <h3>${escapeHtml(result.fieldId)}</h3>
  <p class="title">${escapeHtml(result.title.replace(TITLE_SUFFIX, '') || '—')}</p>
  <div class="badges">${badges || '<span class="badge ok">clean</span>'}</div>
  ${result.messages.length ? `<details><summary>${result.messages.length} distinct messages</summary><ul>${renderMessageRows(result)}</ul></details>` : ''}
</article>`
}

const renderGroupRows = (groups: ReturnType<typeof groupMessages>) =>
  groups
    .slice(0, 200)
    .map(
      (group) =>
        `<tr><td><span class="kind ${group.kind}">${group.kind}</span></td><td class="num">${group.fieldCount}</td><td class="num">${group.total}</td><td>${escapeHtml(group.text)}</td><td class="fields">${escapeHtml(group.fieldIds.slice(0, 12).join(', '))}${group.fieldIds.length > 12 ? ` +${group.fieldIds.length - 12}` : ''}</td></tr>`,
    )
    .join('')

const renderReport = (results: FieldResult[], groups: ReturnType<typeof groupMessages>) => {
  const cleanCount = results.filter((result) => getSeverity(result) === 0).length
  const unmountedCount = results.filter((result) => !result.hasMounted).length

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Field sweep</title>
<style>
  :root { color-scheme: dark; }
  body { background: #14161a; color: #e6e8ec; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .summary { color: #9aa3b2; margin-bottom: 20px; }
  .controls { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; position: sticky; top: 0; background: #14161a; padding: 8px 0; z-index: 2; }
  button { background: #232833; border: 1px solid #333b49; color: #e6e8ec; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
  button.active { background: #3b82f6; border-color: #3b82f6; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 32px; }
  th, td { border-bottom: 1px solid #262c38; padding: 6px 8px; text-align: left; vertical-align: top; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.fields { color: #9aa3b2; font-size: 12px; max-width: 320px; }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
  .card { background: #1b1f27; border: 1px solid #262c38; border-radius: 8px; overflow: hidden; padding-bottom: 12px; }
  .card img { display: block; width: 100%; aspect-ratio: 10 / 7; object-fit: cover; background: #000; }
  .noshot { align-items: center; aspect-ratio: 10 / 7; background: #000; color: #6b7280; display: flex; justify-content: center; }
  .card h3 { font-family: ui-monospace, monospace; font-size: 14px; margin: 10px 12px 0; }
  .card .title { color: #9aa3b2; margin: 2px 12px 8px; font-size: 12px; }
  .badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 12px; }
  .badge { border-radius: 4px; font-size: 11px; padding: 2px 6px; }
  .badge.ok { background: #14432a; color: #5ee9a0; }
  .badge.warn { background: #45330d; color: #f5c451; }
  .badge.error { background: #4a1d1d; color: #ff8a8a; }
  .badge.fail { background: #5b1030; color: #ff9ec4; }
  details { margin: 10px 12px 0; }
  summary { cursor: pointer; color: #9aa3b2; font-size: 12px; }
  details ul { list-style: none; margin: 8px 0 0; padding: 0; }
  details li { border-top: 1px solid #262c38; font-family: ui-monospace, monospace; font-size: 11px; padding: 6px 0; word-break: break-word; }
  .kind { border-radius: 3px; font-size: 10px; padding: 1px 4px; background: #2b3240; color: #b9c2d0; }
  .kind.page-error, .kind.console-error { background: #4a1d1d; color: #ff8a8a; }
  .kind.console-warning, .kind.console-trace { background: #45330d; color: #f5c451; }
  .count { color: #6b7280; }
</style>
</head>
<body>
<h1>Field sweep</h1>
<p class="summary">${results.length} fields swept · ${cleanCount} clean · ${unmountedCount} never mounted · generated ${new Date().toLocaleString()}</p>

<h2>Messages grouped across fields</h2>
<table>
  <thead><tr><th>Kind</th><th class="num">Fields</th><th class="num">Total</th><th>Message</th><th>Fields</th></tr></thead>
  <tbody>${renderGroupRows(groups)}</tbody>
</table>

<h2>Fields</h2>
<div class="controls">
  <button class="active" data-min="0">All</button>
  <button data-min="1">Warnings and worse</button>
  <button data-min="2">Errors and worse</button>
  <button data-min="4">Never mounted</button>
</div>
<div class="grid">${results.map(renderFieldCard).join('\n')}</div>

<script>
  const buttons = [...document.querySelectorAll('.controls button')]
  const cards = [...document.querySelectorAll('.card')]
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      buttons.forEach((other) => other.classList.toggle('active', other === button))
      const minimum = Number(button.dataset.min)
      cards.forEach((card) => {
        const severity = Number(card.dataset.severity)
        card.hidden = minimum === 4 ? severity !== 4 : severity < minimum
      })
    })
  })
</script>
</body>
</html>`
}

const writeReport = async (options: SweepOptions) => {
  const results = await readResults(options)
  const groups = groupMessages(results)
  await writeFile(join(options.outputDirectory, 'report.json'), JSON.stringify({ groups, results }, null, 2))
  await writeFile(join(options.outputDirectory, 'index.html'), renderReport(results, groups))
  return results
}

const formatFieldLine = (index: number, total: number, result: FieldResult) => {
  const position = `[${String(index + 1).padStart(String(total).length, ' ')}/${total}]`
  const status = result.hasMounted ? 'ok     ' : 'NOMOUNT'
  const counts = `${getErrorCount(result)}e ${getWarningCount(result)}w ${getAssetFailureCount(result)}a`
  return `${position} ${result.fieldId.padEnd(12)} ${status} ${counts.padEnd(12)} ${(result.durationMs / 1000).toFixed(1)}s`
}

const printSummary = (results: FieldResult[]) => {
  const unmounted = results.filter((result) => !result.hasMounted)
  const withErrors = results.filter((result) => result.hasMounted && getErrorCount(result) > 0)

  console.log(`\nSwept ${results.length} fields.`)
  console.log(`  never mounted: ${unmounted.length}`)
  console.log(`  mounted with errors: ${withErrors.length}`)
  console.log(`  clean: ${results.filter((result) => getSeverity(result) === 0).length}`)
  if (unmounted.length) {
    console.log(`\nNever mounted: ${unmounted.map((result) => result.fieldId).join(', ')}`)
  }
}

const main = async () => {
  const options = buildOptions(process.argv.slice(2))
  await mkdir(join(options.outputDirectory, 'results'), { recursive: true })
  await mkdir(join(options.outputDirectory, 'screenshots'), { recursive: true })

  if (options.isReportOnly) {
    const existingResults = await writeReport(options)
    printSummary(existingResults)
    console.log(`\nReport: ${join(options.outputDirectory, 'index.html')}`)
    return
  }

  const fieldIds = await getFieldIds(options)
  const server = await startDevServer(options)
  let browser = await launchBrowser(options)

  let isStopping = false
  const stop = () => {
    isStopping = true
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  console.log(`Sweeping ${fieldIds.length} fields into ${options.outputDirectory}\n`)

  let sweptCount = 0
  for (const [index, fieldId] of fieldIds.entries()) {
    if (isStopping) {
      console.log('\nStopping early, writing the report for what has run so far.')
      break
    }

    const resultPath = join(options.outputDirectory, 'results', `${fieldId}.json`)
    if (!options.isFresh && existsSync(resultPath)) {
      continue
    }

    const isDueForRestart = sweptCount > 0 && sweptCount % options.restartEvery === 0
    if (isDueForRestart || !browser.isConnected()) {
      await browser.close().catch(() => undefined)
      browser = await launchBrowser(options)
    }

    const result = await runField(browser, fieldId, options)
    await writeFile(resultPath, JSON.stringify(result, null, 2))
    console.log(formatFieldLine(index, fieldIds.length, result))

    sweptCount++
    if (sweptCount % REPORT_EVERY === 0) {
      await writeReport(options)
    }
  }

  const results = await writeReport(options)
  await browser.close().catch(() => undefined)
  server?.kill()

  printSummary(results)
  console.log(`\nReport: ${join(options.outputDirectory, 'index.html')}`)
}

await main()
