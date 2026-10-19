import 'server-only'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  if (!publicKey) {
    return Response.json(
      { error: 'VAPID public key is not configured' },
      { status: 500 }
    )
  }
  return Response.json({ publicKey })
}