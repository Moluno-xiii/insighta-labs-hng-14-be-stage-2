import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { uuidv7 } from 'uuidv7';

type SeedRecord = {
  id?: string;
  name: string;
  gender: string;
  gender_probability: number;
  age: number;
  age_group: string;
  country_id: string;
  country_name?: string;
  country_probability: number;
  created_at?: string;
};

const BATCH_SIZE = 500;
const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
  return value;
};

const normalize = (item: Partial<SeedRecord>): SeedRecord | null => {
  const name = String(item.name ?? '')
    .trim()
    .toLowerCase();
  if (!name) return null;

  const country_id = String(item.country_id ?? '').toUpperCase();
  const country_name =
    item.country_name ?? (country_id ? REGION_NAMES.of(country_id) : undefined);

  return {
    id: item.id ?? uuidv7(),
    name,
    gender: String(item.gender ?? '').toLowerCase(),
    gender_probability: Number(item.gender_probability ?? 0),
    age: Number(item.age ?? 0),
    age_group: String(item.age_group ?? '').toLowerCase(),
    country_id,
    country_name: country_name ?? country_id,
    country_probability: Number(item.country_probability ?? 0),
    created_at: item.created_at ?? new Date().toISOString(),
  };
};

const findExistingNames = async (
  supabase: SupabaseClient,
  names: string[],
): Promise<Set<string>> => {
  const existing = new Set<string>();
  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('profiles')
      .select('name')
      .in('name', batch);
    if (error) throw error;
    for (const row of data ?? []) {
      if (typeof row.name === 'string') existing.add(row.name);
    }
  }
  return existing;
};

const main = async () => {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseKey = requireEnv('SUPABASE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const filePath = process.argv[2] ?? 'data/profiles.json';
  const absPath = resolve(filePath);
  console.log(`Reading seed data from ${absPath}`);

  const raw = readFileSync(absPath, 'utf8');
  const parsed = JSON.parse(raw);
  const items: Array<Partial<SeedRecord>> = Array.isArray(parsed)
    ? parsed
    : ((parsed.data ?? parsed.profiles) as Array<Partial<SeedRecord>>);

  if (!Array.isArray(items)) {
    console.error(
      'Seed file must be a JSON array or an object with "data"/"profiles" array',
    );
    process.exit(1);
  }

  const normalized = items
    .map(normalize)
    .filter((row): row is SeedRecord => row !== null);

  const byName = new Map<string, SeedRecord>();
  for (const row of normalized) byName.set(row.name, row);
  const unique = [...byName.values()];
  const intraFileDupes = normalized.length - unique.length;

  console.log(
    `Loaded ${items.length} raw records → ${normalized.length} valid → ${unique.length} unique (dropped ${intraFileDupes} in-file duplicates)`,
  );

  const existing = await findExistingNames(
    supabase,
    unique.map((r) => r.name),
  );
  const toInsert = unique.filter((r) => !existing.has(r.name));
  console.log(
    `Database already has ${existing.size} matching names. Inserting ${toInsert.length} new rows.`,
  );

  if (toInsert.length === 0) {
    console.log('Nothing to insert. Seed is up to date.');
    return;
  }

  let insertedTotal = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('profiles')
      .upsert(batch, { onConflict: 'name', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error);
      process.exit(1);
    }

    const count = data?.length ?? 0;
    insertedTotal += count;
    console.log(
      `Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${count} / attempted ${batch.length}`,
    );
  }

  console.log(
    `Seed complete. Inserted ${insertedTotal} new rows. Duplicates skipped.`,
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
