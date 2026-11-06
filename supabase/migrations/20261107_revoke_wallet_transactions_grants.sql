-- Close direct anon/authenticated access to the wallet ledger
revoke all on table public.wallet_transactions from anon, authenticated;
