# Supabase setup

Run migrations with the Supabase CLI (`supabase db push`) or paste the SQL migration into the Supabase SQL editor. The migration enables `pgvector`, creates the private `documents` Storage bucket, applies indexes, and prevents browser roles from reading application data. Grounded's NestJS backend uses the service role key; the Angular client never connects to the database directly.

The vector column is 1,536 dimensions and matches the default `text-embedding-3-small` model.
