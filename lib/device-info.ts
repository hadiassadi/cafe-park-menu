/**
 * برچسب خوانای دستگاه از روی User-Agent — برای نمایش «ثبت‌نام با چه دستگاهی انجام شد»
 * به مدیر (آیفون/اندروید/ویندوز + مرورگر). خالص و بدون وابستگی تا تست‌پذیر باشد.
 */
export function parseDeviceLabel(ua: string): string {
  if (!ua || !ua.trim()) return 'دستگاه نامشخص'
  const u = ua.toLowerCase()

  let os: string
  if (/iphone/.test(u)) os = 'آیفون'
  else if (/ipad/.test(u)) os = 'آیپد'
  else if (/android/.test(u)) {
    const m = u.match(/android[\s/]([\d.]+)/)
    os = m ? `اندروید ${m[1].split('.')[0]}` : 'اندروید'
  } else if (/windows nt|windows phone/.test(u)) os = 'ویندوز'
  else if (/mac os x|macintosh/.test(u)) os = 'مک'
  else if (/linux/.test(u)) os = 'لینوکس'
  else os = 'دستگاه نامشخص'

  let browser: string
  if (/edg\//.test(u)) browser = 'Edge'
  else if (/samsungbrowser/.test(u)) browser = 'مرورگر سامسونگ'
  else if (/firefox\//.test(u)) browser = 'فایرفاکس'
  else if (/opr\/|opera/.test(u)) browser = 'اپرا'
  else if (/chrome\//.test(u)) browser = 'کروم'
  else if (/safari\//.test(u)) browser = 'سافاری'
  else browser = ''

  return browser ? `${os} — ${browser}` : os
}
