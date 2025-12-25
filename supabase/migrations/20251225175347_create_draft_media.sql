-- Create draft_media table for tracking photos/videos from destination drafts
create table if not exists draft_media (
  id bigserial primary key,
  year integer not null,
  storage_path text not null,
  caption text,
  display_order integer default 0,
  media_type text default 'image' check (media_type in ('image', 'video')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index on year for efficient querying
create index if not exists idx_draft_media_year on draft_media(year);

-- Create unique constraint on storage_path
alter table draft_media add constraint draft_media_storage_path_unique unique (storage_path);

-- Enable RLS
alter table draft_media enable row level security;

-- Allow public read access (photos are public content)
create policy "Allow public read access on draft_media"
  on draft_media for select
  using (true);

-- Allow authenticated users and service role to insert/update/delete
create policy "Allow authenticated write access on draft_media"
  on draft_media for all
  using (auth.role() = 'authenticated' or auth.role() = 'service_role')
  with check (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- Create updated_at trigger
create trigger set_draft_media_updated_at
  before update on draft_media
  for each row
  execute function update_updated_at_column();

-- Create storage bucket for draft media
insert into storage.buckets (id, name, public)
values ('draft-media', 'draft-media', true)
on conflict (id) do nothing;

-- Allow public read access to draft-media bucket
create policy "Allow public read access on draft-media bucket"
  on storage.objects for select
  using (bucket_id = 'draft-media');

-- Allow authenticated users to upload to draft-media bucket
create policy "Allow authenticated upload to draft-media bucket"
  on storage.objects for insert
  with check (bucket_id = 'draft-media' and (auth.role() = 'authenticated' or auth.role() = 'service_role'));

-- Allow authenticated users to update/delete their uploads
create policy "Allow authenticated update on draft-media bucket"
  on storage.objects for update
  using (bucket_id = 'draft-media' and (auth.role() = 'authenticated' or auth.role() = 'service_role'));

create policy "Allow authenticated delete on draft-media bucket"
  on storage.objects for delete
  using (bucket_id = 'draft-media' and (auth.role() = 'authenticated' or auth.role() = 'service_role'));
