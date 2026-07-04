import { API_BASE_URL } from './config';
import type { FoodAnalysis } from './types';

/** Send a base64 image to the backend and get an AI nutrition estimate. */
export async function analyzeFood(
  imageBase64: string,
  mimeType: string,
): Promise<FoodAnalysis> {
  const res = await fetch(`${API_BASE_URL}/api/analyze-food`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<FoodAnalysis> & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || 'Could not analyze the photo. Please try again.');
  }
  return data as FoodAnalysis;
}
