import { useEffect, useState } from 'react'
import type { Recipe } from './api'
import { askChef, getRecipes } from './api'
import './App.css'

function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [speakLang, setSpeakLang] = useState<'en' | 'hi'>('en')
  const [showHindi, setShowHindi] = useState(true)
  const [ingredientsExpanded, setIngredientsExpanded] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    getRecipes(controller.signal)
      .then((res) => setRecipes(res.recipes))
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    window.speechSynthesis.getVoices()
  }, [])

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return
    setLoading(true)
    setAnswer('')
    try {
      const res = await askChef(question)
      setAnswer(res.answer)
    } catch (err) {
      setAnswer('Error: Could not get answer from chef.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = speakLang === 'en' ? 'en-US' : 'hi-IN'
    utterance.rate = 0.9
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  const getHindiTranslation = (text: string): string => {
    const translations: { [key: string]: string } = {
      'ingredients': 'सामग्री',
      'method': 'विधि',
      'fresh produce': 'ताज़ी सब्जियाँ',
      'meat & seafood': 'मांस और समुद्री भोजन',
      'dairy & eggs': 'दूध और अंडे',
      'canned & jarred': 'डिब्बाबंद भोजन',
      'dry goods & grains': 'सूखा सामान और अनाज',
      'spices & seasonings': 'मसाले',
      'oils & condiments': 'तेल और मसालेदार सॉस',
    }
    return translations[text.toLowerCase()] || text
  }

  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      'Fresh Produce': '🥬',
      'Meat & Seafood': '🍗',
      'Dairy & Eggs': '🥛',
      'Canned & Jarred': '🥫',
      'Dry Goods & Grains': '🌾',
      'Spices & Seasonings': '🌶️',
      'Oils & Condiments': '🫒',
      'Other': '🛒',
    }
    return icons[category] || '📦'
  }

  const getStepEmoji = (stepTitle: string): string => {
    const lower = stepTitle.toLowerCase()
    if (lower.includes('heat') || lower.includes('warm') || lower.includes('cook') || lower.includes('fry') || lower.includes('pan')) return '🔥'
    if (lower.includes('add') || lower.includes('mix') || lower.includes('blend') || lower.includes('combine') || lower.includes('stir')) return '🥄'
    if (lower.includes('season') || lower.includes('salt') || lower.includes('spice')) return '🌶️'
    if (lower.includes('simmer') || lower.includes('boil') || lower.includes('steam')) return '💨'
    if (lower.includes('serve') || lower.includes('plate') || lower.includes('garnish')) return '🍽️'
    if (lower.includes('rest') || lower.includes('cool') || lower.includes('chill') || lower.includes('wait')) return '⏱️'
    return '👨‍🍳'
  }

  const groupIngredientsByCategory = (recipe: Recipe) => {
    const categories = [
      'Fresh Produce',
      'Meat & Seafood',
      'Dairy & Eggs',
      'Canned & Jarred',
      'Dry Goods & Grains',
      'Spices & Seasonings',
      'Oils & Condiments',
      'Other',
    ]
    const grouped: { [key: string]: string[] } = {}
    recipe.ingredients.forEach((ing) => {
      if (!grouped[ing.category]) {
        grouped[ing.category] = []
      }
      grouped[ing.category].push(ing.name)
    })
    return categories.filter((c) => grouped[c]).map((c) => [c, grouped[c]] as const)
  }

  if (selectedRecipe) {
    return (
      <div className="app full-screen-recipe">
        <header className="recipe-full-header">
          <button className="back-btn" onClick={() => setSelectedRecipe(null)}>← Back</button>
          <h1>{selectedRecipe.name}</h1>
          <div style={{ width: '60px' }}></div>
        </header>

        <main className="recipe-full-main">
          <div className="recipe-settings">
            <label>
              <input
                type="checkbox"
                checked={showHindi}
                onChange={(e) => setShowHindi(e.target.checked)}
              />
              Show Hindi 📚
            </label>
            <select value={speakLang} onChange={(e) => setSpeakLang(e.target.value as 'en' | 'hi')}>
              <option value="en">English (Indian) 🎤</option>
              <option value="hi">Hindi 🎤</option>
            </select>
          </div>

          {selectedRecipe.subtitle && <p className="subtitle">{selectedRecipe.subtitle}</p>}
          {selectedRecipe.blurb && <p className="blurb">{selectedRecipe.blurb}</p>}

          {selectedRecipe.ingredients.length > 0 && (
            <div className="section">
              <button
                className="section-toggle"
                onClick={() => setIngredientsExpanded(!ingredientsExpanded)}
              >
                <span className="toggle-arrow">{ingredientsExpanded ? '▼' : '▶'}</span>
                <div className="section-title-inline">
                  <h3>Ingredients</h3>
                  {showHindi && <h3 className="hindi">सामग्री</h3>}
                </div>
              </button>
              {ingredientsExpanded && <div className="ingredients-by-category">
                {groupIngredientsByCategory(selectedRecipe).map(([category, items], idx) => (
                  <div key={idx} className={`ingredient-category category-${idx % 2}`}>
                    <div className="category-header">
                      <span className="category-icon">{getCategoryIcon(category)}</span>
                      <div>
                        <h4>{category}</h4>
                        {showHindi && <h4 className="hindi">{getHindiTranslation(category)}</h4>}
                      </div>
                    </div>
                    <ul>
                      {items.map((ing, i) => (
                        <li key={i}>{ing}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>}
            </div>
          )}

          {selectedRecipe.phases.length > 0 && (
            <div className="section">
              <div className="section-title-inline">
                <h3>Method</h3>
                {showHindi && <h3 className="hindi">विधि</h3>}
              </div>
              {selectedRecipe.phases.map((phase, pi) => (
                <div key={pi} className="phase-container">
                  <h4 className="phase-label">{phase.label}</h4>
                  <div className="steps-grid">
                    {phase.steps.map((step, si) => (
                      <div key={si} className="step-card">
                        <div className="step-number-badge">{si + 1}</div>
                        <div className="step-emoji">{getStepEmoji(step.title)}</div>
                        <div className="step-content">
                          <h5>{step.title}</h5>
                          <div className="step-instructions">
                            {step.lines.map((line, li) => (
                              <div key={li}>{line}</div>
                            ))}
                          </div>
                          {step.badge && <div className="badge">{step.badge}</div>}
                          {step.tip && <div className="tip">💡 {step.tip}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedRecipe.finale && (
            <div className="finale">
              <p>{selectedRecipe.finale}</p>
            </div>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Kuch Khana</h1>
        {showHindi && <div className="hindi-subtitle">खाना</div>}
      </header>

      <main className="main">
        <div className="settings-bar">
          <label>
            <input
              type="checkbox"
              checked={showHindi}
              onChange={(e) => setShowHindi(e.target.checked)}
            />
            Show Hindi 📚
          </label>
        </div>

        <div className="chat-section">
          <div className="section-title">
            <h2>Ask the Chef</h2>
            {showHindi && <h2 className="hindi">शेफ से पूछें</h2>}
          </div>
          <form onSubmit={handleAsk}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about recipes..."
              disabled={loading || recipes.length === 0}
            />
            <button type="submit" disabled={loading || !question.trim() || recipes.length === 0}>
              {loading ? 'Thinking...' : 'Ask'}
            </button>
          </form>
          {answer && (
            <div className="answer">
              <h3>Answer</h3>
              <p>{answer}</p>
            </div>
          )}
          {recipes.length === 0 && (
            <div className="empty-state">
              <p>No recipes loaded. Upload a recipes document or link a Google Doc to get started.</p>
            </div>
          )}
        </div>

        {recipes.length > 0 && (
          <div className="recipes-section">
            <div className="section-title">
              <h2>Recipes ({recipes.length})</h2>
              {showHindi && <h2 className="hindi">रेसिपीज़</h2>}
            </div>
            <div className="recipes-grid">
              {recipes.map((recipe, index) => (
                <div
                  key={index}
                  className="recipe-card"
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  {recipe.art && (
                    <div className="recipe-image">
                      <img
                        src={`/${recipe.art}.svg`}
                        alt={recipe.name}
                        onError={(e) => {
                          console.warn(`Failed to load image: /${recipe.art}.svg`)
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  <h3>{recipe.name}</h3>
                  {showHindi && <h3 className="hindi" style={{ fontSize: '0.9em' }}>खाना</h3>}
                  {recipe.subtitle && <p className="subtitle">{recipe.subtitle}</p>}
                  {recipe.blurb && <p className="blurb">{recipe.blurb}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
