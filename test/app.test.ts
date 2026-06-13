import { expect, test, describe, beforeAll, afterAll } from 'bun:test'
import { Hono } from 'hono'

let app: any
let mockS3Server: any

beforeAll(async () => {
  // 1. Set up environment variables before importing the app
  process.env.S3_ENDPOINT = '127.0.0.1'
  process.env.S3_PORT = '9001'
  process.env.S3_ACCESS_KEY = 'test-access-key'
  process.env.S3_SECRET_KEY = 'test-secret-key'
  process.env.S3_BUCKET_NAME = '*'
  process.env.S3_USE_SSL = 'false'
  process.env.S3_PATH_STYLE = 'true'

  app = (await import('../src/app')).default
  const mockS3 = new Hono()

  mockS3.use('*', async (c, next) => {
    console.log(`[Mock S3] ${c.req.method} ${c.req.path}`)
    await next()
  })

  // HEAD * (bucketExists, statObject)
  mockS3.on('HEAD', '*', (c) => {
    const path = c.req.path.replace(/^\//, '')
    const parts = path.split('/')
    const bucket = parts[0]
    const filename = parts.slice(1).join('/')

    if (bucket === 'nonexistent') {
      return new Response(null, { status: 404 })
    }
    if (bucket === 'errorbucket') {
      return new Response(null, { status: 500 })
    }
    if (filename) {
      if (filename.includes('error-file')) {
        return new Response(null, { status: 404 })
      }
      if (filename.includes('access-denied-file')) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>AccessDenied</Code>
  <Message>Access Denied</Message>
</Error>`,
          {
            status: 403,
            headers: { 'Content-Type': 'application/xml' },
          }
        )
      }
    }
    return new Response(null, {
      status: 200,
      headers: {
        'ETag': '"mock-etag"',
        'Content-Type': 'image/jpeg',
        'Content-Length': '12',
      },
    })
  })

  // GET * (listBuckets, getObject)
  mockS3.get('*', (c) => {
    const path = c.req.path.replace(/^\//, '')
    if (path === '') {
      // listBuckets
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Buckets>
    <Bucket>
      <Name>my-bucket</Name>
      <CreationDate>2026-01-01T00:00:00.000Z</CreationDate>
    </Bucket>
  </Buckets>
  <Owner>
    <ID>owner-id</ID>
    <DisplayName>owner</DisplayName>
  </Owner>
</ListAllMyBucketsResult>`,
        {
          status: 200,
          headers: { 'Content-Type': 'application/xml' },
        }
      )
    }

    const parts = path.split('/')
    const bucket = parts[0]
    const filename = parts.slice(1).join('/')

    if (bucket === 'nonexistent') {
      return new Response(null, { status: 404 })
    }
    if (bucket === 'errorbucket') {
      return new Response(null, { status: 500 })
    }
    if (filename) {
      if (filename.includes('error-file')) {
        return new Response(null, { status: 404 })
      }
      if (filename.includes('access-denied-file')) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>AccessDenied</Code>
  <Message>Access Denied</Message>
</Error>`,
          {
            status: 403,
            headers: { 'Content-Type': 'application/xml' },
          }
        )
      }
    }
    return new Response('hello-object', {
      status: 200,
      headers: {
        'ETag': '"mock-etag"',
        'Content-Type': 'image/jpeg',
        'Content-Length': '12',
      },
    })
  })

  mockS3Server = Bun.serve({
    port: 9001,
    hostname: '127.0.0.1',
    fetch: mockS3.fetch,
  })
})

afterAll(() => {
  mockS3Server.stop()
})

describe('Edgea CDN App Tests', () => {
  test('GET /up returns status 200 and bucket info', async () => {
    const res = await app.fetch(new Request('http://localhost/up'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.error).toBeNull()
    expect(json.bucket).toBe('*')
  })

  test('GET /up returns status 200 with specific bucket when bucketName is not *', async () => {
    try {
      process.env.S3_BUCKET_NAME = 'specific-bucket'
      const res = await app.fetch(new Request('http://localhost/up'))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.bucket).toBe('specific-bucket')
    } finally {
      process.env.S3_BUCKET_NAME = '*'
    }
  })

  test('GET /up returns status 500 when bucket check fails', async () => {
    try {
      process.env.S3_BUCKET_NAME = 'errorbucket'
      const res = await app.fetch(new Request('http://localhost/up'))
      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).toBe('Unable to retrieve bucket(s)')
    } finally {
      process.env.S3_BUCKET_NAME = '*'
    }
  })

  test('GET /my-bucket/image.jpg returns the object from mock S3', async () => {
    const res = await app.fetch(new Request('http://localhost/my-bucket/image.jpg'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('ETag')).toBe('mock-etag')
    const text = await res.text()
    expect(text).toBe('hello-object')
  })

  test('GET /my-bucket/image.jpg cache hit on second request', async () => {
    // 1st request -> fetches and caches
    await app.fetch(new Request('http://localhost/my-bucket/image.jpg'))
    // 2nd request -> cache hit
    const res = await app.fetch(new Request('http://localhost/my-bucket/image.jpg'))
    expect(res.status).toBe(200)
  })

  test('GET /my-bucket/ maps to index.html', async () => {
    const res = await app.fetch(new Request('http://localhost/my-bucket/'))
    expect(res.status).toBe(200)
  })

  test('GET /my-bucket/error-file returns 404 Not Found', async () => {
    const res = await app.fetch(new Request('http://localhost/my-bucket/error-file'))
    expect(res.status).toBe(404)
  })

  test('GET /my-bucket/access-denied-file handles AccessDenied error and retries', async () => {
    const res = await app.fetch(new Request('http://localhost/my-bucket/access-denied-file'))
    expect(res.status).toBe(404)
  })
})
