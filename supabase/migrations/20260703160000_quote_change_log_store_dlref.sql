-- Quote & Price-List Change Tracker — capture the delivery point (sub-account).
-- The Account field became a store lookup: the admin picks a delivery point from
-- the `stores` table. We store its name (in `account`) plus its delivery ref
-- (`store_dlref`, e.g. KM027/17) so a specific sub-account is identified, not just
-- the head customer. Free-text account entry is still allowed (store_dlref stays null).

alter table public.quote_change_log
  add column if not exists store_dlref text;

create index if not exists idx_qcl_store_dlref on public.quote_change_log (store_dlref);
