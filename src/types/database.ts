/**
 * Supabase database types.
 *
 * PLACEHOLDER — regenerate the real types from the running database with:
 *
 *   supabase gen types typescript --local > src/types/database.ts
 *   # or against the hosted project:
 *   supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * This minimal stub lets the Supabase clients type-check before generation.
 * Do NOT hand-maintain the full shape here; the generated file replaces it.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: {
      place_bid: {
        Args: { p_auction_id: string; p_bid_amount: number };
        Returns: Json;
      };
      configure_auto_bid: {
        Args: { p_auction_id: string; p_max_amount: number };
        Returns: Json;
      };
      disable_auto_bid: { Args: { p_auction_id: string }; Returns: undefined };
    };
    Enums: Record<string, string>;
  };
}
