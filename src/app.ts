import { Hono } from 'hono'
import * as Minio from 'minio'
import { cors } from 'hono/cors'
import { getObject, serveStatic } from './helper'

if (
  !process.env.S3_ENDPOINT ||
  !process.env.S3_PORT ||
  !process.env.S3_ACCESS_KEY ||
  !process.env.S3_SECRET_KEY ||
  !process.env.S3_BUCKET_NAME
) {
  throw new Error('You must complete the env variables')
}

const s3Config: Minio.ClientOptions = {
  endPoint: process.env.S3_ENDPOINT!,
  port: Number(process.env.S3_PORT),
  useSSL: (process.env.S3_USE_SSL || 'false') === 'true',
  accessKey: process.env.S3_ACCESS_KEY!,
  secretKey: process.env.S3_SECRET_KEY!,
  region: process.env.S3_REGION || 'auto',
  pathStyle: (process.env.S3_PATH_STYLE || 'true') === 'true',
}

console.log('S3 Compatible Config:', {
  ...s3Config,
  secretKey: s3Config.secretKey?.substring(0, 4) + '***',
})

const s3Client = new Minio.Client(s3Config)
const app = new Hono()

app.use('*', async (ctx, next) => {
  console.log(`[${new Date().toISOString()}] ${ctx.req.method} ${ctx.req.path}`)
  await next()
})

app.use(cors())
app.get('/favicon.ico', (ctx) => serveStatic(ctx, 'favicon.ico'))
app.notFound((ctx) => serveStatic(ctx, '404.html', 404))

app.get('/up', async (ctx) => {
  const bucketName = process.env.S3_BUCKET_NAME || '*'

  try {
    if (bucketName !== '*') {
      await s3Client.bucketExists(bucketName)
    } else {
      await s3Client.listBuckets()
    }

    ctx.status(200)
    return ctx.json({ error: null, bucket: bucketName })
  } catch (error) {
    ctx.status(500)
    return ctx.json({ error: 'Unable to retrieve bucket(s)', bucket: bucketName })
  }
})

app.get('*', async (ctx) => {
  const configBucket = process.env.S3_BUCKET_NAME || '*'
  let path = ctx.req.path.replace(/^\//, '')
  let bucket = configBucket

  if (configBucket === '*') {
    const parts = path.split('/')
    bucket = parts.shift() || ''
    path = parts.join('/')

    if (!bucket) return ctx.notFound()
  }

  if (path === '' || path.endsWith('/')) {
    path += 'index.html'
  }

  try {
    const object = await getObject(s3Client, bucket, path)
    const contentType = object.stat.metaData['content-type'] || 'application/octet-stream'

    if (object.stat.size === 0 && contentType === 'binary/octet-stream') {
      return ctx.notFound()
    }

    ctx.header('ETag', object.stat.etag)
    ctx.header('Content-Type', contentType)

    const cacheControl = process.env.CDN_CACHE_CONTROL || 'public, max-age=31536000, immutable'
    ctx.header('Cache-Control', cacheControl)

    return ctx.body(object.stream as any)
  } catch (error) {
    if (path !== 'index.html') {
      console.error(`Error fetching bucket "${bucket}" path "${path}":`, error)
    }
  }

  return ctx.notFound()
})

const hostname = process.env.CDN_HOST || process.env.HOST || '127.0.0.1'
const port = parseInt(process.env.CDN_PORT || process.env.PORT || '3000')

console.log(`Running at http://${hostname}:${port}`)

export default { hostname, port, fetch: app.fetch }
