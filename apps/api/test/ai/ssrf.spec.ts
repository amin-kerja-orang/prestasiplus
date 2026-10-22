import { describe, expect, it } from 'vitest'

import { AiConfig } from '../../src/modules/ai-extraction/ai.config'
import type { AiResolver } from '../../src/modules/ai-extraction/ai.types'
import { isPrivateAddress } from '../../src/modules/ai-extraction/net/ip'
import { createPinnedFetch } from '../../src/modules/ai-extraction/net/pinned-fetch'
import { checkProviderUrl, checkUrlShape, UnsafeUrlError } from '../../src/modules/ai-extraction/net/safe-url'
import { ProviderAttemptError } from '../../src/modules/ai-extraction/providers/provider-errors'
import { ProviderHttp } from '../../src/modules/ai-extraction/providers/provider-http'
import { createProvider } from '../../src/modules/ai-extraction/providers/registry'
import { FAKE_KEY, jsonResponse, publicResolver, stubFetch } from './helpers'

const ALLOW = ['gateway.example.test', '*.gw.example.test']
const policy = (resolver: AiResolver = publicResolver) => ({ allowlist: ALLOW, resolver })

const refused = async (url: string, reason: UnsafeUrlError['reason'], resolver?: AiResolver) => {
  await expect(checkProviderUrl(url, policy(resolver))).rejects.toMatchObject({ name: 'UnsafeUrlError', reason })
}

function config(env: Record<string, string>): AiConfig {
  const data: Record<string, string> = { AI_PROVIDER: 'openai-compatible', AI_MODEL: 'model-x', AI_API_KEY: FAKE_KEY, AI_PRICE_TABLE_JSON: '{"openai-compatible":{"*":{"inSenPerMTok":1,"outSenPerMTok":1}},"openai":{"*":{"inSenPerMTok":1,"outSenPerMTok":1}},"anthropic":{"*":{"inSenPerMTok":1,"outSenPerMTok":1}}}', ...env }
  return new AiConfig({ get: (k: string) => data[k] } as never)
}

describe('SSRF: provider URL (AC8)', () => {
  it('accepts an https URL on an allow-listed host that resolves to public addresses', async () => {
    const ok = await checkProviderUrl('https://gateway.example.test/v1', policy())
    expect(ok.url.hostname).toBe('gateway.example.test')
    expect(ok.addresses).toEqual(['93.184.216.34'])
    expect((await checkProviderUrl('https://a.gw.example.test/v1', policy())).url.hostname).toBe('a.gw.example.test')
  })

  it('refuses http, other schemes, credentials in the URL and other ports', async () => {
    await refused('http://gateway.example.test/v1', 'scheme')
    await refused('ftp://gateway.example.test/v1', 'scheme')
    await refused('file:///etc/passwd', 'scheme')
    await refused('https://user:pw@gateway.example.test/v1', 'credentials')
    await refused('https://gateway.example.test:8443/v1', 'port')
    await refused('not a url', 'invalid')
  })

  it('refuses a host that is not on the allow-list (also a look-alike and an empty list)', async () => {
    await refused('https://evil.example.test/v1', 'host_not_allowed')
    await refused('https://gateway.example.test.evil.test/v1', 'host_not_allowed')
    await refused('https://gw.example.test/v1', 'host_not_allowed') // the wildcard needs a label in front
    await expect(checkProviderUrl('https://gateway.example.test/v1', { allowlist: [], resolver: publicResolver })).rejects.toMatchObject({ reason: 'host_not_allowed' })
  })

  it.each([
    ['127.0.0.1'], ['10.1.2.3'], ['172.16.0.1'], ['172.31.255.255'], ['192.168.1.1'], ['169.254.169.254'], ['100.100.100.200'], ['0.0.0.0'],
    ['224.0.0.1'], ['255.255.255.255'], ['::1'], ['::'], ['fe80::1'], ['fd00:ec2::254'], ['fc00::1'], ['::ffff:127.0.0.1'], ['::ffff:7f00:1'],
    ['::ffff:169.254.169.254'], ['64:ff9b::7f00:1'], ['2002:7f00:1::1'], ['not-an-ip'],
  ])('treats %s as a private address', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true)
  })

  it.each([['93.184.216.34'], ['8.8.8.8'], ['172.15.0.1'], ['172.32.0.1'], ['100.63.0.1'], ['2606:4700:4700::1111'], ['::ffff:8.8.8.8']])('treats %s as public', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false)
  })

  it('refuses private IP literals even when they are on the allow-list (v4, v6, decimal and hex forms)', async () => {
    const allow = ['127.0.0.1', '[::1]', '169.254.169.254', '[::ffff:7f00:1]', '2130706433', '10.0.0.5']
    for (const url of ['https://127.0.0.1/v1', 'https://[::1]/v1', 'https://169.254.169.254/latest', 'https://[::ffff:127.0.0.1]/', 'https://2130706433/', 'https://0x7f.1/', 'https://10.0.0.5/']) {
      expect(() => checkUrlShape(url, [...allow, new URL(url).hostname.replace(/^\[|\]$/g, '')]), url).toThrow(UnsafeUrlError)
    }
  })

  it('refuses internal-looking names (localhost, .internal, .local)', () => {
    expect(() => checkUrlShape('https://localhost/v1', ['localhost'])).toThrow(UnsafeUrlError)
    expect(() => checkUrlShape('https://metadata.google.internal/', ['metadata.google.internal'])).toThrow(UnsafeUrlError)
    expect(() => checkUrlShape('https://printer.local/', ['printer.local'])).toThrow(UnsafeUrlError)
  })

  it('refuses DNS rebinding: an allow-listed name that resolves to a private address (any one of several answers)', async () => {
    await refused('https://gateway.example.test/v1', 'private_address', () => Promise.resolve(['127.0.0.1']))
    await refused('https://gateway.example.test/v1', 'private_address', () => Promise.resolve(['93.184.216.34', '10.0.0.8']))
    await refused('https://gateway.example.test/v1', 'private_address', () => Promise.resolve(['::1']))
    await refused('https://gateway.example.test/v1', 'private_address', () => Promise.resolve(['169.254.169.254']))
    await refused('https://gateway.example.test/v1', 'unresolvable', () => Promise.resolve([]))
    await refused('https://gateway.example.test/v1', 'unresolvable', () => Promise.reject(new Error('ENOTFOUND')))
  })

  it('the resolver is asked again at every call (a name that turns private later is refused)', async () => {
    let answer = '93.184.216.34'
    const resolver: AiResolver = () => Promise.resolve([answer])
    await expect(checkProviderUrl('https://gateway.example.test/v1', policy(resolver))).resolves.toBeTruthy()
    answer = '192.168.0.9'
    await refused('https://gateway.example.test/v1', 'private_address', resolver)
  })
})

describe('SSRF: the openai-compatible adapter', () => {
  const mk = (env: Record<string, string>, fetch = stubFetch(() => jsonResponse({}, 200)), resolver: AiResolver = publicResolver) => {
    const cfg = config(env)
    const provider = createProvider(cfg, fetch.fn, resolver)
    return { provider, fetch }
  }
  const call = (p: ReturnType<typeof mk>['provider']) => p.generateText({ purpose: 'x', system: 's', input: 'i' }, { signal: new AbortController().signal })

  it('is not configured when the base URL is http, not allow-listed, a private literal or missing', () => {
    for (const base of ['http://gateway.example.test/v1', 'https://evil.example.test/v1', 'https://127.0.0.1/v1', 'https://[::1]/v1', '']) {
      expect(mk({ AI_BASE_URL: base, AI_BASE_URL_ALLOWLIST: 'gateway.example.test,127.0.0.1,[::1]' }).provider.isConfigured(), base).toBe(false)
    }
    expect(mk({ AI_BASE_URL: 'https://gateway.example.test/v1', AI_BASE_URL_ALLOWLIST: 'gateway.example.test' }).provider.isConfigured()).toBe(true)
  })

  it('never sends a request when the URL is unsafe: not allow-listed, and DNS rebinding to private ranges', async () => {
    const a = mk({ AI_BASE_URL: 'https://evil.example.test/v1', AI_BASE_URL_ALLOWLIST: 'gateway.example.test' })
    await expect(call(a.provider)).rejects.toBeInstanceOf(ProviderAttemptError)
    expect(a.fetch.calls).toHaveLength(0)

    for (const addr of ['127.0.0.1', '169.254.169.254', '::1', '10.0.0.1']) {
      const b = mk({ AI_BASE_URL: 'https://gateway.example.test/v1', AI_BASE_URL_ALLOWLIST: 'gateway.example.test' }, undefined, () => Promise.resolve([addr]))
      await expect(call(b.provider), addr).rejects.toMatchObject({ kind: 'fatal' })
      expect(b.fetch.calls, addr).toHaveLength(0)
    }
  })

  it('sends to the validated addresses only, with redirects disabled', async () => {
    const f = stubFetch(() => jsonResponse({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
    const { provider } = mk({ AI_BASE_URL: 'https://gateway.example.test/v1/', AI_BASE_URL_ALLOWLIST: 'gateway.example.test' }, f)
    await call(provider)
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0]?.url).toBe('https://gateway.example.test/v1/chat/completions')
    expect(f.calls[0]?.redirect).toBe('manual')
    expect(f.calls[0]?.pinned).toEqual(['93.184.216.34'])
  })

  it('does not follow a redirect to an internal address: the 3xx is a failure and nothing is requested again', async () => {
    for (const status of [301, 302, 307, 308]) {
      const f = stubFetch(() => new Response(null, { status, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }))
      const { provider } = mk({ AI_BASE_URL: 'https://gateway.example.test/v1', AI_BASE_URL_ALLOWLIST: 'gateway.example.test' }, f)
      await expect(call(provider), String(status)).rejects.toMatchObject({ kind: 'fatal', status })
      expect(f.calls, String(status)).toHaveLength(1)
    }
  })

  it('the fixed vendors cannot be pointed elsewhere: the host is part of the adapter, AI_BASE_URL is ignored', async () => {
    const f = stubFetch(() => jsonResponse({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }))
    const cfg = config({ AI_PROVIDER: 'anthropic', AI_BASE_URL: 'https://evil.example.test/', AI_BASE_URL_ALLOWLIST: 'evil.example.test' })
    const provider = createProvider(cfg, f.fn, publicResolver)
    await provider.generateText({ purpose: 'x', system: 's', input: 'i' }, { signal: new AbortController().signal })
    expect(new URL(f.calls[0]?.url ?? '').hostname).toBe('api.anthropic.com')
  })

  it('the first-party hosts are also checked after DNS (a poisoned answer is refused)', async () => {
    const f = stubFetch(() => jsonResponse({}))
    const provider = createProvider(config({ AI_PROVIDER: 'openai' }), f.fn, () => Promise.resolve(['10.9.8.7']))
    await expect(provider.generateText({ purpose: 'x', system: 's', input: 'i' }, { signal: new AbortController().signal })).rejects.toBeInstanceOf(ProviderAttemptError)
    expect(f.calls).toHaveLength(0)
  })
})

describe('the default transport', () => {
  it('refuses a request without validated addresses or with a private one (it never resolves by itself)', async () => {
    const fetchImpl = createPinnedFetch()
    const base = { method: 'POST', headers: {}, body: '{}', signal: new AbortController().signal, redirect: 'manual' } as const
    await expect(fetchImpl('https://gateway.example.test/v1', base)).rejects.toThrow()
    await expect(fetchImpl('https://gateway.example.test/v1', { ...base, pinnedAddresses: ['127.0.0.1'] })).rejects.toThrow()
    await expect(fetchImpl('http://gateway.example.test/v1', { ...base, pinnedAddresses: ['93.184.216.34'] })).rejects.toThrow()
  })

  it('ProviderHttp rejects with the same error when the transport throws (no host or cause leaks)', async () => {
    const http = new ProviderHttp(() => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.1:443 CANARY-HOST')), publicResolver, 'openai-compatible')
    const err = await http.postJson({ url: 'https://gateway.example.test/v1', allowlist: ALLOW, headers: {}, body: {}, signal: new AbortController().signal }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderAttemptError)
    expect(String((err as Error).message)).not.toContain('CANARY-HOST')
    expect((err as Error & { cause?: unknown }).cause).toBeUndefined()
  })
})
