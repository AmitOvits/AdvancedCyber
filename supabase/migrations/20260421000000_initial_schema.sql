-- Primary SQL source of truth for app schema changes.
-- Auth-supporting objects for the app belong here:
-- `public.profiles`, `public.user_roles`, `public.handle_new_user()`, and `public.has_role(...)`.
-- If you keep `supabase/schema.sql`, treat it as a synchronized mirror of this migration.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  request_id uuid,
  session_id text,
  origin text not null,
  source text not null default 'local',
  role text not null default 'user',
  content text not null,
  response_text text,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint message_logs_origin_nonempty check (char_length(btrim(origin)) > 0),
  constraint message_logs_content_nonempty check (char_length(btrim(content)) > 0),
  constraint message_logs_role_check check (role in ('user', 'ai', 'system', 'import'))
);

create index if not exists idx_message_logs_origin on public.message_logs (origin);
create index if not exists idx_message_logs_request_id on public.message_logs (request_id);
create index if not exists idx_message_logs_received_at on public.message_logs (received_at desc);
create index if not exists idx_message_logs_processed_at on public.message_logs (processed_at desc);

create table if not exists public.classification_status (
  id uuid primary key default gen_random_uuid(),
  message_log_id uuid not null unique references public.message_logs(id) on delete cascade,
  status text not null default 'pending',
  category text,
  subcategory text,
  confidence numeric(5,4),
  classifier text,
  review_notes text,
  metadata jsonb not null default '{}'::jsonb,
  classified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint classification_status_status_check check (
    status in ('pending', 'classified', 'reviewed', 'failed', 'archived')
  ),
  constraint classification_status_confidence_check check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create index if not exists idx_classification_status_status on public.classification_status (status);
create index if not exists idx_classification_status_category on public.classification_status (category);
create index if not exists idx_classification_status_classified_at on public.classification_status (classified_at desc);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subject_id text not null default 'local',
  preference_key text not null,
  preference_value jsonb not null default '{}'::jsonb,
  source text not null default 'local',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_preferences_subject_preference_key_key unique (subject_id, preference_key),
  constraint user_preferences_key_nonempty check (char_length(btrim(preference_key)) > 0)
);

create index if not exists idx_user_preferences_user_id on public.user_preferences (user_id);
create index if not exists idx_user_preferences_source on public.user_preferences (source);

drop trigger if exists handle_message_logs_updated_at on public.message_logs;
create trigger handle_message_logs_updated_at
before update on public.message_logs
for each row
execute function public.set_updated_at();

drop trigger if exists handle_classification_status_updated_at on public.classification_status;
create trigger handle_classification_status_updated_at
before update on public.classification_status
for each row
execute function public.set_updated_at();

drop trigger if exists handle_user_preferences_updated_at on public.user_preferences;
create trigger handle_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

do $$
begin
  create type public.app_role as enum ('admin', 'customer');
exception
  when duplicate_object then null;
end
$$;

-- App auth support lives in the public schema. Supabase Auth owns password storage in `auth.users`.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  username text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_email_nonempty check (char_length(btrim(email)) > 0),
  constraint profiles_username_nonempty check (char_length(btrim(username)) > 0)
);

create index if not exists idx_profiles_email on public.profiles (email);
create index if not exists idx_profiles_username on public.profiles (username);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      concat(split_part(coalesce(new.email, new.id::text), '@', 1), '-', left(new.id::text, 8))
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = timezone('utc', now());

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role::text = _role
  );
$$;

create table if not exists public.products (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  brand text not null,
  price numeric(10, 2) not null,
  original_price numeric(10, 2),
  image text not null,
  category text not null,
  description text,
  stock integer not null default 0,
  sizes numeric[] not null default '{}',
  rating numeric(3, 2) not null default 0,
  reviews integer not null default 0,
  is_new boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint products_name_nonempty check (char_length(btrim(name)) > 0),
  constraint products_brand_nonempty check (char_length(btrim(brand)) > 0),
  constraint products_category_nonempty check (char_length(btrim(category)) > 0),
  constraint products_image_nonempty check (char_length(btrim(image)) > 0),
  constraint products_price_check check (price >= 0),
  constraint products_original_price_check check (original_price is null or original_price >= 0),
  constraint products_stock_check check (stock >= 0),
  constraint products_rating_check check (rating >= 0 and rating <= 5),
  constraint products_reviews_check check (reviews >= 0)
);

create index if not exists idx_products_brand on public.products (brand);
create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_created_at on public.products (created_at desc);

create table if not exists public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  rating numeric(2, 1) not null default 5,
  title text not null,
  body text not null,
  is_featured boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint store_reviews_author_name_nonempty check (char_length(btrim(author_name)) > 0),
  constraint store_reviews_title_nonempty check (char_length(btrim(title)) > 0),
  constraint store_reviews_body_nonempty check (char_length(btrim(body)) > 0),
  constraint store_reviews_rating_check check (rating >= 1 and rating <= 5)
);

create index if not exists idx_store_reviews_created_at on public.store_reviews (created_at desc);
create index if not exists idx_store_reviews_featured on public.store_reviews (is_featured, created_at desc);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  total numeric(10, 2) not null,
  status text not null default 'pending',
  shipping_address jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint orders_total_check check (total >= 0),
  constraint orders_status_check check (
    status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')
  )
);

create index if not exists idx_orders_user_id on public.orders (user_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_created_at on public.orders (created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  size numeric(4, 1) not null,
  quantity integer not null,
  price numeric(10, 2) not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint order_items_product_name_nonempty check (char_length(btrim(product_name)) > 0),
  constraint order_items_quantity_check check (quantity > 0),
  constraint order_items_price_check check (price >= 0)
);

create index if not exists idx_order_items_order_id on public.order_items (order_id);
create index if not exists idx_order_items_product_id on public.order_items (product_id);

drop trigger if exists handle_profiles_updated_at on public.profiles;
create trigger handle_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists handle_products_updated_at on public.products;
create trigger handle_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

drop trigger if exists handle_store_reviews_updated_at on public.store_reviews;
create trigger handle_store_reviews_updated_at
before update on public.store_reviews
for each row
execute function public.set_updated_at();

drop trigger if exists handle_orders_updated_at on public.orders;
create trigger handle_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

create or replace function public.get_profile_by_username_insecure(_username text)
returns setof public.profiles
language plpgsql
security definer
as $$
begin
  return query execute 'select * from public.profiles where username = ''' || _username || '''';
end;
$$;