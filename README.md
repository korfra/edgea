# MinIO CDN

Serve S3 MinIO files like Cloudflare R2.<br>
It's very lightweight and fast, powered by [Bun](https://bun.sh).

## Features

- **Brutal Caching**: Dual-layer caching (Browser/CDN & In-Memory LRU Cache).
- **Multi-Bucket Support**: Serve files from a specific bucket or all buckets.
- **Auto-Retry**: Automatically handles transient `AccessDenied` errors on initial access.
- **Lightweight**: Built with Hono and Bun for maximum performance.

## Requirements

- Bun `>= 1.3.x`

## Getting Started

1. Clone this repository
2. Install dependencies: `bun install`
3. Copy `.env.example` to `.env` and fill the variables.
4. Run it: `bun src/app.ts`

## Environment Variables

| Variable              | Default                               | Description                                 |
| --------------------- | ------------------------------------- | ------------------------------------------- |
| `MINIO_ENDPOINT`      | -                                     | MinIO/S3 Endpoint                           |
| `MINIO_PORT`          | -                                     | MinIO/S3 Port                               |
| `MINIO_ACCESS_KEY`    | -                                     | MinIO Access Key                            |
| `MINIO_SECRET_KEY`    | -                                     | MinIO Secret Key                            |
| `MINIO_BUCKET_NAME`   | `*`                                   | Bucket name. Use `*` for multi-bucket mode. |
| `MINIO_REGION`        | `auto`                                | MinIO Region (e.g., `us-east-1`)            |
| `MINIO_USE_SSL`       | `false`                               | Use SSL for MinIO connection                |
| `MINIO_PATH_STYLE`    | `true`                                | Use path-style access for MinIO             |
| `MINIO_CACHE_CONTROL` | `public, max-age=31536000, immutable` | Browser/CDN Cache header                    |
| `MINIO_CDN_HOST`      | `127.0.0.1`                           | CDN Server Host                             |
| `MINIO_CDN_PORT`      | `3000`                                | CDN Server Port                             |
| `CACHE_MAX_ITEMS`     | `500`                                 | Max items in memory cache                   |
| `CACHE_MAX_SIZE_MB`   | `50`                                  | Max RAM usage for cache in MB               |
| `CACHE_TTL_SEC`       | `3600`                                | In-memory cache TTL in seconds              |

## Multi-Bucket Mode

When `MINIO_BUCKET_NAME` is set to `*`, the application expects the first segment of the path to be the bucket name:

- `http://localhost:3000/my-bucket/image.jpg` -> serves `image.jpg` from `my-bucket`.

## Docker

```bash
docker run -d \
  -e MINIO_ACCESS_KEY='...' \
  -e MINIO_SECRET_KEY='...' \
  -e MINIO_BUCKET_NAME='*' \
  -e MINIO_ENDPOINT='s3.example.com' \
  -p 3000:3000 \
  ghcr.io/korfra/minio-cdn:latest
```

### Docker Compose

You can also use Docker Compose. See [compose.yml](compose.yml) for reference.

```bash
docker compose up -d
```

## License

This project is licensed under [MIT License](LICENSE).
