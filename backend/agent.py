"""PydanticAI chef agent backed by recipes loaded from a Word document."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT.parent / ".env")


# Fixed category set, in the order a shopper walks a store. The extractor is constrained
# to these so the same ingredient lands in the same group across every recipe.
CATEGORIES = [
    "Fresh Produce",
    "Meat & Seafood",
    "Dairy & Eggs",
    "Canned & Jarred",
    "Dry Goods & Grains",
    "Spices & Seasonings",
    "Oils & Condiments",
    "Other",
]

Category = Literal[
    "Fresh Produce",
    "Meat & Seafood",
    "Dairy & Eggs",
    "Canned & Jarred",
    "Dry Goods & Grains",
    "Spices & Seasonings",
    "Oils & Condiments",
    "Other",
]


class Ingredient(BaseModel):
    name: str
    category: Category = "Other"


# Each value is a filename in assets/art/. The extractor picks the closest match so every
# recipe gets an illustration without needing per-dish artwork.
Art = Literal[
    "curry-bowl",
    "chickpeas",
    "chicken",
    "flatbread",
    "eggplant",
    "fried-balls",
    "pasta-bake",
    "potato",
    "greens",
    "stuffed-bun",
    "taro-curry",
    "rice-bowl",
    "soup",
    "dumplings",
    "pot",
]


class Step(BaseModel):
    number: int = 0
    title: str = ""
    lines: list[str] = Field(default_factory=list)
    badge: str = ""
    tip: str = ""
    chips: list[str] = Field(default_factory=list)


class Phase(BaseModel):
    label: str = ""
    steps: list[Step] = Field(default_factory=list)


class Recipe(BaseModel):
    name: str
    subtitle: str = ""
    art: Art = "pot"
    blurb: str = ""
    ingredients: list[Ingredient] = Field(default_factory=list)
    phases: list[Phase] = Field(default_factory=list)
    finale: str = ""

    def ingredients_by_category(self) -> list[tuple[str, list[str]]]:
        """Ingredients grouped into shopping categories, in CATEGORIES order."""
        grouped: dict[str, list[str]] = {}
        for item in self.ingredients:
            grouped.setdefault(item.category, []).append(item.name)
        return [(c, grouped[c]) for c in CATEGORIES if c in grouped]

    @property
    def steps(self) -> list[str]:
        """Flat step text, for the chef Q&A and any caller that wants a simple list."""
        return [
            f"{step.title}: {' '.join(step.lines)}".strip(": ")
            for phase in self.phases
            for step in phase.steps
        ]


class RecipeBook(BaseModel):
    recipes: list[Recipe] = Field(default_factory=list)


class ChefReply(BaseModel):
    answer: str


def _model() -> OpenAIResponsesModel:
    key = os.environ.get("PORTKEY_API_KEY")
    if not key:
        raise RuntimeError("PORTKEY_API_KEY is missing from the project root .env file.")
    client = AsyncOpenAI(
        api_key=key,
        base_url="https://api.portkey.ai/v1",
        default_headers={"x-portkey-api-key": key, "x-portkey-provider": "openai"},
    )
    return OpenAIResponsesModel("gpt5.6-luna", provider=OpenAIProvider(openai_client=client))


def _build_agent() -> Agent[None, ChefReply]:
    prompt = (HERE.parent / "prompts" / "chef_agent.md").read_text(encoding="utf-8")
    return Agent(_model(), output_type=ChefReply, system_prompt=prompt)


EXTRACT_PROMPT = """You read recipe documents and turn them into structured data.

The document may be formatted in any way at all: headings, bullet lists, numbered lists,
tables flattened into lines, or plain prose paragraphs with no headings whatsoever. Do not
expect labels like "Ingredients" or "Steps" to be present.

You are building a visual recipe card, so the output needs to be broken into sections that
read well at a glance in a kitchen.

For each distinct recipe in the document:
- name: the dish's name. If it is never stated outright, write a short descriptive name.
- subtitle: a short one-line descriptor, e.g. "Also works for Black-eyed Peas · Soak ·
  Pressure Cook · Enjoy". Build it from the recipe's own notes and major stages. Keep it
  under about 90 characters. Empty string if there is nothing meaningful to say.
- blurb: one short, warm sentence describing the dish for a browsing card, under about
  100 characters. Describe what it actually is, e.g. "Soft chickpeas simmered in a spiced
  tomato masala."
- art: pick the illustration that best matches the finished dish, from exactly:
  "curry-bowl" (saucy curries and stews), "chickpeas" (chickpea or bean dishes),
  "chicken" (chicken and other meat dishes), "flatbread" (roti, naan, breads),
  "eggplant" (eggplant/aubergine dishes), "fried-balls" (loose fritters, koftas, pakoras),
  "pasta-bake" (pasta and baked cheesy dishes), "potato" (potato-forward dishes),
  "greens" (salads and leafy vegetable dishes), "stuffed-bun" (anything served in a pav,
  bun or sandwich), "taro-curry" (arvi/taro or root-vegetable dishes in a yogurt or pale
  curry), "rice-bowl" (rice and biryani dishes), "soup" (brothy soups), "dumplings"
  (momos, steamed or boiled dumplings), or "pot" when nothing else fits.
  Prefer the most specific match, and try to give different dishes different art.
- ingredients: one entry per ingredient. Each has:
  - name: the ingredient with its quantity and unit as written (e.g. "2 cups all-purpose
    flour"). If ingredients are only mentioned inside prose instructions, pull them out
    into this list anyway.
  - category: which aisle it belongs to, so a shopper can group their list. Use exactly
    one of: "Fresh Produce" (vegetables, fruit, fresh herbs, fresh chilies, ginger,
    garlic), "Meat & Seafood", "Dairy & Eggs" (milk, yogurt/dahi, butter, ghee, cheese,
    paneer, cream), "Canned & Jarred" (canned tomatoes, coconut milk, tinned beans,
    pastes), "Dry Goods & Grains" (flour, rice, pasta, lentils, dried beans, nuts, sugar),
    "Spices & Seasonings" (ground and whole spices, salt, dried herbs, baking soda,
    nutritional yeast), "Oils & Condiments" (cooking oils, vinegar, sauces), or "Other"
    when nothing else fits. Judge by what the ingredient actually is: dried chickpeas are
    "Dry Goods & Grains" while a tin of chickpeas is "Canned & Jarred".
- phases: group the method into 1-3 named stages that reflect how the cook actually works,
  e.g. "Prepare the chana" then "Cook the masala". Use a single phase named "Method" when
  the recipe is short or does not split naturally. Each phase has:
  - label: the stage name.
  - steps: the ordered steps in that stage. Step numbering runs continuously across ALL
    phases (phase one ends at step 2, phase two starts at step 3), never restarting.
- finale: a short celebratory closing line for the last step, e.g. "Scatter fresh coriander
  generously over the finished dish." Empty string if nothing fits.

Each step has:
- number: its position in the continuous sequence, starting at 1.
- title: 2-4 words naming the action, e.g. "Soak", "Saute onions", "Add tomatoes".
- lines: the instruction as 1-4 short sentences, one per entry. Keep each line brief enough
  to read in a glance; split a long instruction across lines rather than writing a paragraph.
- badge: a short timing or doneness cue pulled from the step, e.g. "min 6 hours",
  "golden brown", "HIGH x6 → LOW 10 min". Under 30 characters. Empty string if the step
  has no such cue. Do not invent times the document does not give.
- tip: an aside or warning the document makes about this step, e.g. "Save the cooking water
  for the masala!". Empty string if there is none.
- chips: the few key ingredients this step adds, as bare names without quantities
  (e.g. ["jira", "dhunya", "amchur"]). At most 5. Empty list if the step adds nothing new.

Preserve the document's own wording where you reasonably can, including regional ingredient
names. Do not invent ingredients, quantities, times, or steps that the document does not
support. If the document contains no recipes at all, return an empty list."""


def _build_extractor() -> Agent[None, RecipeBook]:
    return Agent(_model(), output_type=RecipeBook, system_prompt=EXTRACT_PROMPT)


_agent: Agent[None, ChefReply] | None = None
_extractor: Agent[None, RecipeBook] | None = None


def extract_recipes(raw_text: str) -> list[Recipe]:
    """Use the model to pull structured recipes out of arbitrarily formatted document text."""
    global _extractor
    if not raw_text.strip():
        return []
    if _extractor is None:
        _extractor = _build_extractor()
    result = _extractor.run_sync(f"Recipe document:\n\n{raw_text}")
    return result.output.recipes


TRANSLATE_PROMPT = """You translate a structured recipe from English into Hindi for a
learner who is reading both languages side by side.

Return the SAME structure you are given, with every human-readable string translated into
natural Hindi written in Devanagari script. Specifically:

- Translate: name, subtitle, blurb, finale, each phase label, each step title, each line in
  a step's lines, each badge, each tip, each chip, and each ingredient name.
- Keep the structure identical: the same number of ingredients in the same order, the same
  number of phases, the same number of steps in each phase, the same number of lines and
  chips in each step. Never merge, split, drop, or reorder entries. This alignment is what
  lets the learner match each Hindi line to its English one.
- Copy these fields through UNCHANGED, do not translate them: art, each ingredient's
  category, and each step's number.

Translation guidance:
- Write the way an Indian home cook actually speaks, not stiff textbook Hindi.
- Ingredient and technique words that Hindi speakers already use in their own language
  should appear in Devanagari: jira becomes जीरा, dhunya becomes धनिया, amchur becomes
  अमचूर, chana becomes चना, atha becomes आटा, dahi becomes दही, pav becomes पाव.
- Keep numbers, quantities and units intact, converting the unit word where it is natural
  ("2 cups" becomes "2 कप", "1 Tsp" becomes "1 छोटा चम्मच").
- English words with no common Hindi equivalent may stay, transliterated into Devanagari."""


def _build_translator() -> Agent[None, Recipe]:
    return Agent(_model(), output_type=Recipe, system_prompt=TRANSLATE_PROMPT)


_translator: Agent[None, Recipe] | None = None


def translate_recipe(recipe: Recipe) -> Recipe:
    """Return a Hindi mirror of the recipe with the same structure."""
    global _translator
    if _translator is None:
        _translator = _build_translator()
    payload = json.dumps(recipe.model_dump(), ensure_ascii=False)
    result = _translator.run_sync(f"Translate this recipe into Hindi:\n\n{payload}")
    return align(recipe, result.output)


def align(english: Recipe, hindi: Recipe) -> Recipe:
    """Force the Hindi copy onto the English structure, falling back where it drifted.

    The model occasionally returns a different number of lines or steps. Rather than let
    that misalign the side-by-side display, rebuild the Hindi recipe against the English
    shape and reuse the English string wherever a translation is missing.
    """

    def pick(translated: str, original: str) -> str:
        return translated.strip() if translated and translated.strip() else original

    def pick_list(translated: list[str], original: list[str]) -> list[str]:
        if len(translated) != len(original):
            return original
        return [pick(t, o) for t, o in zip(translated, original)]

    ingredients = []
    for index, item in enumerate(english.ingredients):
        other = hindi.ingredients[index] if index < len(hindi.ingredients) else None
        ingredients.append(Ingredient(
            name=pick(other.name if other else "", item.name),
            category=item.category,
        ))

    phases = []
    for p_index, phase in enumerate(english.phases):
        other_phase = hindi.phases[p_index] if p_index < len(hindi.phases) else None
        steps = []
        for s_index, step in enumerate(phase.steps):
            other = (
                other_phase.steps[s_index]
                if other_phase and s_index < len(other_phase.steps)
                else None
            )
            steps.append(Step(
                number=step.number,
                title=pick(other.title if other else "", step.title),
                lines=pick_list(other.lines if other else [], step.lines),
                badge=pick(other.badge if other else "", step.badge),
                tip=pick(other.tip if other else "", step.tip),
                chips=pick_list(other.chips if other else [], step.chips),
            ))
        phases.append(Phase(
            label=pick(other_phase.label if other_phase else "", phase.label),
            steps=steps,
        ))

    return Recipe(
        name=pick(hindi.name, english.name),
        subtitle=pick(hindi.subtitle, english.subtitle),
        art=english.art,
        blurb=pick(hindi.blurb, english.blurb),
        ingredients=ingredients,
        phases=phases,
        finale=pick(hindi.finale, english.finale),
    )


def ask_chef(question: str, recipes: list[Recipe]) -> str:
    global _agent
    if _agent is None:
        _agent = _build_agent()
    context = json.dumps([recipe.model_dump() for recipe in recipes], ensure_ascii=False)
    result = _agent.run_sync(f"Recipes available:\n{context}\n\nUser question: {question}")
    return result.output.answer
