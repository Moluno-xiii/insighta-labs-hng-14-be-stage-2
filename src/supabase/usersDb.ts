import { PostgrestSingleResponse, SupabaseClient } from '@supabase/supabase-js';
import { User } from 'src/auth/auth.types';
import { getSupabaseClient } from './supabaseClient';
import { HttpException } from '@nestjs/common';

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

  getUserById = async (userId: string) => {
    const data = this.queryUsers<User>(
      await this.client.from(this.tableName).select().eq('id', userId).single(),
    );
    return data;
  };

  private queryUsers = <T>(result: PostgrestSingleResponse<T>) => {
    if (result.error) throw new HttpException(result.error.message, 500);
    return result.data;
  };
}

export default SupabaseUsers;
