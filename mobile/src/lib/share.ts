import { supabase } from './supabase';
import type { TemplateExercise, WorkoutTemplate } from './types';

/** The shareable part of a template (no ids/timestamps — the importer makes new ones). */
export interface SharedTemplate {
  name: string;
  icon: string;
  color: string;
  exercises: TemplateExercise[];
}

// Unambiguous alphabet (no 0/O, 1/I) for easy-to-type codes.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/** Publish a template and return a short share code. */
export async function shareTemplate(t: WorkoutTemplate): Promise<string> {
  if (!supabase) throw new Error('Sign in to share workouts.');
  const template: SharedTemplate = {
    name: t.name,
    icon: t.icon,
    color: t.color,
    exercises: t.exercises,
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const { error } = await supabase.from('shared_templates').insert({ code, template });
    if (!error) return code;
    if (error.code !== '23505') throw new Error(error.message); // 23505 = duplicate code, retry
  }
  throw new Error('Could not create a share code. Please try again.');
}

/** Look up a shared template by its code. Returns null if not found. */
export async function fetchSharedTemplate(code: string): Promise<SharedTemplate | null> {
  if (!supabase) throw new Error('Sign in to import workouts.');
  const { data, error } = await supabase
    .from('shared_templates')
    .select('template')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.template as SharedTemplate) ?? null;
}
