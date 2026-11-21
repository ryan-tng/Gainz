/**
 * Client-side mirror of the blocked-word / reserved-name checks in
 * supabase/moderation.sql, for instant feedback. The database is the real
 * enforcement — keep these lists in sync with it.
 */
const BLOCKED = [
  'fuck', 'fuk', 'shit', 'cunt', 'nigger', 'nigga', 'niga', 'faggot', 'fagot', 'bitch', 'whore',
  'slut', 'rapist', 'nazi', 'hitler', 'kike', 'chink', 'retard', 'tranny', 'porn', 'pussy',
  'penis', 'vagina', 'dildo', 'jizz', 'twat', 'wanker', 'molest', 'pedophile', 'paedo', 'incest',
  'kkk', 'heil', 'killyourself', 'kys_',
];

const RESERVED = new Set([
  'gainz', 'gainzapp', 'gainz_app', 'gainzofficial', 'gainz_official', 'official',
  'admin', 'administrator', 'support', 'help', 'staff', 'moderator', 'mod', 'team',
  'security', 'system', 'root', 'null', 'undefined', 'me', 'you',
]);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '$': 's', '8': 'b' };

function normalize(s: string): string {
  return s.toLowerCase().replace(/[0134578$]/g, (c) => LEET[c] ?? c);
}

export function containsBlockedWord(text: string): boolean {
  const n = normalize(text);
  return BLOCKED.some((w) => n.includes(w));
}

export function isUsernameAllowed(username: string): boolean {
  const u = username.trim().toLowerCase();
  return !RESERVED.has(u) && !containsBlockedWord(u);
}
