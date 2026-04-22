-- Test accounts created in Supabase Auth.
-- Admin login:    admin@sole.local / Admin123!
-- Customer login: shopper@sole.local / Shopper123!
do $$
declare
  v_admin_id uuid := '77777777-7777-7777-7777-777777777771';
  v_customer_id uuid := '88888888-8888-8888-8888-888888888882';
begin
  if not exists (select 1 from auth.users where id = v_admin_id) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      'admin@sole.local',
      crypt('Admin123!', gen_salt('bf')),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"soleadmin"}'::jsonb,
      timezone('utc', now()),
      timezone('utc', now())
    );
  end if;

  if not exists (select 1 from auth.users where id = v_customer_id) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_customer_id,
      'authenticated',
      'authenticated',
      'shopper@sole.local',
      crypt('Shopper123!', gen_salt('bf')),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"jordanshopper"}'::jsonb,
      timezone('utc', now()),
      timezone('utc', now())
    );
  end if;

  if not exists (select 1 from auth.identities where user_id = v_admin_id and provider = 'email') then
    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      v_admin_id,
      v_admin_id,
      v_admin_id::text,
      jsonb_build_object(
        'sub', v_admin_id::text,
        'email', 'admin@sole.local',
        'email_verified', true
      ),
      'email',
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now())
    );
  end if;

  if not exists (select 1 from auth.identities where user_id = v_customer_id and provider = 'email') then
    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      v_customer_id,
      v_customer_id,
      v_customer_id::text,
      jsonb_build_object(
        'sub', v_customer_id::text,
        'email', 'shopper@sole.local',
        'email_verified', true
      ),
      'email',
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now())
    );
  end if;
end
$$;

insert into public.profiles (id, email, username)
values
  ('77777777-7777-7777-7777-777777777771', 'admin@sole.local', 'soleadmin'),
  ('88888888-8888-8888-8888-888888888882', 'shopper@sole.local', 'jordanshopper')
on conflict (id) do update
set
  email = excluded.email,
  username = excluded.username,
  updated_at = timezone('utc', now());

insert into public.user_roles (user_id, role)
values
  ('77777777-7777-7777-7777-777777777771', 'admin'),
  ('88888888-8888-8888-8888-888888888882', 'customer')
on conflict do nothing;

-- Products used by the storefront and admin product list.
insert into public.products (
  id,
  name,
  brand,
  price,
  original_price,
  image,
  category,
  description,
  stock,
  sizes,
  rating,
  reviews,
  is_new
)
values
  (
    '1',
    'Air Max 90',
    'Nike',
    130.00,
    160.00,
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop',
    'Lifestyle',
    'The Nike Air Max 90 stays true to its roots with the iconic Waffle outsole and stitched overlays.',
    18,
    array[7, 8, 8.5, 9, 10, 11, 12]::numeric[],
    4.7,
    342,
    true
  ),
  (
    '2',
    'Ultraboost 22',
    'Adidas',
    190.00,
    null,
    'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&h=600&fit=crop',
    'Running',
    'Experience incredible energy return with every stride in the Adidas Ultraboost 22.',
    14,
    array[7, 7.5, 8, 9, 9.5, 10, 11]::numeric[],
    4.8,
    518,
    false
  ),
  (
    '3',
    'RS-X Reinvention',
    'Puma',
    110.00,
    140.00,
    'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&h=600&fit=crop',
    'Lifestyle',
    'Bold design meets maximum comfort in the Puma RS-X Reinvention sneaker.',
    10,
    array[8, 8.5, 9, 10, 10.5, 11, 12]::numeric[],
    4.5,
    186,
    false
  ),
  (
    '4',
    'Fresh Foam 1080v12',
    'New Balance',
    160.00,
    null,
    'https://images.unsplash.com/photo-1539185441755-769473a23570?w=600&h=600&fit=crop',
    'Running',
    'Plush cushioning and a smooth ride make the 1080v12 perfect for daily training.',
    9,
    array[7, 8, 9, 9.5, 10, 11, 12, 13]::numeric[],
    4.9,
    421,
    true
  ),
  (
    '5',
    'Chuck Taylor All Star',
    'Converse',
    65.00,
    null,
    'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=600&h=600&fit=crop',
    'Lifestyle',
    'The iconic Chuck Taylor All Star. Timeless style that never goes out of fashion.',
    24,
    array[6, 7, 7.5, 8, 8.5, 9, 10, 11, 12]::numeric[],
    4.6,
    1203,
    false
  ),
  (
    '6',
    'LeBron XX',
    'Nike',
    200.00,
    null,
    'https://images.unsplash.com/photo-1597045566677-8cf032ed6634?w=600&h=600&fit=crop',
    'Basketball',
    'Engineered for explosive speed and power on the court. LeBron''s 20th signature shoe.',
    7,
    array[8, 9, 10, 10.5, 11, 12, 13]::numeric[],
    4.8,
    297,
    true
  ),
  (
    '7',
    'NMD R1',
    'Adidas',
    150.00,
    180.00,
    'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=600&h=600&fit=crop',
    'Lifestyle',
    'Street-ready style with Boost cushioning. The NMD R1 blends heritage with innovation.',
    12,
    array[7, 7.5, 8, 8.5, 9, 10, 11]::numeric[],
    4.6,
    645,
    false
  ),
  (
    '8',
    'Metcon 8',
    'Nike',
    130.00,
    null,
    'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600&h=600&fit=crop',
    'Training',
    'Built for the toughest workouts. Stable base for lifting, flexible sole for sprints.',
    16,
    array[7, 8, 8.5, 9, 9.5, 10, 11, 12]::numeric[],
    4.7,
    312,
    false
  )
on conflict (id) do update
set
  name = excluded.name,
  brand = excluded.brand,
  price = excluded.price,
  original_price = excluded.original_price,
  image = excluded.image,
  category = excluded.category,
  description = excluded.description,
  stock = excluded.stock,
  sizes = excluded.sizes,
  rating = excluded.rating,
  reviews = excluded.reviews,
  is_new = excluded.is_new,
  updated_at = timezone('utc', now());

-- Guest checkout examples used by the admin orders tab.
insert into public.orders (
  id,
  user_id,
  total,
  status,
  shipping_address,
  created_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '88888888-8888-8888-8888-888888888882',
    320.00,
    'processing',
    '{"fullName":"Jordan Miles","address":"25 Sneaker Ave","city":"New York","state":"NY","zip":"10001","country":"US"}'::jsonb,
    timezone('utc', now()) - interval '3 days'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '88888888-8888-8888-8888-888888888882',
    195.00,
    'pending',
    '{"fullName":"Avery Stone","address":"88 Court Street","city":"Chicago","state":"IL","zip":"60601","country":"US"}'::jsonb,
    timezone('utc', now()) - interval '1 day'
  )
on conflict (id) do update
set
  total = excluded.total,
  status = excluded.status,
  shipping_address = excluded.shipping_address,
  updated_at = timezone('utc', now());

insert into public.order_items (
  id,
  order_id,
  product_id,
  product_name,
  size,
  quantity,
  price
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '11111111-1111-1111-1111-111111111111',
    '2',
    'Ultraboost 22',
    9,
    1,
    190.00
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '11111111-1111-1111-1111-111111111111',
    '5',
    'Chuck Taylor All Star',
    10,
    2,
    65.00
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '22222222-2222-2222-2222-222222222222',
    '8',
    'Metcon 8',
    9.5,
    1,
    130.00
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    '22222222-2222-2222-2222-222222222222',
    '5',
    'Chuck Taylor All Star',
    8,
    1,
    65.00
  )
on conflict (id) do update
set
  order_id = excluded.order_id,
  product_id = excluded.product_id,
  product_name = excluded.product_name,
  size = excluded.size,
  quantity = excluded.quantity,
  price = excluded.price;

-- Message pipeline examples for the local integrity tables.
insert into public.message_logs (
  id,
  external_id,
  request_id,
  session_id,
  origin,
  source,
  role,
  content,
  response_text,
  metadata,
  received_at,
  processed_at
)
values
  (
    '33333333-3333-3333-3333-333333333331',
    'msg-local-001',
    '44444444-4444-4444-4444-444444444441',
    'session-demo-1',
    'ai-expert-widget',
    'local',
    'user',
    'Which running shoe is best for daily road training?',
    'Verified Expert Advice: The Fresh Foam 1080v12 is a strong daily trainer if you want plush cushioning and comfort.',
    '{"channel":"widget","topic":"running"}'::jsonb,
    timezone('utc', now()) - interval '6 hours',
    timezone('utc', now()) - interval '6 hours'
  ),
  (
    '33333333-3333-3333-3333-333333333332',
    'msg-local-002',
    '44444444-4444-4444-4444-444444444442',
    'session-demo-2',
    'admin-import',
    'local',
    'import',
    'Imported product feedback batch for review.',
    null,
    '{"channel":"batch","records":12}'::jsonb,
    timezone('utc', now()) - interval '2 hours',
    timezone('utc', now()) - interval '90 minutes'
  )
on conflict (id) do update
set
  external_id = excluded.external_id,
  request_id = excluded.request_id,
  session_id = excluded.session_id,
  origin = excluded.origin,
  source = excluded.source,
  role = excluded.role,
  content = excluded.content,
  response_text = excluded.response_text,
  metadata = excluded.metadata,
  received_at = excluded.received_at,
  processed_at = excluded.processed_at,
  updated_at = timezone('utc', now());

insert into public.classification_status (
  id,
  message_log_id,
  status,
  category,
  subcategory,
  confidence,
  classifier,
  review_notes,
  metadata,
  classified_at
)
values
  (
    '55555555-5555-5555-5555-555555555551',
    '33333333-3333-3333-3333-333333333331',
    'classified',
    'product-question',
    'running-shoes',
    0.96,
    'local-rule-engine',
    'Customer asked for a recommendation.',
    '{"priority":"normal"}'::jsonb,
    timezone('utc', now()) - interval '6 hours'
  ),
  (
    '55555555-5555-5555-5555-555555555552',
    '33333333-3333-3333-3333-333333333332',
    'reviewed',
    'feedback-import',
    'inventory',
    0.88,
    'local-import-worker',
    'Batch import reviewed and accepted.',
    '{"priority":"high"}'::jsonb,
    timezone('utc', now()) - interval '75 minutes'
  )
on conflict (id) do update
set
  message_log_id = excluded.message_log_id,
  status = excluded.status,
  category = excluded.category,
  subcategory = excluded.subcategory,
  confidence = excluded.confidence,
  classifier = excluded.classifier,
  review_notes = excluded.review_notes,
  metadata = excluded.metadata,
  classified_at = excluded.classified_at,
  updated_at = timezone('utc', now());

insert into public.user_preferences (
  id,
  user_id,
  subject_id,
  preference_key,
  preference_value,
  source,
  metadata
)
values
  (
    '66666666-6666-6666-6666-666666666661',
    '88888888-8888-8888-8888-888888888882',
    '88888888-8888-8888-8888-888888888882',
    'storefront.filters',
    '{"brands":["Nike"],"categories":["Lifestyle"],"sizes":[9,10],"priceRange":[0,220]}'::jsonb,
    'local',
    '{"seeded":true}'::jsonb
  ),
  (
    '66666666-6666-6666-6666-666666666662',
    '77777777-7777-7777-7777-777777777771',
    '77777777-7777-7777-7777-777777777771',
    'chat.widget',
    '{"open":false,"lastPrompt":"daily road training"}'::jsonb,
    'local',
    '{"seeded":true}'::jsonb
  )
on conflict (id) do update
set
  user_id = excluded.user_id,
  subject_id = excluded.subject_id,
  preference_key = excluded.preference_key,
  preference_value = excluded.preference_value,
  source = excluded.source,
  metadata = excluded.metadata,
  updated_at = timezone('utc', now());

-- If you create additional users through the app and want admin access:
-- insert into public.user_roles (user_id, role)
-- select id, 'admin'::public.app_role
-- from auth.users
-- where email = 'your-email@example.com'
-- on conflict do nothing;
