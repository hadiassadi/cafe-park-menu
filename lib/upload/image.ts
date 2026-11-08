// lib/upload/image.ts

/**
 * تشخیص نوع تصویر از روی امضای بایت‌ها (magic bytes) — مشترک بین
 * رسید سفارش (/api/upload-receipt) و رسید شارژ کیف پول (/api/wallet/charge-request).
 * به نام فایل یا content-type کلاینت اعتماد نمی‌کنیم.
 */

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // ۵ مگابایت
export const IMAGE_SIGNED_URL_TTL = 60 * 60 * 24 * 30 // سی روز

export function detectImage(b: Uint8Array): { mime: string; ext: string } | null {
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' }
  }
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' }
  }
  return null
}
