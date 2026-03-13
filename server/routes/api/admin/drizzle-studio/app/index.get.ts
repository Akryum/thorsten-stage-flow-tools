import { verifyAdmin } from '../../../../../utils/auth'

const DRIZZLE_STUDIO_APP_ORIGIN = 'https://local.drizzle.studio'

function injectStudioProxy(html: string) {
  const analyticsScript = new RegExp(
    '<script defer="defer" data-site-id="local\\.drizzle\\.studio" '
    + 'src="https:\\/\\/assets\\.onedollarstats\\.com\\/stonks\\.js"><\\/script>',
  )
  const studioScript = '<script type="module" crossorigin src="./index.js"></script>'
  const proxyBootstrap = [
    '<script>',
    '(() => {',
    '  const proxyPath = "/api/admin/drizzle-studio/rpc"',
    '  const shouldProxy = (method, rawUrl) => {',
    '    try {',
    '      const resolvedUrl = new URL(rawUrl, window.location.href)',
    '      return method.toUpperCase() === "POST"',
    '        && resolvedUrl.origin === window.location.origin',
    '        && resolvedUrl.pathname === "/"',
    '    }',
    '    catch {',
    '      return false',
    '    }',
    '  }',
    '',
    '  const rewriteUrl = (rawUrl) => {',
    '    const resolvedUrl = new URL(rawUrl, window.location.href)',
    '    return `${proxyPath}${resolvedUrl.search}`',
    '  }',
    '',
    '  const originalFetch = window.fetch.bind(window)',
    '  window.fetch = (input, init) => {',
    '    const method = init?.method || (input instanceof Request ? input.method : "GET")',
    '    const rawUrl = typeof input === "string" || input instanceof URL',
    '      ? input.toString()',
    '      : input instanceof Request ? input.url : ""',
    '',
    '    if (shouldProxy(method, rawUrl)) {',
    '      const rewrittenUrl = rewriteUrl(rawUrl)',
    '',
    '      if (input instanceof Request) {',
    '        return originalFetch(new Request(rewrittenUrl, input), init)',
    '      }',
    '',
    '      return originalFetch(rewrittenUrl, init)',
    '    }',
    '',
    '    return originalFetch(input, init)',
    '  }',
    '',
    '  if (window.XMLHttpRequest) {',
    '    const originalOpen = window.XMLHttpRequest.prototype.open',
    '    window.XMLHttpRequest.prototype.open = function (method, url, async, user, password) {',
    '      if (typeof url === "string" && shouldProxy(method, url)) {',
    '        return originalOpen.call(this, method, rewriteUrl(url), async, user, password)',
    '      }',
    '',
    '      return originalOpen.call(this, method, url, async, user, password)',
    '    }',
    '  }',
    '})()',
    '</script>',
    studioScript,
  ].join('')

  const withoutAnalytics = html.replace(analyticsScript, '')

  if (withoutAnalytics.includes(studioScript)) {
    return withoutAnalytics.replace(studioScript, proxyBootstrap)
  }

  return withoutAnalytics.replace('</head>', `${proxyBootstrap}</head>`)
}

export default defineEventHandler(async (event) => {
  await verifyAdmin(event)

  const response = await fetch(`${DRIZZLE_STUDIO_APP_ORIGIN}/`)

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to load Drizzle Studio (${response.status})`,
    })
  }

  setHeader(
    event,
    'content-type',
    response.headers.get('content-type') || 'text/html; charset=utf-8',
  )
  setHeader(event, 'cache-control', 'no-store')

  return injectStudioProxy(await response.text())
})
