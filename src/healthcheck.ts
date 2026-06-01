import http from 'node:http'

http
  .request(
    {
      hostname: process.env.MINIO_CDN_HOST || process.env.HOST || 'localhost',
      port: parseInt(process.env.MINIO_CDN_PORT || process.env.PORT || '3000'),
      path: '/up',
      method: 'GET',
    },
    (res) => {
      let body = ''

      res.on('data', (chunk) => {
        body += chunk
      })

      res.on('end', () => {
        try {
          const response = JSON.parse(body)

          if (!response.error) {
            process.exit(0)
          }

          console.log('Unhealthy response received:', body)
          process.exit(1)
        } catch (error) {
          console.log('Error parsing JSON response body:', body)
          process.exit(1)
        }
      })
    }
  )
  .on('error', (error) => {
    console.log('Error:', error)
    process.exit(1)
  })
  .end()
