'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type VariantOption = {
  id?: string
  name: string
  price_modifier: number
  is_default: boolean
  is_available: boolean
  sort_order: number
}

type VariantGroup = {
  id?: string
  name: string
  is_required: boolean
  sort_order: number
  options: VariantOption[]
}

async function uploadProductImage(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  file: FormDataEntryValue | null
) {
  if (!(file instanceof File) || file.size === 0) {
    return { url: null, error: null }
  }

  if (!file.type.startsWith('image/')) {
    return {
      url: null,
      error: 'فایل انتخاب‌شده باید تصویر باشد.',
    }
  }

  const extension = file.name.includes('.')
    ? file.name.split('.').pop()?.toLowerCase()
    : 'jpg'

  const fileName =
    'product-' +
    Date.now() +
    '-' +
    Math.random().toString(36).slice(2) +
    '.' +
    extension

  const { error: uploadError } = await db.storage
    .from('product-images')
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return { url: null, error: uploadError.message }
  }

  const { data } = db.storage
    .from('product-images')
    .getPublicUrl(fileName)

  return { url: data.publicUrl, error: null }
}

// ✅ ذخیره واریانت‌ها
async function saveVariantGroups(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  productId: string,
  groups: VariantGroup[]
) {
  // پاک کردن گروه‌های قبلی
  await db
    .from('variant_groups')
    .delete()
    .eq('product_id', productId)

  // اضافه کردن گروه‌های جدید
  for (const group of groups) {
    const { data: groupData, error: groupError } = await db
      .from('variant_groups')
      .insert({
        product_id: productId,
        name: group.name,
        is_required: group.is_required,
        sort_order: group.sort_order,
      })
      .select()
      .single()

    if (groupError || !groupData) continue

    const options = group.options.map((opt, idx) => ({
      group_id: groupData.id,
      name: opt.name,
      price_modifier: opt.price_modifier,
      is_default: opt.is_default,
      is_available: opt.is_available,
      sort_order: idx,
    }))

    if (options.length > 0) {
      await db.from('variant_options').insert(options)
    }
  }
}

export async function addProduct(formData: FormData) {
  const db = await supabaseServer()

  const categoryId = String(formData.get('category_id') || '')
  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const price = Number(formData.get('price') || 0)
  const size = String(formData.get('size') || '').trim()
  const manualImageUrl = String(formData.get('image_url') || '').trim()
  const imageFile = formData.get('image_file')
  const sortOrder = Number(formData.get('sort_order') || 0)
  const isFeatured = formData.get('is_featured') === 'on'
  const isNew = formData.get('is_new') === 'on'
  const isAvailable = formData.get('is_available') !== 'off'

  const calories = formData.get('calories')
    ? Number(formData.get('calories'))
    : null
  const prepTime = formData.get('prep_time_minutes')
    ? Number(formData.get('prep_time_minutes'))
    : null
  const ingredients =
    String(formData.get('ingredients') || '').trim() || null
  const allergens =
    String(formData.get('allergens') || '').trim() || null
  const dietaryInfo =
    String(formData.get('dietary_info') || '').trim() || null

  const variantGroupsRaw = String(formData.get('variant_groups') || '[]')
  let variantGroups: VariantGroup[] = []
  try {
    variantGroups = JSON.parse(variantGroupsRaw)
  } catch {
    variantGroups = []
  }

  if (!categoryId) return { error: 'دسته محصول را انتخاب کن.' }
  if (!name) return { error: 'نام محصول را وارد کن.' }
  if (price <= 0) return { error: 'قیمت محصول باید بیشتر از صفر باشد.' }

  const uploadedImage = await uploadProductImage(db, imageFile)
  if (uploadedImage.error) return { error: uploadedImage.error }

  const imageUrl = uploadedImage.url || manualImageUrl || null

  const { data: productData, error } = await db
    .from('products')
    .insert({
      category_id: categoryId,
      name,
      description: description || null,
      price,
      size: size || null,
      image_url: imageUrl,
      is_active: true,
      is_featured: isFeatured,
      is_available: isAvailable,
      is_new: isNew,
      calories,
      prep_time_minutes: prepTime,
      ingredients,
      allergens,
      dietary_info: dietaryInfo,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  if (productData && variantGroups.length > 0) {
    await saveVariantGroups(db, productData.id, variantGroups)
  }

  revalidatePath('/')
  revalidatePath('/admin/products')
  return { success: true }
}

export async function updateProduct(formData: FormData) {
  const db = await supabaseServer()

  const id = String(formData.get('id') || '')
  const categoryId = String(formData.get('category_id') || '')
  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const price = Number(formData.get('price') || 0)
  const size = String(formData.get('size') || '').trim()
  const manualImageUrl = String(formData.get('image_url') || '').trim()
  const imageFile = formData.get('image_file')
  const sortOrder = Number(formData.get('sort_order') || 0)
  const isActive = formData.get('is_active') === 'on'
  const isFeatured = formData.get('is_featured') === 'on'
  const isNew = formData.get('is_new') === 'on'
  const isAvailable = formData.get('is_available') !== 'off'

  const calories = formData.get('calories')
    ? Number(formData.get('calories'))
    : null
  const prepTime = formData.get('prep_time_minutes')
    ? Number(formData.get('prep_time_minutes'))
    : null
  const ingredients =
    String(formData.get('ingredients') || '').trim() || null
  const allergens =
    String(formData.get('allergens') || '').trim() || null
  const dietaryInfo =
    String(formData.get('dietary_info') || '').trim() || null

  const variantGroupsRaw = String(formData.get('variant_groups') || '[]')
  let variantGroups: VariantGroup[] = []
  try {
    variantGroups = JSON.parse(variantGroupsRaw)
  } catch {
    variantGroups = []
  }

  if (!id) return { error: 'شناسه محصول مشخص نیست.' }
  if (!categoryId) return { error: 'دسته محصول را انتخاب کن.' }
  if (!name) return { error: 'نام محصول را وارد کن.' }
  if (price <= 0) return { error: 'قیمت محصول باید بیشتر از صفر باشد.' }

  const uploadedImage = await uploadProductImage(db, imageFile)
  if (uploadedImage.error) return { error: uploadedImage.error }

  const imageUrl = uploadedImage.url || manualImageUrl || null

  const { error } = await db
    .from('products')
    .update({
      category_id: categoryId,
      name,
      description: description || null,
      price,
      size: size || null,
      image_url: imageUrl,
      sort_order: sortOrder,
      is_active: isActive,
      is_featured: isFeatured,
      is_available: isAvailable,
      is_new: isNew,
      calories,
      prep_time_minutes: prepTime,
      ingredients,
      allergens,
      dietary_info: dietaryInfo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  if (variantGroups.length > 0) {
    await saveVariantGroups(db, id, variantGroups)
  }

  revalidatePath('/')
  revalidatePath('/admin/products')
  return { success: true }
}