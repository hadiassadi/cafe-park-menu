import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MenuClient from '@/app/MenuClient'
import { getMenuData } from '@/lib/menu'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const data = await getMenuData().catch(() => null)

  const category = data?.categories.find((c) => c.id === id)
  const cafeName = data?.settings?.cafe_name || 'کافه پارک'

  let title = 'منو'
  if (id === 'featured') title = `پیشنهاد کافه | ${cafeName}`
  else if (id === 'all') title = `جستجو | ${cafeName}`
  else if (category) title = `${category.name} | ${cafeName}`

  return {
    title,
    robots: { index: false, follow: true },
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getMenuData()

  if (id !== 'featured' && id !== 'all') {
    const exists = data.categories.some((c) => c.id === id)
    if (!exists) notFound()
  }

  return <MenuClient initial={data} initialCategoryId={id} />
}