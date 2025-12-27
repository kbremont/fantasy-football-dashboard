-- Drop the unused draft_media table
-- Note: The draft-media storage bucket is still in use and is NOT being dropped

-- Drop the trigger
drop trigger if exists set_draft_media_updated_at on draft_media;

-- Drop the RLS policies
drop policy if exists "Allow public read access on draft_media" on draft_media;
drop policy if exists "Allow authenticated write access on draft_media" on draft_media;

-- Drop the index
drop index if exists idx_draft_media_year;

-- Drop the table
drop table if exists draft_media;
