import { PostgrestSingleResponse, SupabaseClient } from '@supabase/supabase-js';
import { User } from 'src/auth/auth.types';
import { getSupabaseClient } from './supabaseClient';

class SupabaseUsers {
  private readonly client: SupabaseClient;
  private readonly tableName: string;

  constructor() {
    this.client = getSupabaseClient();
    this.tableName = 'insighta_labs_users_table';
  }

  createNewUser = async (user: User) => {
    const data = this.queryUsers<User>(
      await this.client
        .from(this.tableName)
        .upsert(user, { onConflict: 'github_id' })
        .select()
        .single(),
    );
    return data;
  };

  private queryUsers = <T>(result: PostgrestSingleResponse<T>) => {
    if (result.error) throw result.error;
    return result.data;
  };
}

export default SupabaseUsers;
