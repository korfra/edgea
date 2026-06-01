import type { Context, Env } from 'hono'
import type { BucketItemStat, Client } from 'minio'
import type { StatusCode } from 'hono/utils/http-status'
import { LRUCache } from 'lru-cache'

export const serveStatic = (ctx: Context<Env, any, {}>, path: string, status: StatusCode = 200) => {
  const file = Bun.file(`./static/${path}`)

  ctx.status(status)
  ctx.header('Content-Type', file.type)

  return ctx.body(file.stream())
}

type CachedObject = {
  stat: BucketItemStat
  buffer: Buffer
}

const cache = new LRUCache<string, CachedObject>({
  max: parseInt(process.env.CACHE_MAX_ITEMS || '500'),
  maxSize: parseInt(process.env.CACHE_MAX_SIZE_MB || '50') * 1024 * 1024,
  sizeCalculation: (value) => value.buffer.length,
  ttl: parseInt(process.env.CACHE_TTL_SEC || '3600') * 1000,
})

export const getObject = async (
  minio: Client,
  bucket: string,
  object: string,
  retry = 1
): Promise<{ stat: BucketItemStat; stream: ReadableStream | Buffer }> => {
  const cacheKey = `${bucket}:${object}`
  const cached = cache.get(cacheKey)

  if (cached) {
    return { stat: cached.stat, stream: cached.buffer }
  }

  try {
    const stat = await minio.statObject(bucket, object)
    const readable = await minio.getObject(bucket, object)

    const chunks = []
    for await (const chunk of readable) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    cache.set(cacheKey, { stat, buffer })

    return { stat, stream: buffer }
  } catch (error: any) {
    if (retry > 0 && error.code === 'AccessDenied') {
      console.log(`Retrying object fetch for "${object}" due to AccessDenied...`)
      return getObject(minio, bucket, object, retry - 1)
    }
    throw error
  }
}
