'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'

export type CartItem = {
  id: string                  // یه ID یکتا برای هر آیتم (product + variant)
  productId: string
  productName: string
  productImage: string | null
  selectedGroupName: string | null   // مثلاً "سرو در کافه"
  selectedOptionName: string | null  // مثلاً "سینگل"
  selectedOptionId: string | null
  unitPrice: number           // قیمت واحد
  quantity: number
  note?: string               // توضیحات مشتری
  takeaway?: boolean          // بیرون‌بر؟ (undefined = سرو در کافه)
  takeawayFee?: number        // هزینهٔ بیرون‌بر هر عدد (فقط نمایشی)
  takeawayLabel?: string | null
}


type CartContextType = {
  items: CartItem[]
  totalItems: number
  totalPrice: number
  takeawayTotal: number
  addItem:
 (item: Omit<CartItem, 'id'>) => void
  updateQuantity: (id: string, quantity: number) => void
  setItemTakeaway: (id: string, value: boolean) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextType | null>(null)

const STORAGE_KEY = 'cafe-park-cart'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // بارگذاری از localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setItems(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Error loading cart:', e)
    }
    setIsLoaded(true)
  }, [])

  // ذخیره در localStorage
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (e) {
      console.error('Error saving cart:', e)
    }
  }, [items, isLoaded])

  const addItem = useCallback((newItem: Omit<CartItem, 'id'>) => {
    setItems((prev) => {
      // اگه همون محصول با همون واریانت قبلاً بود → تعداد اضافه شه
      const existingIndex = prev.findIndex(
        (item) =>
          item.productId === newItem.productId &&
          item.selectedOptionId === newItem.selectedOptionId &&
          Boolean(item.takeaway) === Boolean(newItem.takeaway)

      )

      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + newItem.quantity,
        }
        return updated
      }

      // آیتم جدید
      const id = `${newItem.productId}-${newItem.selectedOptionId ?? 'default'}-${newItem.takeaway ? 'tk' : 'dn'}-${Date.now()}`
      return [...prev, { ...newItem, id }]
    })
  }, [])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    )
  }, [])
  const setItemTakeaway = useCallback((id: string, value: boolean) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id)
      if (!target) return prev
      if (Boolean(target.takeaway) === value) return prev
      // بیرون‌بر فقط برای آیتمی که هزینه دارد
      if (value && !((target.takeawayFee ?? 0) > 0)) return prev

      // اگر ردیف همسان با حالت جدید هست، ادغام کن
      const twin = prev.find(
        (i) =>
          i.id !== id &&
          i.productId === target.productId &&
          i.selectedOptionId === target.selectedOptionId &&
          Boolean(i.takeaway) === value
      )
      if (twin) {
        return prev
          .filter((i) => i.id !== id)
          .map((i) =>
            i.id === twin.id
              ? { ...i, quantity: i.quantity + target.quantity }
              : i
          )
      }
      return prev.map((i) => (i.id === id ? { ...i, takeaway: value } : i))
    })
  }, [])


  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  )
  const takeawayTotal = items.reduce(
    (sum, item) =>
      item.takeaway ? sum + (item.takeawayFee ?? 0) * item.quantity : sum,
    0
  )
  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalPrice,
        takeawayTotal,
        addItem,
        updateQuantity,
        setItemTakeaway,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider')
  }
  return ctx
}