// Single source of truth: the runnable SQL lives in supabase/schema.sql
// and is inlined at build time by Vite (?raw import).
import schemaSql from '../../supabase/schema.sql?raw';

export const SUPABASE_SQL_SCHEMA: string = schemaSql;
