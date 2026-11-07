create or replace function public.reserve_membership_redemption(
  p_member_id uuid,
  p_max_daily integer,
  p_max_total integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day_start timestamptz;
  v_daily integer;
  v_total integer;
  v_id uuid;
begin
  if p_member_id is null then
    return null;
  end if;

  perform 1 from public.organization_members
   where id = p_member_id
   for update;
  if not found then
    return null;
  end if;

  v_day_start := date_trunc('day', now() at time zone 'Asia/Tehran') at time zone 'Asia/Tehran';

  select count(*) filter (where created_at >= v_day_start), count(*)
    into v_daily, v_total
    from public.redemption_logs
   where member_id = p_member_id;

  if v_daily >= p_max_daily or v_total >= p_max_total then
    return null;
  end if;

  insert into public.redemption_logs (member_id)
  values (p_member_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.reserve_membership_redemption(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_membership_redemption(uuid, integer, integer) to service_role;
