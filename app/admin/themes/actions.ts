'use server'

import * as fontkit from 'fontkit'
import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type FontMetadataItem = {
  id: string
  original_name: string
  url: string
  extension: string
  family: string | null
  subfamily: string | null
  postscript_name: string | null
  type: 'static' | 'variable'
  detected_weight: number | null
  min_weight: number | null
  max_weight: number | null
  default_weight: number | null
}

type FontAnalysis = Omit<FontMetadataItem, 'id' | 'url'>

function getExtension(fileName: string) {
  const parts = fileName.split('.')
  if (parts.length < 2) return ''
  return (parts[parts.length - 1] || '').toLowerCase()
}

function detectWeightFromText(value: string): number | null {
  const text = value.toLowerCase()

  const patterns: Array<[number, RegExp]> = [
    [900, /(black|heavy|ultra.?black|900)/i],
    [800, /(extra.?bold|extrabold|800)/i],
    [700, /(bold|700)/i],
    [600, /(semi.?bold|semibold|demi.?bold|600)/i],
    [500, /(medium|500)/i],
    [400, /(regular|normal|book|400)/i],
    [300, /(light|300)/i],
    [200, /(extra.?light|extralight|200)/i],
    [100, /(thin|100)/i],
  ]

  for (const [weight, pattern] of patterns) {
    if (pattern.test(text)) return weight
  }

  return null
}

function clampWeight(value: number) {
  return Math.min(900, Math.max(100, Math.round(value)))
}

function analyzeFont(fileName: string, buffer: ArrayBuffer): FontAnalysis {
  const extension = getExtension(fileName)

  try {
    const font = fontkit.create(Buffer.from(buffer))

    const family = font.familyName || null
    const subfamily = font.subfamilyName || null
    const postscriptName = font.postscriptName || null
    const variationAxes = font.variationAxes || {}
    const wghtAxis = variationAxes.wght

    if (wghtAxis) {
      return {
        original_name: fileName,
        extension,
        family,
        subfamily,
        postscript_name: postscriptName,
        type: 'variable',
        detected_weight:
          typeof wghtAxis.default === 'number'
            ? clampWeight(wghtAxis.default)
            : 400,
        min_weight:
          typeof wghtAxis.min === 'number'
            ? clampWeight(wghtAxis.min)
            : 100,
        max_weight:
          typeof wghtAxis.max === 'number'
            ? clampWeight(wghtAxis.max)
            : 900,
        default_weight:
          typeof wghtAxis.default === 'number'
            ? clampWeight(wghtAxis.default)
            : 400,
      }
    }

    let detectedWeight: number | null = null

    try {
      const os2 = (
        font as unknown as {
          ['OS/2']?: { usWeightClass?: number }
        }
      )['OS/2']

      if (os2 && typeof os2.usWeightClass === 'number' && os2.usWeightClass >= 1) {
        detectedWeight = clampWeight(os2.usWeightClass)
      }
    } catch {
      detectedWeight = null
    }

    if (!detectedWeight) {
      detectedWeight = detectWeightFromText(
        [fileName, subfamily || '', postscriptName || ''].join(' ')
      )
    }

    return {
      original_name: fileName,
      extension,
      family,
      subfamily,
      postscript_name: postscriptName,
      type: 'static',
      detected_weight: detectedWeight,
      min_weight: null,
      max_weight: null,
      default_weight: detectedWeight,
    }
  } catch {
    const fallbackWeight = detectWeightFromText(fileName)

    return {
      original_name: fileName,
      extension,
      family: null,
      subfamily: null,
      postscript_name: null,
      type: 'static',
      detected_weight: fallbackWeight,
      min_weight: null,
      max_weight: null,
      default_weight: fallbackWeight,
    }
  }
}

async function uploadFont(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  file: File
) {
  const extension = getExtension(file.name)
  const allowedExtensions = ['woff2', 'woff', 'ttf', 'otf']

  if (!allowedExtensions.includes(extension)) {
    return { error: `فایل «${file.name}» فرمت پشتیبانی‌شده ندارد.` }
  }

  const buffer = await file.arrayBuffer()
  const analysis = analyzeFont(file.name, buffer)

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')

  const fileName = `font-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}-${safeName}`

  const filePath = `fonts/${fileName}`

  const { error: uploadError } = await db.storage
    .from('theme-fonts')
    .upload(filePath, file, {
      contentType:
        file.type ||
        (extension === 'woff2'
          ? 'font/woff2'
          : extension === 'woff'
            ? 'font/woff'
            : extension === 'otf'
              ? 'font/otf'
              : 'font/ttf'),
      upsert: false,
    })

  if (uploadError) return { error: uploadError.message }

  const { data } = db.storage.from('theme-fonts').getPublicUrl(filePath)

  const metadata: FontMetadataItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    original_name: analysis.original_name,
    url: data.publicUrl,
    extension: analysis.extension,
    family: analysis.family,
    subfamily: analysis.subfamily,
    postscript_name: analysis.postscript_name,
    type: analysis.type,
    detected_weight: analysis.detected_weight,
    min_weight: analysis.min_weight,
    max_weight: analysis.max_weight,
    default_weight: analysis.default_weight,
  }

  return { error: null, metadata }
}

function normalizeFamily(value: string | null) {
  return (value || '').trim().toLowerCase()
}

function getFamilyFonts(metadata: FontMetadataItem[], family: string) {
  const normalized = normalizeFamily(family)
  if (!normalized) return []
  return metadata.filter((font) => normalizeFamily(font.family) === normalized)
}

function chooseStaticFontUrls(fonts: FontMetadataItem[]) {
  const result = {
    regular: null as string | null,
    medium: null as string | null,
    semibold: null as string | null,
    bold: null as string | null,
    extrabold: null as string | null,
    black: null as string | null,
  }

  const targets = [
    { weight: 400, key: 'regular' as const },
    { weight: 500, key: 'medium' as const },
    { weight: 600, key: 'semibold' as const },
    { weight: 700, key: 'bold' as const },
    { weight: 800, key: 'extrabold' as const },
    { weight: 900, key: 'black' as const },
  ]

  const staticFonts = fonts.filter(
    (font) => font.type === 'static' && font.detected_weight !== null
  )

  const used = new Set<string>()

  for (const target of targets) {
    let best: FontMetadataItem | null = null
    let bestDistance = Number.POSITIVE_INFINITY

    for (const font of staticFonts) {
      if (used.has(font.id) || font.detected_weight === null) continue

      const distance = Math.abs(font.detected_weight - target.weight)

      if (distance < bestDistance) {
        best = font
        bestDistance = distance
      }
    }

    if (best) {
      result[target.key] = best.url
      used.add(best.id)
    }
  }

  return result
}

function readExistingMetadata(value: unknown): FontMetadataItem[] {
  if (!Array.isArray(value)) return []

  return value.filter((item): item is FontMetadataItem =>
    Boolean(item && typeof item === 'object' && 'url' in item)
  )
}

function getFontFiles(formData: FormData) {
  return formData
    .getAll('font_files')
    .filter((value): value is File => value instanceof File && value.size > 0)
}

async function processFontFiles(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  files: File[]
) {
  const uploaded: FontMetadataItem[] = []

  for (const file of files) {
    const result = await uploadFont(db, file)

    if (result.error) return { error: result.error }

    if (result.metadata) uploaded.push(result.metadata)
  }

  return { error: null, uploaded }
}

function chooseVariableFont(fonts: FontMetadataItem[]) {
  return fonts.find((font) => font.type === 'variable')?.url ?? null
}

function getTypographyValue(formData: FormData, name: string, fallback: number) {
  const value = Number(formData.get(name))
  return Number.isFinite(value) ? value : fallback
}

function getFinalFontSelection(metadata: FontMetadataItem[], family: string) {
  const familyFonts = getFamilyFonts(metadata, family)

  if (familyFonts.length === 0) {
    return {
      familyFonts: [],
      urls: {
        regular: null,
        medium: null,
        semibold: null,
        bold: null,
        extrabold: null,
        black: null,
      },
      variableUrl: null,
    }
  }

  return {
    familyFonts,
    urls: chooseStaticFontUrls(familyFonts),
    variableUrl: chooseVariableFont(familyFonts),
  }
}

// ==========================
// ADD THEME
// ==========================
export async function addTheme(formData: FormData) {
  const db = await supabaseServer()

  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()

  if (!name) return { error: 'نام قالب را وارد کن.' }

  const primaryColor = String(formData.get('primary_color') || '#6b4f3a').trim()
  const secondaryColor = String(formData.get('secondary_color') || '#f3eee7').trim()
  const backgroundColor = String(formData.get('background_color') || '#fffdf9').trim()
  const surfaceColor = String(formData.get('surface_color') || '#ffffff').trim()
  const textColor = String(formData.get('text_color') || '#29251f').trim()
  const mutedTextColor = String(formData.get('muted_text_color') || '#766f64').trim()
  const accentColor = String(formData.get('accent_color') || '#9a6b3f').trim()
  const fontFamily = String(formData.get('font_family') || '').trim()
  const borderRadius = Number(formData.get('border_radius') || 10)

  const files = getFontFiles(formData)
  const processed = await processFontFiles(db, files)

  if (processed.error) return { error: processed.error }

  const uploaded = processed.uploaded ?? []

  const detectedFamily = uploaded.find((font) => font.family)?.family ?? null
  const finalFamily = fontFamily || detectedFamily || null

  const selection = finalFamily
    ? getFinalFontSelection(uploaded, finalFamily)
    : {
        familyFonts: [],
        urls: {
          regular: null,
          medium: null,
          semibold: null,
          bold: null,
          extrabold: null,
          black: null,
        },
        variableUrl: null,
      }

  const { error } = await db.from('themes').insert({
    name,
    description: description || null,
    is_active: false,

    primary_color: primaryColor,
    secondary_color: secondaryColor,
    background_color: backgroundColor,
    surface_color: surfaceColor,
    text_color: textColor,
    muted_text_color: mutedTextColor,
    accent_color: accentColor,

    font_family: finalFamily,
    font_url: selection.urls.regular || selection.variableUrl,
    font_regular_url: selection.urls.regular,
    font_medium_url: selection.urls.medium,
    font_semibold_url: selection.urls.semibold,
    font_bold_url: selection.urls.bold,
    font_extrabold_url: selection.urls.extrabold,
    font_black_url: selection.urls.black,
    font_variable_url: selection.variableUrl,
    font_metadata: uploaded,

    title_weight: getTypographyValue(formData, 'title_weight', 800),
    category_weight: getTypographyValue(formData, 'category_weight', 700),
    product_weight: getTypographyValue(formData, 'product_weight', 600),
    description_weight: getTypographyValue(formData, 'description_weight', 400),
    price_weight: getTypographyValue(formData, 'price_weight', 700),
    badge_weight: getTypographyValue(formData, 'badge_weight', 600),
    footer_weight: getTypographyValue(formData, 'footer_weight', 400),

    border_radius: borderRadius,
  })

  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true }
}

// ==========================
// UPDATE THEME
// ==========================
export async function updateTheme(formData: FormData) {
  const db = await supabaseServer()

  const id = String(formData.get('id') || '')
  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()

  if (!id) return { error: 'شناسه قالب مشخص نیست.' }
  if (!name) return { error: 'نام قالب را وارد کن.' }

  const primaryColor = String(formData.get('primary_color') || '#6b4f3a').trim()
  const secondaryColor = String(formData.get('secondary_color') || '#f3eee7').trim()
  const backgroundColor = String(formData.get('background_color') || '#fffdf9').trim()
  const surfaceColor = String(formData.get('surface_color') || '#ffffff').trim()
  const textColor = String(formData.get('text_color') || '#29251f').trim()
  const mutedTextColor = String(formData.get('muted_text_color') || '#766f64').trim()
  const accentColor = String(formData.get('accent_color') || '#9a6b3f').trim()
  const fontFamily = String(formData.get('font_family') || '').trim()
  const borderRadius = Number(formData.get('border_radius') || 10)

  let existingMetadata: FontMetadataItem[] = []

  const rawMetadata = formData.get('current_font_metadata')
  if (rawMetadata) {
    try {
      existingMetadata = readExistingMetadata(JSON.parse(String(rawMetadata)))
    } catch {
      existingMetadata = []
    }
  }

  const files = getFontFiles(formData)
  const processed = await processFontFiles(db, files)

  if (processed.error) return { error: processed.error }

  const uploadedSafe = processed.uploaded ?? []
  const allMetadata: FontMetadataItem[] = [...existingMetadata, ...uploadedSafe]

  let finalFamily = fontFamily

  if (!finalFamily) {
    finalFamily =
      uploadedSafe.find((font) => font.family)?.family ??
      existingMetadata.find((font) => font.family)?.family ??
      ''
  }

  const selection = finalFamily
    ? getFinalFontSelection(allMetadata, finalFamily)
    : {
        familyFonts: [],
        urls: {
          regular: null,
          medium: null,
          semibold: null,
          bold: null,
          extrabold: null,
          black: null,
        },
        variableUrl: null,
      }

  const { error } = await db
    .from('themes')
    .update({
      name,
      description: description || null,

      primary_color: primaryColor,
      secondary_color: secondaryColor,
      background_color: backgroundColor,
      surface_color: surfaceColor,
      text_color: textColor,
      muted_text_color: mutedTextColor,
      accent_color: accentColor,

      font_family: finalFamily || null,
      font_url: selection.urls.regular || selection.variableUrl,
      font_regular_url: selection.urls.regular,
      font_medium_url: selection.urls.medium,
      font_semibold_url: selection.urls.semibold,
      font_bold_url: selection.urls.bold,
      font_extrabold_url: selection.urls.extrabold,
      font_black_url: selection.urls.black,
      font_variable_url: selection.variableUrl,
      font_metadata: allMetadata,

      title_weight: getTypographyValue(formData, 'title_weight', 800),
      category_weight: getTypographyValue(formData, 'category_weight', 700),
      product_weight: getTypographyValue(formData, 'product_weight', 600),
      description_weight: getTypographyValue(formData, 'description_weight', 400),
      price_weight: getTypographyValue(formData, 'price_weight', 700),
      badge_weight: getTypographyValue(formData, 'badge_weight', 600),
      footer_weight: getTypographyValue(formData, 'footer_weight', 400),

      border_radius: borderRadius,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true }
}

// ==========================
// ACTIVATE THEME
// ==========================
export async function activateTheme(formData: FormData) {
  const db = await supabaseServer()
  const id = String(formData.get('id') || '')

  if (!id) return { error: 'شناسه قالب مشخص نیست.' }

  const { error: deactivateError } = await db
    .from('themes')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('is_active', true)

  if (deactivateError) return { error: deactivateError.message }

  const { error: activateError } = await db
    .from('themes')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (activateError) return { error: activateError.message }

  revalidatePath('/')
  return { success: true }
}
