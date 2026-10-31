'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { isOrderVisibleToAdmin } from '@/lib/orders/visibility'
import {
  updateOrderStatus,
  updatePaymentStatus,
  rejectReceipt,
  getPendingLedgerReceipts,
  reviewLedgerReceipt,
  type LedgerReceipt,
} from './actions'
'./actions'
import { formatPersianDate } from '@/lib/format-date'
import { useStepUp } from '@/lib/admin/use-step-up'
import StepUpModal from '../components/StepUpModal'

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fa-IR').format(price)

const formatTime = (iso: string) => {
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return 'همین الان'
  if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`
  return `${Math.floor(diff / 86400)} روز پیش`
}

const normalizeDigits = (str: string) => {
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
}

const normalizeText = (str: string) => {
  return str
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
}

type OrderItem = {
  product_name: string
  option_name: string | null
  unit_price: number
  quantity: number
  discount_amount?: number
}

type Order = {
  id: string
  order_number: number
  customer_name: string
  customer_phone: string
  table_number: number | null
  note: string | null
  items: OrderItem[]
  subtotal: number
  paid_amount?: number
  original_subtotal: number | null
  coupon_code: string | null
  coupon_discount: number | null
  eligible_subtotal: number | null
  ineligible_subtotal: number | null
  status: string
  created_at: string
  cancellation_reason_id: string | null
  cancellation_reason_label: string | null
  cancellation_note: string | null
  cancelled_by: string | null
  payment_method: string | null
  payment_status: string | null
  payment_ref_id: string | null
  payment_receipt_url: string | null
  payment_note: string | null
  deleted_at?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'جدید',
  confirmed: 'تأیید شده',
  preparing: 'در حال آماده‌سازی',
  ready: 'آماده تحویل',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'status-pending',
  confirmed: 'status-confirmed',
  preparing: 'status-preparing',
  ready: 'status-ready',
  delivered: 'status-delivered',
  cancelled: 'status-cancelled',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  online: 'آنلاین',
  cash: 'نقدی',
  card: 'کارت‌خوان',
  transfer: 'واریز به حساب',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'پرداخت شده',
  unpaid: 'پرداخت نشده',
  pending_review: 'در انتظار تأیید',
  failed: 'ناموفق',
  partial: 'پرداخت جزئی',

}

const NEXT_STATUS: Record<string, string | null> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
  delivered: null,
  cancelled: null,
}

const NEXT_LABEL: Record<string, string> = {
  pending: '👍 تأیید سفارش',
  confirmed: '☕ شروع آماده‌سازی',
  preparing: '🔔 آماده شد',
  ready: '🎉 تحویل شد',
}

type Filter = 'all' | 'pending' | 'active' | 'done' | 'unpaid'
type SearchType =
  | 'all'
  | 'order_number'
  | 'customer_name'
  | 'customer_phone'
  | 'table_number'
  | 'items'

type ExportFilter = 'today' | 'week' | 'month' | 'all'
type ExportStatus = 'all' | 'delivered' | 'active' | 'cancelled'

const EXPORT_FILTER_LABELS: Record<ExportFilter, string> = {
  today: 'امروز',
  week: 'این هفته',
  month: 'این ماه',
  all: 'همه',
}

const EXPORT_STATUS_LABELS: Record<ExportStatus, string> = {
  all: 'همه وضعیت‌ها',
  delivered: 'فقط تحویل‌شده',
  active: 'فقط در جریان',
  cancelled: 'فقط لغو‌شده',
}

type CancelReason = {
  id: string
  label: string
  icon: string | null
}

export default function OrdersManager({
  orders: initialOrders,
  allowDeleteOrders,
}: {
  orders: Order[]
  allowDeleteOrders: boolean
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [filter, setFilter] = useState<Filter>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('all')
  const [trashMode, setTrashMode] = useState(false)

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [printOrder, setPrintOrder] = useState<Order | null>(null)
  const [mounted, setMounted] = useState(false)

  const stepUp = useStepUp()

  const [exportOpen, setExportOpen] = useState(false)
  const [exportFilter, setExportFilter] = useState<ExportFilter>('month')
  const [exportStatus, setExportStatus] = useState<ExportStatus>('all')
  const [exporting, setExporting] = useState(false)

  const [cancelOrder, setCancelOrder] = useState<Order | null>(null)
  const [cancelReasons, setCancelReasons] = useState<CancelReason[]>([])
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  const [loadingReasons, setLoadingReasons] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [approvingPayment, setApprovingPayment] = useState(false)
  const [rejectingReceipt, setRejectingReceipt] = useState(false)
  const [paymentNote, setPaymentNote] = useState('')
  const [showApprovePayment, setShowApprovePayment] = useState(false)
  const [settleOrder, setSettleOrder] = useState<Order | null>(null)
  const [settleMethod, setSettleMethod] = useState<'cash' | 'card'>('cash')
  const [settleNote, setSettleNote] = useState('')
  const [settling, setSettling] = useState(false)
  const [settleAndDeliver, setSettleAndDeliver] = useState(false)
  const [ledgerReceipts, setLedgerReceipts] = useState<LedgerReceipt[]>([])
  const [loadingLedger, setLoadingLedger] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    if (!selectedOrder || selectedOrder.payment_status !== 'pending_review') {
      setLedgerReceipts([])
      return
    }

    let cancelled = false
    setLoadingLedger(true)

    getPendingLedgerReceipts(selectedOrder.id)
      .then((res) => {
        if (cancelled) return
        setLedgerReceipts(res.data ?? [])
        setLoadingLedger(false)
      })
      .catch(() => {
        if (!cancelled) setLoadingLedger(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedOrder?.id, selectedOrder?.payment_status])

    useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) return

    const supabase = createBrowserClient(url, key)
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Order
            if (!isOrderVisibleToAdmin(inserted)) return
            setOrders((prev) =>
              prev.some((o) => o.id === inserted.id)
                ? prev
                : [inserted, ...prev]
            )
                    } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Order
            const visible = isOrderVisibleToAdmin(updated)
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === updated.id)
              if (visible && !exists) return [updated, ...prev]
              if (!visible && exists)
                return prev.filter((o) => o.id !== updated.id)
              if (exists)
                return prev.map((o) =>
                  o.id === updated.id ? { ...o, ...updated } : o
                )
              return prev
            })
            setSelectedOrder((prev) =>
              prev?.id === updated.id ? { ...prev, ...updated } : prev
            )

          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!printOrder) return
    const handleAfterPrint = () => setPrintOrder(null)
    window.addEventListener('afterprint', handleAfterPrint)
    const timer = setTimeout(() => window.print(), 500)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printOrder])

  useEffect(() => {
    if (!cancelOrder) return
    if (cancelReasons.length > 0) return

    let cancelled = false
    setLoadingReasons(true)

    fetch('/api/cancellation-reasons?target=admin')
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled) {
          setCancelReasons(result.reasons || [])
          setLoadingReasons(false)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setLoadingReasons(false)
      })

    return () => {
      cancelled = true
    }
  }, [cancelOrder, cancelReasons.length])

  async function handleExport() {
    setExporting(true)
    try {
      const url = `/api/export/orders?filter=${exportFilter}&status=${exportStatus}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('خطا در ساخت فایل')
      const blob = await res.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `cafe-park-orders-${y}-${m}-${d}_${hh}-${mm}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
      setExportOpen(false)
    } catch (err) {
      alert('❌ خطا در دانلود فایل')
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  const counts = useMemo(() => {
    const activeOrders = orders.filter((o) => !o.deleted_at)
    return {
      pending: activeOrders.filter((o) => o.status === 'pending').length,
      active: activeOrders.filter((o) =>
        ['confirmed', 'preparing', 'ready'].includes(o.status)
      ).length,
      done: activeOrders.filter((o) =>
        ['delivered', 'cancelled'].includes(o.status)
      ).length,
      unpaid: activeOrders.filter(
        (o) =>
          (o.payment_status === 'unpaid' || o.payment_status === 'failed') &&
          o.status !== 'cancelled'
      ).length,
      all: activeOrders.length,
      deleted: orders.filter((o) => !!o.deleted_at).length,
    }
  }, [orders])

  const filteredOrders = useMemo(() => {
    const source = trashMode
      ? orders.filter((o) => !!o.deleted_at)
      : orders.filter((o) => !o.deleted_at)

    let result = source

    if (!trashMode) {
      if (filter === 'pending') {
        result = result.filter((o) => o.status === 'pending')
      } else if (filter === 'active') {
        result = result.filter((o) =>
          ['confirmed', 'preparing', 'ready'].includes(o.status)
        )
      } else if (filter === 'done') {
        result = result.filter((o) =>
          ['delivered', 'cancelled'].includes(o.status)
        )
      } else if (filter === 'unpaid') {
        result = result.filter(
          (o) =>
            (o.payment_status === 'unpaid' || o.payment_status === 'failed') &&
            o.status !== 'cancelled'
        )
      }
    }

    if (searchQuery.trim()) {
      const q = normalizeText(normalizeDigits(searchQuery.trim()))

      result = result.filter((o) => {
        const name = normalizeText(o.customer_name || '')
        const phone = normalizeDigits(o.customer_phone || '')
        const orderNum = o.order_number.toString()
        const tableNum = o.table_number ? o.table_number.toString() : ''

        switch (searchType) {
          case 'order_number':
            return orderNum.includes(q)
          case 'customer_name':
            return name.includes(q)
          case 'customer_phone':
            return phone.includes(q)
          case 'table_number':
            return tableNum.includes(q)
          case 'items': {
            const items = Array.isArray(o.items) ? o.items : []
            return items.some((item) =>
              normalizeText(item?.product_name || '').includes(q)
            )
          }
          case 'all':
          default:
            return (
              name.includes(q) ||
              phone.includes(q) ||
              orderNum.includes(q) ||
              tableNum.includes(q) ||
              (Array.isArray(o.items) &&
                o.items.some((item) =>
                  normalizeText(item?.product_name || '').includes(q)
                ))
            )
        }
      })
    }

    return result
  }, [orders, filter, searchQuery, searchType, trashMode])

    async function handleDelete(order: Order) {
    setDeletingId(order.id)
    try {
      // ✅ اول مستقیم تلاش کن (اگه cache معتبر باشه، کار می‌کنه)
      const res = await fetch(`/api/admin/orders/${order.id}/soft-delete`, {
        method: 'POST',
      })

      // اگه 401 یا 403 => یعنی باید تأیید هویت
      if (res.status === 401 || res.status === 403) {
        setDeletingId(null)
        const ok = await stepUp.requireStepUp()
        if (!ok) return

        // بعد از تأیید، دوباره تلاش کن
        setDeletingId(order.id)
        const retryRes = await fetch(
          `/api/admin/orders/${order.id}/soft-delete`,
          { method: 'POST' }
        )
        const retryData = await retryRes.json().catch(() => ({}))
        if (!retryRes.ok) {
          alert('❌ ' + (retryData.error || 'حذف انجام نشد'))
          return
        }
        const now = new Date().toISOString()
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, deleted_at: now } : o))
        )
        if (selectedOrder?.id === order.id) {
          setSelectedOrder({ ...selectedOrder, deleted_at: now })
        }
        return
      }

      // بقیه کدها (200 = موفق)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert('❌ ' + (data.error || 'حذف انجام نشد'))
        return
      }
      const now = new Date().toISOString()
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, deleted_at: now } : o))
      )
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({ ...selectedOrder, deleted_at: now })
      }
    } catch {
      alert('❌ خطا در حذف سفارش')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRestore(order: Order) {
    setDeletingId(order.id)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/restore`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        alert('❌ ' + (data.error || 'بازیابی انجام نشد'))
        return
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, deleted_at: null } : o))
      )
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({ ...selectedOrder, deleted_at: null })
      }
    } catch {
      alert('❌ خطا در بازیابی')
    } finally {
      setDeletingId(null)
    }
  }

  function openSettleModal(order: Order, deliverToo: boolean = false) {
    setSettleOrder(order)
    setSettleAndDeliver(deliverToo)
    setSettleMethod(order.payment_method === 'card' ? 'card' : 'cash')
    setSettleNote('')
  }

  function closeSettleModal() {
    if (settling) return
    setSettleOrder(null)
    setSettleAndDeliver(false)
    setSettleNote('')
  }

  async function confirmSettle() {
    if (!settleOrder) return
    setSettling(true)
    setLoading(true)

    try {
      const payRes = await updatePaymentStatus(
        settleOrder.id,
        'paid',
        settleNote.trim() || 'تسویه در محل',
        settleMethod
      )

      if (payRes.error) {
        alert('❌ خطا در ثبت پرداخت: ' + payRes.error)
        return
      }

      let newStatus = settleOrder.status
      if (settleAndDeliver) {
        const statusRes = await updateOrderStatus(
          (() => {
            const fd = new FormData()
            fd.append('id', settleOrder.id)
            fd.append('status', 'delivered')
            return fd
          })()
        )
        if (statusRes?.error) {
          alert('❌ خطا در تغییر وضعیت: ' + statusRes.error)
        } else {
          newStatus = 'delivered'
        }
      }

        const updated = {
        ...settleOrder,
        payment_status: 'paid',
        payment_method: settleMethod,
        payment_note: settleNote.trim() || settleOrder.payment_note,
        paid_amount: settleOrder.subtotal,
        status: newStatus,
      }


      setOrders((prev) =>
        prev.map((o) => (o.id === settleOrder.id ? updated : o))
      )
      if (selectedOrder?.id === settleOrder.id) {
        setSelectedOrder(updated)
      }

      closeSettleModal()
    } catch {
      alert('❌ خطای غیرمنتظره در تسویه')
    } finally {
      setSettling(false)
      setLoading(false)
    }
  }

  async function confirmDeliverWithoutPayment() {
    if (!settleOrder) return

    const confirmed = window.confirm(
      `سفارش #${settleOrder.order_number} بدون تسویه تحویل بشه؟\n\nوضعیت پرداخت «پرداخت نشده» می‌مونه و می‌تونی بعداً از تب «پرداخت‌نشده» تسویه کنی.`
    )
    if (!confirmed) return

    setSettling(true)
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('id', settleOrder.id)
      formData.append('status', 'delivered')

      const result = await updateOrderStatus(formData)
      if (result?.error) {
        alert('❌ ' + result.error)
        return
      }

      const updated = { ...settleOrder, status: 'delivered' }
      setOrders((prev) =>
        prev.map((o) => (o.id === settleOrder.id ? updated : o))
      )
      if (selectedOrder?.id === settleOrder.id) {
        setSelectedOrder(updated)
      }

      closeSettleModal()
    } catch {
      alert('❌ خطا در تغییر وضعیت')
    } finally {
      setSettling(false)
      setLoading(false)
    }
  }

  async function handleStatusChange(order: Order, newStatus: string) {
  if (newStatus === 'delivered' && order.payment_status !== 'paid') {
    openSettleModal(order, true)
    return
  }

  // ✅ اگه وضعیت به confirmed تغییر می‌کنه و پرداخت در انتظار تاییده، بپرس آیا تایید می‌کنه
  let shouldApprovePayment = false
  if (newStatus === 'confirmed' && order.payment_status === 'pending_review') {
    shouldApprovePayment = window.confirm(
      `سفارش #${order.order_number} رسید پرداخت آپلود کرده.\n\nآیا رسید پرداخت رو هم تایید می‌کنی؟\n\n(اگه تایید کنی، وضعیت پرداخت به «پرداخت شده» تغییر می‌کنه و پیغام تایید برای مشتری نمایش داده می‌شه)`
    )
  }

  setLoading(true)
  try {
    const formData = new FormData()
    formData.append('id', order.id)
    formData.append('status', newStatus)
    const result = await updateOrderStatus(formData)
    if (result?.error) {
      alert('❌ ' + result.error)
      return
    }

    // ✅ اگه ادمین تایید کرد، payment_status رو هم paid کن
    if (shouldApprovePayment) {
      const payResult = await updatePaymentStatus(order.id, 'paid', 'تایید رسید در پنل ادمین')
      if (payResult.error) {
        alert('❌ خطا در تایید پرداخت: ' + payResult.error)
      }
    }

    // ✅ آپدیت UI
    const updatedFields: Partial<Order> = { status: newStatus }
    if (shouldApprovePayment) {
      updatedFields.payment_status = 'paid'
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id ? { ...o, ...updatedFields } : o
      )
    )
    if (selectedOrder?.id === order.id) {
      setSelectedOrder({ ...selectedOrder, ...updatedFields })
    }
  } catch {
    alert('❌ خطا در تغییر وضعیت')
  } finally {
    setLoading(false)
  }
}
  async function handleApprovePayment(order: Order) {
    setApprovingPayment(true)
    try {
      const result = await updatePaymentStatus(
        order.id,
        'paid',
        paymentNote.trim() || undefined
      )

      if (result.error) {
        alert('❌ ' + result.error)
        return
      }

      const updated = {
        ...order,
        payment_status: 'paid',
        payment_verified_at: new Date().toISOString(),
        payment_note: paymentNote.trim() || order.payment_note,
      }

      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)))
      setSelectedOrder(updated)
      setShowApprovePayment(false)
      setPaymentNote('')
    } catch {
      alert('❌ خطا در تأیید پرداخت')
    } finally {
      setApprovingPayment(false)
    }
  }
  async function handleRejectReceipt(order: Order) {
    const ok = window.confirm(
      `رسید سفارش #${order.order_number} رد شود؟\n\nرسید فعلی پاک می‌شود و مشتری می‌تواند دوباره رسید بفرستد یا روش پرداخت را تغییر دهد.`
    )
    if (!ok) return

    setRejectingReceipt(true)
    try {
      const result = await rejectReceipt(order.id)
      if (result.error) {
        alert('❌ ' + result.error)
        return
      }

      const updated = {
        ...order,
        payment_status: 'unpaid',
        payment_receipt_url: null,
        payment_note: null,
      }

      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)))
      setSelectedOrder(updated)
    } catch {
      alert('❌ خطا در رد رسید')
    } finally {
      setRejectingReceipt(false)
    }
  }
  async function handleReviewLedger(
    order: Order,
    receipt: LedgerReceipt,
    decision: 'confirmed' | 'rejected'
  ) {
    let reason: string | undefined
    if (decision === 'confirmed') {
      const ok = window.confirm(
        `رسید ${formatPrice(receipt.amount)} تومانی سفارش #${order.order_number} تأیید شود؟`
      )
      if (!ok) return
    } else {
      const input = window.prompt('دلیل رد رسید (اختیاری):')
      if (input === null) return
      reason = input
    }

    setReviewingId(receipt.id)
    try {
      const result = await reviewLedgerReceipt(receipt.id, decision, reason)
      if (result.error) {
        alert('❌ ' + result.error)
        return
      }

      const newPaymentStatus = result.paymentStatus || 'unpaid'
      const updated = { ...order, payment_status: newPaymentStatus }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)))
      setSelectedOrder(updated)
      setLedgerReceipts((prev) => prev.filter((r) => r.id !== receipt.id))
    } catch {
      alert('❌ خطا در بررسی رسید')
    } finally {
      setReviewingId(null)
    }
  }

  function openCancelModal(order: Order) {
    setCancelOrder(order)
    setSelectedReasonId(null)
    setCancelNote('')
  }

  function closeCancelModal() {
    if (cancelling) return
    setCancelOrder(null)
    setSelectedReasonId(null)
    setCancelNote('')
  }

  async function confirmCancel() {
    if (!cancelOrder) return
    setCancelling(true)
    try {
      const selectedReason = cancelReasons.find(
        (r) => r.id === selectedReasonId
      )
      const formData = new FormData()
      formData.append('id', cancelOrder.id)
      formData.append('status', 'cancelled')
      formData.append('cancelled_by', 'admin')
      if (selectedReasonId)
        formData.append('cancellation_reason_id', selectedReasonId)
      if (selectedReason)
        formData.append('cancellation_reason_label', selectedReason.label)
      if (cancelNote.trim())
        formData.append('cancellation_note', cancelNote.trim())

      const result = await updateOrderStatus(formData)
      if (result?.error) {
        alert('❌ ' + result.error)
        return
      }

      const updatedOrder: Partial<Order> = {
        status: 'cancelled',
        cancelled_by: 'admin',
        cancellation_reason_id: selectedReasonId,
        cancellation_reason_label: selectedReason?.label || null,
        cancellation_note: cancelNote.trim() || null,
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === cancelOrder.id ? { ...o, ...updatedOrder } : o
        )
      )
      if (selectedOrder?.id === cancelOrder.id) {
        setSelectedOrder({ ...selectedOrder, ...updatedOrder })
      }
      closeCancelModal()
    } catch {
      alert('❌ خطا در لغو سفارش')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <div className="admin-main">
        <div className="admin-header">
          <div>
            <h1>
              {trashMode ? '🗑 سفارش‌های حذف‌شده' : 'مدیریت سفارش‌ها'}
            </h1>
            <p className="admin-subtitle">
              {trashMode
                ? 'این سفارش‌ها در گزارش‌ها نمایش داده نمی‌شن. می‌تونی بازیابی‌شون کنی.'
                : counts.pending > 0
                  ? `${formatPrice(counts.pending)} سفارش جدید در انتظار تأیید`
                  : 'سفارش جدیدی در انتظار تأیید نیست'}
            </p>
          </div>
          {trashMode ? (
            <button
              type="button"
              className="btn"
              onClick={() => setTrashMode(false)}
            >
              ← بازگشت به سفارش‌ها
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => setExportOpen(true)}
              title="خروجی Excel (CSV)"
            >
              📥 خروجی Excel
            </button>
          )}
        </div>

        <div className="orders-search-box">
          <span>🔍</span>
          <select
            className="orders-search-select"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as SearchType)}
          >
            <option value="all">همه موارد</option>
            <option value="order_number">شماره سفارش</option>
            <option value="customer_name">نام مشتری</option>
            <option value="customer_phone">شماره تماس</option>
            <option value="table_number">شماره میز</option>
            <option value="items">آیتم‌های منو</option>
          </select>
          <input
            type="search"
            placeholder={
              searchType === 'all'
                ? 'جستجو...'
                : searchType === 'order_number'
                  ? 'مثلاً ۱۰۲۴'
                  : searchType === 'customer_name'
                    ? 'مثلاً احمد رضایی'
                    : searchType === 'customer_phone'
                      ? 'مثلاً ۰۹۱۲...'
                      : searchType === 'items'
                        ? 'مثلاً پاستا، کاپوچینو...'
                        : 'مثلاً ۳'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {!trashMode && (
          <div className="stat-tabs">
            <button
              type="button"
              className={`stat-tab ${filter === 'pending' ? 'active' : ''}`}
              data-tone="pending"
              onClick={() => setFilter('pending')}
            >
              <span className="stat-tab-icon">🔴</span>
              <span className="stat-tab-count">
                {formatPrice(counts.pending)}
              </span>
              <span className="stat-tab-label">جدید</span>
            </button>

            <button
              type="button"
              className={`stat-tab ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              <span className="stat-tab-icon">⏳</span>
              <span className="stat-tab-count">
                {formatPrice(counts.active)}
              </span>
              <span className="stat-tab-label">در جریان</span>
            </button>

            <button
              type="button"
              className={`stat-tab ${filter === 'done' ? 'active' : ''}`}
              data-tone="done"
              onClick={() => setFilter('done')}
            >
              <span className="stat-tab-icon">✅</span>
              <span className="stat-tab-count">{formatPrice(counts.done)}</span>
              <span className="stat-tab-label">تمام‌شده</span>
            </button>

            <button
              type="button"
              className={`stat-tab ${filter === 'unpaid' ? 'active' : ''}`}
              data-tone="unpaid"
              onClick={() => setFilter('unpaid')}
            >
              <span className="stat-tab-icon">💸</span>
              <span className="stat-tab-count">
                {formatPrice(counts.unpaid)}
              </span>
              <span className="stat-tab-label">پرداخت‌نشده</span>
            </button>

            <button
              type="button"
              className={`stat-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              <span className="stat-tab-icon">📋</span>
              <span className="stat-tab-count">{formatPrice(counts.all)}</span>
              <span className="stat-tab-label">همه</span>
            </button>

            {allowDeleteOrders && counts.deleted > 0 && (
              <button
                type="button"
                className="stat-tab"
                data-tone="danger"
                onClick={() => setTrashMode(true)}
              >
                <span className="stat-tab-icon">🗑</span>
                <span className="stat-tab-count">
                  {formatPrice(counts.deleted)}
                </span>
                <span className="stat-tab-label">حذف‌شده‌ها</span>
              </button>
            )}
          </div>
        )}

        {filteredOrders.length === 0 ? (
          <div className="admin-card">
            <p className="empty-admin">
              {trashMode
                ? 'سفارش حذف‌شده‌ای وجود ندارد.'
                : 'سفارشی در این بخش نیست.'}
            </p>
          </div>
        ) : (
          <div className="orders-grid">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className={`order-card ${STATUS_COLORS[order.status]} order-card--${order.payment_status || 'unpaid'}`}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="order-header">
                  <span className="order-id">
                    سفارش #{formatPrice(order.order_number)}
                  </span>
                  <span
                    className="order-time"
                    title={formatPersianDate(order.created_at)}
                  >
                    {formatTime(order.created_at)}
                  </span>
                </div>

                <div className="order-body">
                  <div>
                    👤 <strong>{order.customer_name}</strong>
                  </div>
                  <div>
                    📞 <span dir="ltr">{order.customer_phone}</span>
                  </div>

                  {order.table_number && (
                    <div style={{ fontWeight: 800, color: '#6b4f3a' }}>
                      📍 میز {formatPrice(order.table_number)}
                    </div>
                  )}
                  {order.note && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#9b3c32',
                        background: '#fdf9f4',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        marginTop: '4px',
                      }}
                    >
                      📝 {order.note}
                    </div>
                  )}

                  <div style={{ marginTop: '6px' }}>
                    🧾 {formatPrice(order.items.length)} قلم ·{' '}
                    {formatPrice(order.subtotal)} تومان
                  </div>
                </div>

                <div
                  className={`order-payment-badge-inline ${order.payment_status || 'unpaid'}`}
                >
                  {order.payment_method === 'online'
                    ? '💳'
                    : order.payment_method === 'cash'
                      ? '💵'
                      : order.payment_method === 'card'
                        ? '💳'
                        : '🏦'}{' '}
                  {PAYMENT_METHOD_LABELS[order.payment_method || ''] ||
                    'نامشخص'}{' '}
                  —{' '}
                  {PAYMENT_STATUS_LABELS[order.payment_status || 'unpaid']}
                  {order.payment_ref_id && (
                    <span className="order-payment-ref-id" dir="ltr">
                      {order.payment_ref_id}
                    </span>
                  )}
                </div>

                <div className="order-actions" style={{ flexWrap: 'wrap' }}>
                  {trashMode ? (
                    <button
                      type="button"
                      className="btn btn-approve"
                      style={{ flex: 1 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRestore(order)
                      }}
                      disabled={deletingId === order.id}
                    >
                      {deletingId === order.id ? '...' : '♻ بازیابی'}
                    </button>
                  ) : (
                    <>
                      {order.payment_status !== 'paid' &&
                        order.status !== 'cancelled' && (
                          <button
                            type="button"
                            className="btn"
                            style={{
                              flex: '1 1 100%',
                              marginBottom: '8px',
                              background: '#fff4d9',
                              color: '#9a6b3f',
                              borderColor: '#f2d99f',
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              openSettleModal(order, false)
                            }}
                            disabled={loading}
                          >
                            💰 تسویه (پرداخت شد)
                          </button>
                        )}

                      {NEXT_STATUS[order.status] && (
                        <button
                          type="button"
                          className="btn btn-approve"
                          style={{ flex: 1 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusChange(
                              order,
                              NEXT_STATUS[order.status]!
                            )
                          }}
                          disabled={loading}
                        >
                          {NEXT_LABEL[order.status]}
                        </button>
                      )}

                      {['pending', 'confirmed'].includes(order.status) && (
                        <button
                          type="button"
                          className="btn btn-cancel"
                          style={{ flex: '0 0 auto' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            openCancelModal(order)
                          }}
                          disabled={loading}
                        >
                          ❌
                        </button>
                      )}

                      {allowDeleteOrders && (
                        <button
                          type="button"
                          className="btn btn-delete-order"
                          style={{ flex: '0 0 auto' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(order)
                          }}
                          disabled={
                            loading || deletingId === order.id
                          }
                          title="حذف از گزارش"
                        >
                          {deletingId === order.id ? '...' : '🗑'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedOrder && (
          <div
            className="modal-overlay"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="modal-container modal-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-header-content">
                  <h2>
                    سفارش #{formatPrice(selectedOrder.order_number)}
                  </h2>
                  <p>وضعیت: {STATUS_LABELS[selectedOrder.status]}</p>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setSelectedOrder(null)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                {selectedOrder.deleted_at && (
                  <div
                    className="admin-error"
                    style={{ marginBottom: 16 }}
                  >
                    🗑 این سفارش حذف شده است (از گزارش‌ها مخفی).
                  </div>
                )}

                {selectedOrder.status === 'cancelled' &&
                  selectedOrder.cancellation_reason_label && (
                    <div
                      className="cancellation-info-box"
                      style={{ marginTop: 0, marginBottom: '16px' }}
                    >
                      <div className="cancellation-info-label">
                        {selectedOrder.cancellation_reason_label}
                      </div>
                      {selectedOrder.cancellation_note && (
                        <div className="cancellation-info-note">
                          📝 {selectedOrder.cancellation_note}
                        </div>
                      )}
                      <div className="cancellation-info-by">
                        {selectedOrder.cancelled_by === 'customer'
                          ? 'لغو شده توسط مشتری'
                          : selectedOrder.cancelled_by === 'admin'
                            ? 'لغو شده توسط کافه'
                            : 'لغو شده'}
                      </div>
                    </div>
                  )}

                <div className="info-card">
                  <h3>👤 اطلاعات مشتری</h3>
                  <div className="info-row">
                    <span>نام:</span>
                    <strong>{selectedOrder.customer_name}</strong>
                  </div>
                  <div className="info-row">
                    <span>شماره:</span>
                    <strong dir="ltr">{selectedOrder.customer_phone}</strong>
                  </div>
                  {selectedOrder.table_number && (
                    <div className="info-row">
                      <span>میز:</span>
                      <strong>
                        {formatPrice(selectedOrder.table_number)}
                      </strong>
                    </div>
                  )}
                  {selectedOrder.note && (
                    <div className="info-row">
                      <span>توضیحات:</span>
                      <strong>{selectedOrder.note}</strong>
                    </div>
                  )}
                </div>

                <div className="info-card" style={{ marginTop: '16px' }}>
                  <h3>💳 اطلاعات پرداخت</h3>
                  <div className="info-row">
                    <span>روش پرداخت:</span>
                    <strong>
                      {PAYMENT_METHOD_LABELS[
                        selectedOrder.payment_method || ''
                      ] || 'نامشخص'}
                    </strong>
                  </div>
                  <div className="info-row">
                    <span>وضعیت پرداخت:</span>
                    <strong
                      className={`payment-status-text ${selectedOrder.payment_status || 'unpaid'}`}
                    >
                      {
                        PAYMENT_STATUS_LABELS[
                          selectedOrder.payment_status || 'unpaid'
                        ]
                      }
                    </strong>
                  </div>
                  {selectedOrder.payment_ref_id && (
                    <div className="info-row">
                      <span>کد رهگیری:</span>
                      <strong dir="ltr" className="order-payment-ref-id">
                        {selectedOrder.payment_ref_id}
                      </strong>
                    </div>
                  )}
                  {selectedOrder.payment_note && (
                    <div className="info-row">
                      <span>یادداشت پرداخت:</span>
                      <strong>{selectedOrder.payment_note}</strong>
                    </div>
                  )}
                  {selectedOrder.payment_receipt_url && (
                    <div className="info-row">
                      <span>رسید:</span>
                      <a
                        href={selectedOrder.payment_receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="order-receipt-link"
                      >
                        📸 مشاهده رسید
                      </a>
                    </div>
                  )}
                  <div className="info-row">
                    <span>تاریخ ثبت:</span>
                    <strong>
                      {formatPersianDate(selectedOrder.created_at)}
                    </strong>
                  </div>
                                    {ledgerReceipts.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: '#fff7e6',
                        border: '1px solid #f2d99f',
                        borderRadius: '10px',
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: '8px' }}>
                        🧾 رسید بدهی: {formatPrice(r.amount)} تومان
                      </div>
                      <div style={{ fontSize: '12px', color: '#766f64', marginBottom: '8px' }}>
                        ارسال‌شده: {formatPersianDate(r.created_at)}
                      </div>
                      {r.receipt_url && (
                        <div style={{ marginBottom: '8px' }}>
                          <a
                            href={r.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="order-receipt-link"
                          >
                            📸 مشاهده عکس رسید
                          </a>
                        </div>
                      )}
                      {r.receipt_note && (
                        <div style={{ marginBottom: '8px' }}>📝 {r.receipt_note}</div>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ flex: 1, background: '#9b3c32', color: '#fff', border: 0 }}
                          onClick={() => handleReviewLedger(selectedOrder, r, 'rejected')}
                          disabled={reviewingId === r.id}
                        >
                          {reviewingId === r.id ? '...' : '❌ رد رسید'}
                        </button>
                        <button
                          type="button"
                          className="btn primary-btn"
                          style={{ flex: 1 }}
                          onClick={() => handleReviewLedger(selectedOrder, r, 'confirmed')}
                          disabled={reviewingId === r.id}
                        >
                          {reviewingId === r.id ? '...' : '✅ تأیید رسید'}
                        </button>
                      </div>
                    </div>
                  ))}

                  {ledgerReceipts.length === 0 &&
                    !loadingLedger &&
                    selectedOrder.payment_method === 'transfer' &&
                    selectedOrder.payment_status === 'pending_review' &&

                    selectedOrder.status !== 'cancelled' &&
                    !selectedOrder.deleted_at && (
                      <div style={{ marginTop: '12px' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ width: '100%', background: '#9b3c32', color: '#fff', border: 0 }}
                          onClick={() => handleRejectReceipt(selectedOrder)}
                          disabled={rejectingReceipt}
                        >
                          {rejectingReceipt ? '...' : '❌ عدم تأیید رسید'}
                        </button>
                      </div>
                    )}

                  {selectedOrder.payment_status !== 'paid' &&
                    ledgerReceipts.length === 0 &&
                    !selectedOrder.deleted_at && (
                      <div
                        style={{
                          marginTop: '12px',
                          paddingTop: '12px',
                          borderTop: '1px dashed #ebe6de',
                        }}
                      >
                        {!showApprovePayment ? (
                          <button
                            type="button"
                            className="btn primary-btn"
                            style={{
                              width: '100%',
                              justifyContent: 'center',
                            }}
                            onClick={() => openSettleModal(selectedOrder, false)}
                          >
                            ✅ تأیید پرداخت (دستی)
                          </button>
                        ) : (
                          <div className="payment-approve-form">
                            <label
                              style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                display: 'block',
                                marginBottom: '6px',
                              }}
                            >
                              یادداشت (اختیاری):
                            </label>
                            <input
                              type="text"
                              value={paymentNote}
                              onChange={(e) =>
                                setPaymentNote(e.target.value)
                              }
                              placeholder="مثلاً: پرداخت نقدی در محل"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #d8d0c4',
                                marginBottom: '8px',
                                fontFamily: 'inherit',
                              }}
                            />
                            <div
                              style={{ display: 'flex', gap: '8px' }}
                            >
                              <button
                                type="button"
                                className="btn"
                                style={{ flex: 1 }}
                                onClick={() => {
                                  setShowApprovePayment(false)
                                  setPaymentNote('')
                                }}
                                disabled={approvingPayment}
                              >
                                انصراف
                              </button>
                              <button
                                type="button"
                                className="btn primary-btn"
                                style={{ flex: 1 }}
                                onClick={() =>
                                  handleApprovePayment(selectedOrder)
                                }
                                disabled={approvingPayment}
                              >
                                {approvingPayment
                                  ? '...'
                                  : '✅ ثبت پرداخت'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                </div>

                <div className="info-card" style={{ marginTop: '16px' }}>
                  <h3>🧾 اقلام سفارش</h3>
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="info-row">
                      <span>
                        {formatPrice(item.quantity)} × {item.product_name}
                        {item.option_name && (
                          <small> ({item.option_name})</small>
                        )}
                      </span>
                      <strong>
                        {formatPrice(item.unit_price * item.quantity)}
                      </strong>
                    </div>
                  ))}
                  {selectedOrder.coupon_code &&
                  selectedOrder.coupon_discount ? (
                    <>
                      <div
                        className="info-row"
                        style={{ marginTop: '10px' }}
                      >
                        <span>جمع اقلام:</span>
                        <strong>
                          {formatPrice(
                            selectedOrder.original_subtotal ??
                              selectedOrder.subtotal
                          )}{' '}
                          تومان
                        </strong>
                      </div>
                      <div className="info-row discount">
                        <span>
                          🎟️ تخفیف ({selectedOrder.coupon_code}):
                        </span>
                        <strong>
                          − {formatPrice(selectedOrder.coupon_discount)}{' '}
                          تومان
                        </strong>
                      </div>
                      <div className="total-row">
                        <span>قابل پرداخت</span>
                        <span>
                          {formatPrice(selectedOrder.subtotal)} تومان
                        </span>
                      </div>
                    </>
                                    ) : (
                    <div className="total-row">
                      <span>جمع کل</span>
                      <span>
                        {formatPrice(selectedOrder.subtotal)} تومان
                      </span>
                    </div>
                  )}
                  {(selectedOrder.paid_amount ?? 0) > 0 && (
                    <>
                      <div className="total-row">
                        <span>پرداخت‌شده</span>
                        <span>
                          {formatPrice(selectedOrder.paid_amount ?? 0)} تومان
                        </span>
                      </div>
                      <div className="total-row">
                        <span>باقی‌مانده</span>
                        <strong>
                          {formatPrice(
                            Math.max(
                              0,
                              selectedOrder.subtotal -
                                (selectedOrder.paid_amount ?? 0)
                            )
                          )}{' '}
                          تومان
                        </strong>
                      </div>
                    </>
                  )}
                </div>

              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPrintOrder(selectedOrder)}
                  title="چاپ فاکتور"
                >
                  🖨️ چاپ
                </button>
                <a
                  href={`tel:${selectedOrder.customer_phone}`}
                  className="btn"
                  style={{ textDecoration: 'none' }}
                >
                  📞 تماس
                </a>
                {NEXT_STATUS[selectedOrder.status] &&
                  !selectedOrder.deleted_at && (
                    <button
                      type="button"
                      className="btn primary-btn"
                      onClick={() =>
                        handleStatusChange(
                          selectedOrder,
                          NEXT_STATUS[selectedOrder.status]!
                        )
                      }
                      disabled={loading}
                    >
                      {NEXT_LABEL[selectedOrder.status]}
                    </button>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>

      {settleOrder && (
        <div className="modal-overlay" onClick={closeSettleModal}>
          <div
            className="modal-container modal-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-content">
                <h2>
                  تسویه حساب سفارش #
                  {formatPrice(settleOrder.order_number)}
                </h2>
                <p>
                  {settleAndDeliver
                    ? 'این سفارش تسویه و سپس تحویل داده می‌شود'
                    : 'ثبت پرداخت برای این سفارش'}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeSettleModal}
                disabled={settling}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <div
                  style={{
                    fontSize: '14px',
                    color: '#766f64',
                    marginBottom: '8px',
                  }}
                >
                  مبلغ قابل پرداخت:
                </div>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 900,
                    color: '#2d5d3e',
                  }}
                >
                                    {formatPrice(
                    Math.max(
                      0,
                      settleOrder.subtotal - (settleOrder.paid_amount ?? 0)
                    )
                  )}{' '}

                  <span style={{ fontSize: '16px' }}>تومان</span>
                </div>
              </div>
              {(settleOrder.paid_amount ?? 0) > 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#766f64',
                    marginTop: '-12px',
                    marginBottom: '16px',
                  }}
                >
                  از مبلغ کل {formatPrice(settleOrder.subtotal)} تومان،{' '}
                  {formatPrice(settleOrder.paid_amount ?? 0)} تومان قبلاً پرداخت شده است.
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  نحوه پرداخت:
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                  }}
                >
                  <button
                    type="button"
                    className={`btn ${settleMethod === 'cash' ? 'primary-btn' : ''}`}
                    style={{
                      minHeight: '50px',
                      justifyContent: 'center',
                      fontSize: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onClick={() => setSettleMethod('cash')}
                  >
                    💵 نقدی
                  </button>
                  <button
                    type="button"
                    className={`btn ${settleMethod === 'card' ? 'primary-btn' : ''}`}
                    style={{
                      minHeight: '50px',
                      justifyContent: 'center',
                      fontSize: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onClick={() => setSettleMethod('card')}
                  >
                    💳 کارت‌خوان
                  </button>
                </div>
              </div>

              <div
                className="field"
                style={{ marginBottom: '16px' }}
              >
                <label
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  یادداشت (اختیاری):
                </label>
                <textarea
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  placeholder="مثلاً: کارت‌خوان بانک ملت، دستگاه ۲..."
                  rows={3}
                  disabled={settling}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #d8d0c4',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>

              {settleAndDeliver && (
                <>
                  <div
                    style={{
                      padding: '12px',
                      background: '#fff4d9',
                      color: '#9a6b3f',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textAlign: 'center',
                    }}
                  >
                    ⚠️ با تایید، سفارش تسویه و سپس تحویل داده می‌شود.
                  </div>

                  <div className="deliver-without-pay-section">
                    <button
                      type="button"
                      className="btn btn-deliver-without-pay"
                      onClick={confirmDeliverWithoutPayment}
                      disabled={settling}
                    >
                      🚚 تحویل بدون تسویه
                    </button>
                    <p className="deliver-without-pay-hint">
                      سفارش تحویل داده می‌شه، ولی در تب «پرداخت‌نشده»
                      می‌مونه تا بعداً تسویه کنی.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={closeSettleModal}
                disabled={settling}
              >
                انصراف
              </button>
              <button
                type="button"
                className="btn primary-btn"
                onClick={confirmSettle}
                disabled={settling}
              >
                {settling
                  ? '...'
                  : settleAndDeliver
                    ? '✅ تسویه و تحویل'
                    : '✅ ثبت تسویه'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelOrder && (
        <div className="modal-overlay" onClick={closeCancelModal}>
          <div
            className="modal-container modal-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-content">
                <h2>
                  لغو سفارش #{formatPrice(cancelOrder.order_number)}
                </h2>
                <p>دلیل لغو رو انتخاب کن</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeCancelModal}
                disabled={cancelling}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {loadingReasons ? (
                <p className="empty-admin" style={{ padding: '20px' }}>
                  ⏳ در حال بارگذاری دلایل...
                </p>
              ) : cancelReasons.length === 0 ? (
                <p className="empty-admin" style={{ padding: '20px' }}>
                  دلیلی برای نمایش وجود ندارد. می‌تونی بدون دلیل لغو
                  کنی.
                </p>
              ) : (
                <div className="cancel-reasons-list">
                  {cancelReasons.map((reason) => (
                    <button
                      key={reason.id}
                      type="button"
                      className={`cancel-reason-item ${selectedReasonId === reason.id ? 'selected' : ''}`}
                      onClick={() => setSelectedReasonId(reason.id)}
                      disabled={cancelling}
                    >
                      <span className="cancel-reason-icon">
                        {reason.icon || '📝'}
                      </span>
                      <span className="cancel-reason-label">
                        {reason.label}
                      </span>
                      {selectedReasonId === reason.id && (
                        <span className="cancel-reason-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="cancel-note-field">
                <label>توضیحات بیشتر (اختیاری)</label>
                <textarea
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder="اگه دوست داری بیشتر توضیح بده..."
                  rows={3}
                  disabled={cancelling}
                />
              </div>

              <div className="cancel-warning">
                ⚠️ بعد از لغو، این سفارش از سیستم حذف میشه. اگه دلیل
                انتخاب کنی، برای مشتری نمایش داده میشه.
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={closeCancelModal}
                disabled={cancelling}
              >
                انصراف
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: '#9b3c32',
                  color: '#fff',
                  border: 0,
                }}
                onClick={confirmCancel}
                disabled={cancelling}
              >
                {cancelling ? '...' : '❌ لغو سفارش'}
              </button>
            </div>
          </div>
        </div>
      )}

      {exportOpen && (
        <div
          className="modal-overlay"
          onClick={() => !exporting && setExportOpen(false)}
        >
          <div
            className="modal-container modal-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-content">
                <h2>📥 خروجی Excel</h2>
                <p>فایل CSV برای اکسل و حسابداری</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setExportOpen(false)}
                disabled={exporting}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="export-field">
                <label>بازه زمانی</label>
                <div className="export-options">
                  {(
                    Object.keys(EXPORT_FILTER_LABELS) as ExportFilter[]
                  ).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`export-option ${exportFilter === f ? 'active' : ''}`}
                      onClick={() => setExportFilter(f)}
                    >
                      {EXPORT_FILTER_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="export-field"
                style={{ marginTop: '16px' }}
              >
                <label>وضعیت سفارش</label>
                <div className="export-options">
                  {(
                    Object.keys(EXPORT_STATUS_LABELS) as ExportStatus[]
                  ).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`export-option ${exportStatus === s ? 'active' : ''}`}
                      onClick={() => setExportStatus(s)}
                    >
                      {EXPORT_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <p className="export-hint">
                📌 فایل با فرمت CSV دانلود می‌شود که در Excel، Google
                Sheets و WPS Office باز می‌شود.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setExportOpen(false)}
                disabled={exporting}
              >
                انصراف
              </button>
              <button
                type="button"
                className="btn primary-btn"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? '...' : '📥 دانلود فایل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mounted &&
        printOrder &&
        createPortal(
          <div className="print-invoice">
            <div className="print-invoice-header">
              <h1 className="print-invoice-title">کافه پارک</h1>
              <p className="print-invoice-subtitle">فاکتور سفارش</p>
            </div>

            <div className="print-invoice-meta">
              <div className="print-invoice-meta-row">
                <span>شماره سفارش:</span>
                <strong>#{formatPrice(printOrder.order_number)}</strong>
              </div>
              <div className="print-invoice-meta-row">
                <span>تاریخ و ساعت:</span>
                <strong>{formatPersianDate(printOrder.created_at)}</strong>
              </div>
              <div className="print-invoice-meta-row">
                <span>وضعیت:</span>
                <strong>{STATUS_LABELS[printOrder.status]}</strong>
              </div>
              <div className="print-invoice-meta-row">
                <span>وضعیت پرداخت:</span>
                <strong>
                  {PAYMENT_STATUS_LABELS[printOrder.payment_status || 'unpaid']}
                </strong>
              </div>
            </div>

            <div className="print-invoice-customer">
              <h3>اطلاعات مشتری</h3>
              <div className="print-invoice-meta-row">
                <span>نام:</span>
                <strong>{printOrder.customer_name}</strong>
              </div>
              <div className="print-invoice-meta-row">
                <span>شماره تماس:</span>
                <strong dir="ltr">{printOrder.customer_phone}</strong>
              </div>
              {printOrder.table_number && (
                <div className="print-invoice-meta-row">
                  <span>شماره میز:</span>
                  <strong>{formatPrice(printOrder.table_number)}</strong>
                </div>
              )}
              {printOrder.note && (
                <div className="print-invoice-meta-row">
                  <span>توضیحات:</span>
                  <strong>{printOrder.note}</strong>
                </div>
              )}
            </div>

            <div className="print-invoice-items">
              <h3>اقلام سفارش</h3>
              <table className="print-invoice-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>#</th>
                    <th>نام محصول</th>
                    <th
                      style={{
                        width: '50px',
                        textAlign: 'center',
                      }}
                    >
                      تعداد
                    </th>
                    <th style={{ width: '90px', textAlign: 'left' }}>
                      قیمت واحد
                    </th>
                    <th style={{ width: '90px', textAlign: 'left' }}>
                      تخفیف
                    </th>
                    <th style={{ width: '100px', textAlign: 'left' }}>
                      جمع
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {printOrder.items.map((item: any, idx) => {
                    const itemDiscount = item.discount_amount || 0
                    const itemTotal = item.unit_price * item.quantity
                    const finalItemTotal = itemTotal - itemDiscount

                    return (
                      <tr key={idx}>
                        <td>{formatPrice(idx + 1)}</td>
                        <td>
                          {item.product_name}
                          {item.option_name && (
                            <small
                              style={{
                                color: '#666',
                                display: 'block',
                              }}
                            >
                              ({item.option_name})
                            </small>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {formatPrice(item.quantity)}
                        </td>
                        <td style={{ textAlign: 'left' }}>
                          {formatPrice(item.unit_price)}
                        </td>
                        <td
                          style={{
                            textAlign: 'left',
                            color:
                              itemDiscount > 0 ? '#2d5d3e' : '#999',
                            fontWeight: itemDiscount > 0 ? 700 : 400,
                          }}
                        >
                          {itemDiscount > 0
                            ? `− ${formatPrice(itemDiscount)}`
                            : '—'}
                        </td>
                        <td
                          style={{
                            textAlign: 'left',
                            fontWeight: 700,
                          }}
                        >
                          {formatPrice(finalItemTotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  {printOrder.coupon_code &&
                  printOrder.coupon_discount ? (
                    <>
                      <tr className="invoice-summary-row">
                        <td colSpan={5}>جمع اقلام:</td>
                        <td>
                          {formatPrice(
                            printOrder.original_subtotal ??
                              printOrder.subtotal
                          )}{' '}
                          تومان
                        </td>
                      </tr>
                      <tr className="invoice-summary-row invoice-discount-row">
                        <td colSpan={5}>
                          🎟️ تخفیف ({printOrder.coupon_code}):
                        </td>
                        <td>
                          − {formatPrice(printOrder.coupon_discount)}{' '}
                          تومان
                        </td>
                      </tr>
                      <tr className="invoice-summary-row invoice-total-row">
                        <td colSpan={5}>قابل پرداخت:</td>
                        <td>
                          {formatPrice(printOrder.subtotal)} تومان
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr className="invoice-summary-row invoice-total-row">
                      <td colSpan={5}>جمع کل:</td>
                      <td>
                        {formatPrice(printOrder.subtotal)} تومان
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            <div className="print-invoice-footer">
              <p>با تشکر از سفارش شما 🌹</p>
              <p className="print-invoice-footer-small">
                کافه پارک — پارک سلامت شیراز
              </p>
            </div>
          </div>,
          document.body
        )}

      <StepUpModal
        isOpen={stepUp.modalOpen}
        verifying={stepUp.verifying}
        error={stepUp.error}
        onConfirm={stepUp.verify}
        onClose={stepUp.close}
      />
    </>
  )
}