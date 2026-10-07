'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  const filePath = fileName

  const { error: uploadError } = await db.storage
    .from('product-images')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return {
      url: null,
      error: uploadError.message,
    }
  }

  const { data } = db.storage
    .from('product-images')
    .getPublicUrl(filePath)

  return {
    url: data.publicUrl,
    error: null,
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

  if (!categoryId) {
    return { error: 'دسته محصول را انتخاب کن.' }
  }

  if (!name) {
    return { error: 'نام محصول را وارد کن.' }
  }

  if (price <= 0) {
    return { error: 'قیمت محصول باید بیشتر از صفر باشد.' }
  }

  const uploadedImage = await uploadProductImage(db, imageFile)

  if (uploadedImage.error) {
    return { error: uploadedImage.error }
  }

  const imageUrl = uploadedImage.url || manualImageUrl || null

  const { error } = await db
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
      sort_order: sortOrder,
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
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

  if (!id) {
    return { error: 'شناسه محصول مشخص نیست.' }
  }

  if (!categoryId) {
    return { error: 'دسته محصول را انتخاب کن.' }
  }

  if (!name) {
    return { error: 'نام محصول را وارد کن.' }
  }

  if (price <= 0) {
    return { error: 'قیمت محصول باید بیشتر از صفر باشد.' }
  }

  const uploadedImage = await uploadProductImage(db, imageFile)

  if (uploadedImage.error) {
    return { error: uploadedImage.error }
  }

  const imageUrl =
    uploadedImage.url ||
    manualImageUrl ||
    null

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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}