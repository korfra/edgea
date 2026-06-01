import { Hono } from 'hono'
import * as Minio from 'minio'
import { cors } from 'hono/cors'
import { getObject, serveStatic } from './helper'

if (
  !process.env.MINIO_ENDPOINT ||
  !process.env.MINIO_PORT ||
  !process.env.MINIO_ACCESS_KEY ||
  !process.env.MINIO_SECRET_KEY ||
  !process.env.MINIO_BUCKET_NAME
) {
  throw new Error('You must complete the env variables')
}

const minioConfig: Minio.ClientOptions = {
  endPoint: process.env.MINIO_ENDPOINT!,
  port: Number(process.env.MINIO_PORT),
  useSSL: (process.env.MINIO_USE_SSL || 'false') === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
  region: process.env.MINIO_REGION || 'auto',
  pathStyle: (process.env.MINIO_PATH_STYLE || 'true') === 'true',
}

console.log('MinIO Config:', {
  ...minioConfig,
  secretKey: minioConfig.secretKey?.substring(0, 4) + '***',
})

const minio = new Minio.Client(minioConfig)
const app = new Hono()

app.use('*', async (ctx, next) => {
  console.log(`[${new Date().toISOString()}] ${ctx.req.method} ${ctx.req.path}`)
  await next()
})

app.use(cors())
app.get('/favicon.ico', (ctx) => serveStatic(ctx, 'favicon.ico'))
app.notFound((ctx) => serveStatic(ctx, '404.html', 404))

app.get('/up', async (ctx) => {
  const bucketName = process.env.MINIO_BUCKET_NAME || '*'

  try {
    if (bucketName !== '*') {
      await minio.bucketExists(bucketName)
    } else {
      await minio.listBuckets()
    }

    ctx.status(200)
    return ctx.json({ error: null, bucket: bucketName })
  } catch (error) {
    ctx.status(500)
    return ctx.json({ error: 'Unable to retrieve bucket(s)', bucket: bucketName })
  }
})

app.get('*', async (ctx) => {
  const configBucket = process.env.MINIO_BUCKET_NAME || '*'
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
    const object = await getObject(minio, bucket, path)
    const contentType = object.stat.metaData['content-type'] || 'application/octet-stream'

    if (object.stat.size === 0 && contentType === 'binary/octet-stream') {
      return ctx.notFound()
    }

    ctx.header('ETag', object.stat.etag)
    ctx.header('Content-Type', contentType)

    const cacheControl = process.env.MINIO_CACHE_CONTROL || 'public, max-age=31536000, immutable'
    ctx.header('Cache-Control', cacheControl)

    return ctx.body(object.stream as any)
  } catch (error) {
    if (path !== 'index.html') {
      console.error(`Error fetching bucket "${bucket}" path "${path}":`, error)
    }
  }

  return ctx.notFound()
})

const hostname = process.env.MINIO_CDN_HOST || process.env.HOST || '127.0.0.1'
const port = parseInt(process.env.MINIO_CDN_PORT || process.env.PORT || '3000')

console.log(`Running at http://${hostname}:${port}`)

export default { hostname, port, fetch: app.fetch }
