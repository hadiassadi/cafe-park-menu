-- ============================================================
-- Migration: fix ambiguous ends_at in subscription functions
-- Patch 28 — resolves 42702 column reference ambiguity
--
-- Root cause: both functions declared RETURNS TABLE(..., ends_at timestamptz),
-- so the OUT parameter "ends_at" collided with the column
-- customer_subscriptions.ends_at inside the UPDATE ... WHERE clause.
-- PL/pgSQL (variable_conflict = error) refused to resolve and raised
-- 42702: column reference "ends_at" is ambiguous.
--
-- Fix: qualify the column reference as customer_subscriptions.ends_at.
-- Idempotent: CREATE OR REPLACE — safe to re-run.
-- ============================================================

create or replace function public.grant_subscription(
  p_customer_id uuid,
  p_plan_id uuid,
  p_source text default 'card_to_card'
)
returns table(subscription_id uuid, ends_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_plan     record;
  v_new_ends timestamptz;
  v_sub_id   uuid;
begin
  if p_customer_id is null or p_plan_id is null then
    raise exception 'plan_not_found';
  end if;
  if p_source not in ('card_to_card', 'admin') then
    raise exception 'plan_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 0));

  select discount_percent, name, duration_days, is_active
    into v_plan
  from subscription_plans
  where id = p_plan_id;

  if not found or v_plan.is_active = false then
    raise exception 'plan_not_found';
  end if;

  update customer_subscriptions
     set status = 'expired'
   where customer_id = p_customer_id
     and status = 'active'
     and customer_subscriptions.ends_at <= now();

  if exists (
    select 1 from customer_subscriptions
    where customer_id = p_customer_id and status = 'active'
  ) then
    raise exception 'already_active';
  end if;

  v_new_ends := now() + (v_plan.duration_days || ' days')::interval;

  insert into customer_subscriptions
    (customer_id, plan_id, plan_name, discount_percent, price_paid, starts_at, ends_at, status, source)
  values
    (p_customer_id, p_plan_id, v_plan.name, v_plan.discount_percent, 0, now(), v_new_ends, 'active', p_source)
  returning id into v_sub_id;

  return query select v_sub_id, v_new_ends;
end
$function$;


create or replace function public.purchase_subscription_with_wallet(
  p_customer_id uuid,
  p_plan_id uuid
)
returns table(subscription_id uuid, ends_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_plan     record;
  v_price    bigint;
  v_balance  bigint;
  v_new_ends timestamptz;
  v_sub_id   uuid;
begin
  if p_customer_id is null or p_plan_id is null then
    raise exception 'plan_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 0));

  select price, discount_percent, name, duration_days, is_active
    into v_plan
  from subscription_plans
  where id = p_plan_id;

  if not found or v_plan.is_active = false then
    raise exception 'plan_not_found';
  end if;

  update customer_subscriptions
     set status = 'expired'
   where customer_id = p_customer_id
     and status = 'active'
     and customer_subscriptions.ends_at <= now();

  if exists (
    select 1 from customer_subscriptions
    where customer_id = p_customer_id and status = 'active'
  ) then
    raise exception 'already_active';
  end if;

  v_price := v_plan.price;
  if v_price > 0 then
    select wallet_balance(p_customer_id) into v_balance;
    if v_balance < v_price then
      raise exception 'insufficient_balance';
    end if;

    insert into wallet_transactions
      (customer_id, customer_phone, amount, kind, status, note, created_by)
    select c.id, c.phone, -v_price, 'subscription_purchase', 'settled',
           'خرید اشتراک «' || v_plan.name || '»', 'customer'
    from customers c
    where c.id = p_customer_id;

    if not found then
      raise exception 'plan_not_found';
    end if;
  end if;

  v_new_ends := now() + (v_plan.duration_days || ' days')::interval;

  insert into customer_subscriptions
    (customer_id, plan_id, plan_name, discount_percent, price_paid, starts_at, ends_at, status, source)
  values
    (p_customer_id, p_plan_id, v_plan.name, v_plan.discount_percent, v_price, now(), v_new_ends, 'active', 'wallet')
  returning id into v_sub_id;

  return query select v_sub_id, v_new_ends;
end
$function$;
