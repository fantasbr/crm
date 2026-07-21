import { Client as MinioClient } from 'minio'

// Client MinIO server-side pra servir a mídia da Evolution quando a URL
// pré-assinada guardada em crm_messages.media_url já expirou (assinaturas
// S3/SigV4 têm validade máxima de 7 dias). Com credenciais, buscamos o objeto
// direto pelo bucket+key — que são permanentes —, sem depender da assinatura.

let cached: MinioClient | null = null

export function getMinioClient(): MinioClient | null {
  if (cached) return cached

  const endPoint = process.env.MINIO_ENDPOINT
  const accessKey = process.env.MINIO_ACCESS_KEY
  const secretKey = process.env.MINIO_SECRET_KEY
  if (!endPoint || !accessKey || !secretKey) return null

  cached = new MinioClient({
    endPoint,
    port: process.env.MINIO_PORT ? Number(process.env.MINIO_PORT) : 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey,
    secretKey,
    region: process.env.MINIO_REGION || undefined,
  })
  return cached
}

// Extrai bucket + objectName a partir de uma media_url salva. As URLs da
// Evolution têm o formato path-style:
//   http://minio:9000/<bucket>/<object/key/com/barras>?X-Amz-Signature=...
// O primeiro segmento do path é o bucket; o resto é a key (decodificada, já
// que o WhatsApp jid vem com %40 no lugar de @, etc.). A query string
// (assinatura) é ignorada de propósito — é justamente o que expira.
export function parseMinioObject(mediaUrl: string): { bucket: string; objectName: string } | null {
  try {
    const u = new URL(mediaUrl)
    const path = u.pathname.replace(/^\/+/, '')
    const slash = path.indexOf('/')
    if (slash < 1) return null
    const bucket = decodeURIComponent(path.slice(0, slash))
    const objectName = decodeURIComponent(path.slice(slash + 1))
    if (!bucket || !objectName) return null
    return { bucket, objectName }
  } catch {
    return null
  }
}
