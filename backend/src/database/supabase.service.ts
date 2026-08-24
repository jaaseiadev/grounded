import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient<Database>;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceRoleKey) {
      throw new ServiceUnavailableException(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  unwrap<T>(
    result: { data: T | null; error: { message: string } | null },
    operation: string,
  ): T {
    if (result.error) {
      throw new ServiceUnavailableException(
        `${operation}: ${result.error.message}`,
      );
    }
    if (result.data === null) {
      throw new ServiceUnavailableException(`${operation}: no data returned`);
    }
    return result.data;
  }
}
