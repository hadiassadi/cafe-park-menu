-- Close direct anon/authenticated access to refund tables
revoke all on table public.order_refunds from anon, authenticated;
revoke all on table public.order_restores from anon, authenticated;
