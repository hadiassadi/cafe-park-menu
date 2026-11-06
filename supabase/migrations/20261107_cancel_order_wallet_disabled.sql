-- بستن موقت بازپرداخت به کیف پول تا زمان ساخته شدن کیف پول واقعی
create or replace function public.cancel_order_atomic(
  p_order_id uuid,
  p_cancelled_by text,
  p_device_hash text default null::text,
  p_reason_id uuid default null::uuid,
  p_reason_label text default null::text,
  p_note text default null::text,
  p_refund_method text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o          record;
  v_paid     bigint;
  v_review   int;
  v_refunded bigint := 0;
begin
  if p_cancelled_by not in ('customer','admin') then
    raise exception 'invalid_actor';
  end if;

  select id, order_number, status, deleted_at, created_at, customer_confirmed,
         payment_status, payment_receipt_url, payment_note, device_id_hash, customer_phone
    into o
    from orders
   where id = p_order_id
   for update;

  if not found or o.deleted_at is not null then
    raise exception 'order_not_found';
  end if;
  if p_cancelled_by = 'customer'
     and (p_device_hash is null or o.device_id_hash is distinct from p_device_hash) then
    raise exception 'order_not_found';
  end if;
  if o.status in ('cancelled','canceled') then raise exception 'already_cancelled'; end if;
  if o.status = 'delivered' then raise exception 'order_delivered'; end if;

  select coalesce(sum(amount) filter (where status = 'confirmed'), 0),
         count(*) filter (where status = 'pending_review')
    into v_paid, v_review
    from order_payments
   where order_id = p_order_id;

  if v_review > 0 then raise exception 'pending_receipts'; end if;

  if p_cancelled_by = 'customer' then
    if o.status <> 'pending' or o.customer_confirmed then raise exception 'not_cancellable'; end if;
    if v_paid > 0 or o.payment_status = 'paid'
       or o.payment_receipt_url is not null or o.payment_note is not null then
      raise exception 'paid_or_receipt';
    end if;
    if now() - o.created_at > interval '5 minutes' then raise exception 'window_expired'; end if;
  end if;

  -- بازپرداخت پول دریافت‌شده
  if v_paid > 0 then
    if p_refund_method is null or p_refund_method not in ('cash','wallet','gateway_manual') then
      raise exception 'refund_method_required';
    end if;

    if p_refund_method = 'wallet' then
      -- کیف پول هنوز پیاده‌سازی نشده؛ تا آن زمان این مسیر بسته است
      raise exception 'wallet_disabled';
    end if;

    insert into order_refunds
      (order_id, order_number, customer_phone, amount, method, note)
    values
      (o.id, o.order_number, o.customer_phone, v_paid, p_refund_method, p_note);

    v_refunded := v_paid;
  end if;

  update orders
     set status = 'cancelled',
         cancelled_by = p_cancelled_by,
         cancelled_at = now(),
         cancellation_reason_id = p_reason_id,
         cancellation_reason_label = left(p_reason_label, 100),
         cancellation_note = left(p_note, 500)
   where id = p_order_id;
  -- کوپن را تریگر orders_sync_coupon_usage برمی‌گرداند

  delete from redemption_logs where order_id = p_order_id;

  return jsonb_build_object('refunded', v_refunded, 'refund_method', p_refund_method);
end;
$function$;
