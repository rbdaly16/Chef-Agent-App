const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

async function fetchApi<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, signal })
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  return res.json()
}

export interface Ingredient {
  name: string
  category: string
}

export interface Step {
  number: number
  title: string
  lines: string[]
  badge: string
  tip: string
  chips: string[]
}

export interface Phase {
  label: string
  steps: Step[]
}

export interface Recipe {
  name: string
  subtitle: string
  art: string
  blurb: string
  ingredients: Ingredient[]
  phases: Phase[]
  finale: string
}

export interface RecipesResponse {
  count: number
  recipes: Recipe[]
}

export interface ExtractResponse {
  recipes: Recipe[]
}

export interface TranslateResponse {
  english: Recipe
  hindi: Recipe
}

export interface ChatResponse {
  answer: string
}

export function getRecipes(signal?: AbortSignal): Promise<RecipesResponse> {
  return fetchApi<RecipesResponse>('/api/recipes', undefined, signal)
}

export function extractRecipes(text: string, signal?: AbortSignal): Promise<ExtractResponse> {
  return fetchApi<ExtractResponse>(
    '/api/extract',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
    signal
  )
}

export function translateRecipe(recipe: Recipe, signal?: AbortSignal): Promise<TranslateResponse> {
  return fetchApi<TranslateResponse>(
    '/api/translate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe }),
    },
    signal
  )
}

export function askChef(question: string, signal?: AbortSignal): Promise<ChatResponse> {
  return fetchApi<ChatResponse>(
    '/api/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    },
    signal
  )
}
