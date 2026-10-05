create extension if not exists pgcrypto;
create table if not exists public.categories(id uuid primary key default gen_random_uuid(),name text not null,icon text,description text,is_active boolean not null default true,sort_order integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.products(id uuid primary key default gen_random_uuid(),category_id uuid not null references public.categories(id) on delete cascade,name text not null,description text,price bigint not null default 0,size text,image_url text,is_active boolean not null default true,is_featured boolean not null default false,sort_order integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.categories enable row level security; alter table public.products enable row level security;
drop policy if exists "public active categories" on public.categories; create policy "public active categories" on public.categories for select to anon using (is_active=true);
drop policy if exists "authenticated all categories" on public.categories; create policy "authenticated all categories" on public.categories for all to authenticated using (true) with check (true);
drop policy if exists "public active products" on public.products; create policy "public active products" on public.products for select to anon using (is_active=true and exists(select 1 from public.categories c where c.id=category_id and c.is_active=true));
drop policy if exists "authenticated all products" on public.products; create policy "authenticated all products" on public.products for all to authenticated using (true) with check (true);
insert into public.categories(name,description,sort_order) select 'قهوه','نوشیدنی‌های قهوه',1 where not exists(select 1 from public.categories where name='قهوه');
insert into public.products(category_id,name,description,price,size,sort_order) select id,'اسپرسو دبل','قهوه تازه آسیاب‌شده',130000,'دبل',1 from public.categories where name='قهوه' and not exists(select 1 from public.products where name='اسپرسو دبل');
-- =========================
-- جدول تم‌ها (Themes)
-- =========================
create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'تم پیش‌فرض',
  primary_color text not null default '#6b4f3a',
  secondary_color text not null default '#f3eee7',
  background_color text not null default '#fffdf9',
  surface_color text not null default '#ffffff',
  text_color text not null default '#29251f',
  muted_text_color text not null default '#766f64',
  accent_color text not null default '#9a6b3f',
  font_family text default 'Tahoma, Arial, sans-serif',
  font_url text,
  font_regular_url text,
  font_medium_url text,
  font_semibold_url text,
  font_bold_url text,
  font_extrabold_url text,
  font_black_url text,
  border_radius integer not null default 10,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.themes enable row level security;

drop policy if exists "public active theme" on public.themes;
create policy "public active theme" on public.themes
  for select to anon using (is_active = true);

drop policy if exists "authenticated all themes" on public.themes;
create policy "authenticated all themes" on public.themes
  for all to authenticated using (true) with check (true);

-- فقط یک تم بتونه فعال باشه
create or replace function public.ensure_single_active_theme()
returns trigger as $$
begin
  if new.is_active = true then
    update public.themes set is_active = false where id <> new.id and is_active = true;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_single_active_theme on public.themes;
create trigger trg_single_active_theme
  after insert or update on public.themes
  for each row when (new.is_active = true)
  execute function public.ensure_single_active_theme();

-- تم پیش‌فرض (اگه وجود نداره)
insert into public.themes(name, is_active)
select 'تم پیش‌فرض کافه پارک', true
where not exists (select 1 from public.themes);