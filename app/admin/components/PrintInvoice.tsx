'use client'

const formatPrice = (n: number) =>
  new Intl.NumberFormat('fa-IR').format(Math.round(n))

export type PrintableOrder = {
  order_number: number
  customer_name: string
  customer_phone: string
  table_number: number | null
  note?: string | null
  items: Array<{
    product_name: string
    option_name: string | null
    unit_price: number
    quantity: number
    discount_amount?: number
  }>
  subtotal: number
  original_subtotal?: number | null
  coupon_code?: string | null
  coupon_discount?: number | null
  status: string
  created_at: string
}

export default function PrintInvoice({ order }: { order: PrintableOrder }) {
  return (
    <div className="print-invoice">
      <div className="print-invoice-header">
        <h1 className="print-invoice-title">کافه پارک</h1>
        <p className="print-invoice-subtitle">فاکتور سفارش</p>
      </div>

      <div className="print-invoice-meta">
        <div className="print-invoice-meta-row">
          <span>شماره سفارش:</span>
          <strong>#{formatPrice(order.order_number)}</strong>
        </div>
        <div className="print-invoice-meta-row">
          <span>تاریخ و ساعت:</span>
          <strong>{new Date(order.created_at).toLocaleString('fa-IR')}</strong>
        </div>
      </div>

      <div className="print-invoice-customer">
        <h3>اطلاعات مشتری</h3>
        <div className="print-invoice-meta-row">
          <span>نام:</span>
          <strong>{order.customer_name}</strong>
        </div>
        <div className="print-invoice-meta-row">
          <span>شماره تماس:</span>
          <strong dir="ltr">{order.customer_phone}</strong>
        </div>
        {order.table_number && (
          <div className="print-invoice-meta-row">
            <span>شماره میز:</span>
            <strong>{formatPrice(order.table_number)}</strong>
          </div>
        )}
        {order.note && (
          <div className="print-invoice-meta-row">
            <span>توضیحات:</span>
            <strong>{order.note}</strong>
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
              <th style={{ width: '50px', textAlign: 'center' }}>تعداد</th>
              <th style={{ width: '90px', textAlign: 'left' }}>قیمت واحد</th>
              <th style={{ width: '90px', textAlign: 'left' }}>تخفیف</th>
              <th style={{ width: '100px', textAlign: 'left' }}>جمع</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => {
              const itemDiscount = item.discount_amount || 0
              const itemTotal = item.unit_price * item.quantity
              const finalItemTotal = itemTotal - itemDiscount

              return (
                <tr key={idx}>
                  <td>{formatPrice(idx + 1)}</td>
                  <td>
                    {item.product_name}
                    {item.option_name && (
                      <small style={{ color: '#666', display: 'block' }}>
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
                      color: itemDiscount > 0 ? '#2d5d3e' : '#999',
                      fontWeight: itemDiscount > 0 ? 700 : 400,
                    }}
                  >
                    {itemDiscount > 0 ? `− ${formatPrice(itemDiscount)}` : '—'}
                  </td>
                  <td style={{ textAlign: 'left', fontWeight: 700 }}>
                    {formatPrice(finalItemTotal)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            {order.coupon_code && order.coupon_discount ? (
              <>
                <tr className="invoice-summary-row">
                  <td colSpan={5}>جمع اقلام:</td>
                  <td>
                    {formatPrice(
                      order.original_subtotal ?? order.subtotal
                    )}{' '}
                    تومان
                  </td>
                </tr>
                <tr className="invoice-summary-row invoice-discount-row">
                  <td colSpan={5}>🎟️ تخفیف ({order.coupon_code}):</td>
                  <td>− {formatPrice(order.coupon_discount)} تومان</td>
                </tr>
                <tr className="invoice-summary-row invoice-total-row">
                  <td colSpan={5}>قابل پرداخت:</td>
                  <td>{formatPrice(order.subtotal)} تومان</td>
                </tr>
              </>
            ) : (
              <tr className="invoice-summary-row invoice-total-row">
                <td colSpan={5}>جمع کل:</td>
                <td>{formatPrice(order.subtotal)} تومان</td>
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
    </div>
  )
}