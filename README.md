# Edgea

Serve S3 compatible files like Cloudflare R2.<br>
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

| Variable            | Default                               | Description                                 |
| ------------------- | ------------------------------------- | ------------------------------------------- |
| `S3_ENDPOINT`       | -                                     | S3 compatible Endpoint                      |
| `S3_PORT`           | -                                     | S3 compatible Port                          |
| `S3_ACCESS_KEY`     | -                                     | S3 compatible Access Key                    |
| `S3_SECRET_KEY`     | -                                     | S3 compatible Secret Key                    |
| `S3_BUCKET_NAME`    | `*`                                   | Bucket name. Use `*` for multi-bucket mode. |
| `S3_REGION`         | `auto`                                | S3 compatible Region (e.g., `us-east-1`)    |
| `S3_USE_SSL`        | `false`                               | Use SSL for S3 compatible connection        |
| `S3_PATH_STYLE`     | `true`                                | Use path-style access for S3 compatible     |
| `CDN_CACHE_CONTROL` | `public, max-age=31536000, immutable` | Browser/CDN Cache header                    |
| `CDN_HOST`          | `127.0.0.1`                           | CDN Server Host                             |
| `CDN_PORT`          | `3000`                                | CDN Server Port                             |
| `CACHE_MAX_ITEMS`   | `500`                                 | Max items in memory cache                   |
| `CACHE_MAX_SIZE_MB` | `50`                                  | Max RAM usage for cache in MB               |
| `CACHE_TTL_SEC`     | `3600`                                | In-memory cache TTL in seconds              |

## Multi-Bucket Mode

When `S3_BUCKET_NAME` is set to `*`, the application expects the first segment of the path to be the bucket name:

- `http://localhost:3000/my-bucket/image.jpg` -> serves `image.jpg` from `my-bucket`.

## Docker

```bash
docker run -d \
  -e S3_ACCESS_KEY='...' \
  -e S3_SECRET_KEY='...' \
  -e S3_BUCKET_NAME='*' \
  -e S3_ENDPOINT='s3.example.com' \
  -p 3000:3000 \
  ghcr.io/korfra/edgea:latest
```

### Docker Compose

You can also use Docker Compose. See [compose.yml](compose.yml) for reference.

```bash
docker compose up -d
```

## License

This project is licensed under [MIT License](LICENSE).
