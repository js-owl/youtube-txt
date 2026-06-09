/**
 * Тип строки таблицы `public.profiles`.
 * Хранится вручную (без supabase gen types), чтобы не зависеть от codegen.
 */
export type Profile = {
  id: string;
  email: string;
  credits: number;
  created_at: string;
  updated_at: string;
};
