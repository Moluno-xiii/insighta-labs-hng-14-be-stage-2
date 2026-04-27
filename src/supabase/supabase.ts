import { getSupabaseClient } from './supabaseClient';
import { Profile } from 'src/profiles/profiles.types';
import { uuidv7 } from 'uuidv7';

type ListFilters = {
  gender?: string;
  country_id?: string;
  age_group?: string;
  min_age?: number;
  max_age?: number;
  min_gender_probability?: number;
  min_country_probability?: number;
  sort_by?: 'age' | 'created_at' | 'gender_probability';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

class Supabase {
  private tableName: string = 'profiles';

  async createProfile(profile: Omit<Profile, 'id'>): Promise<Profile> {
    const response = await getSupabaseClient()
      .from(this.tableName)
      .insert({
        ...profile,
        id: uuidv7(),
      })
      .select()
      .single();

    if (response.error) throw response.error;
    if (!response.data) throw new Error('No data returned from insert');
    return response.data as Profile;
  }

  async bulkUpsertProfiles(
    profiles: Array<Omit<Profile, 'id' | 'created_at'>>,
  ): Promise<number> {
    if (profiles.length === 0) return 0;

    const rows = profiles.map((p) => ({
      ...p,
      id: uuidv7(),
      created_at: new Date().toISOString(),
    }));

    const response = await getSupabaseClient()
      .from(this.tableName)
      .upsert(rows, { onConflict: 'name', ignoreDuplicates: true })
      .select('id');

    if (response.error) throw response.error;
    return response.data?.length ?? 0;
  }

  async getProfileByName(name: string): Promise<Profile | null> {
    const response = await getSupabaseClient()
      .from(this.tableName)
      .select('*')
      .eq('name', name)
      .single();

    if (response.error && response.error.code !== 'PGRST116')
      throw response.error;
    return response.data as Profile | null;
  }

  async getProfileById(id: string): Promise<Profile | null> {
    const response = await getSupabaseClient()
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (response.error && response.error.code !== 'PGRST116')
      throw response.error;
    return response.data as Profile | null;
  }

  async getAllProfiles(
    filters: ListFilters,
  ): Promise<{ data: Profile[]; total: number }> {
    let query = getSupabaseClient()
      .from(this.tableName)
      .select('*', { count: 'exact' });

    if (filters.gender) query = query.ilike('gender', filters.gender);
    if (filters.country_id)
      query = query.ilike('country_id', filters.country_id);
    if (filters.age_group) query = query.ilike('age_group', filters.age_group);
    if (filters.min_age !== undefined) query = query.gte('age', filters.min_age);
    if (filters.max_age !== undefined) query = query.lte('age', filters.max_age);
    if (filters.min_gender_probability !== undefined)
      query = query.gte('gender_probability', filters.min_gender_probability);
    if (filters.min_country_probability !== undefined)
      query = query.gte('country_probability', filters.min_country_probability);

    const sortBy = filters.sort_by ?? 'created_at';
    const ascending = (filters.order ?? 'desc') === 'asc';
    query = query.order(sortBy, { ascending });

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const response = await query;

    if (response.error) throw response.error;
    return {
      data: (response.data ?? []) as Profile[],
      total: response.count ?? 0,
    };
  }

  async deleteProfile(id: string): Promise<boolean> {
    const response = await getSupabaseClient()
      .from(this.tableName)
      .delete({ count: 'exact' })
      .eq('id', id);

    if (response.error) throw response.error;
    return (response.count ?? 0) > 0;
  }
}

export default Supabase;
export type { ListFilters };
