import { useEffect, useState } from 'react'
import { askChef, getRecipes, Recipe } from './api'
import './App.css'

function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getRecipes(controller.signal)
      .then((res) => setRecipes(res.recipes))
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err)
      })
    return () => controller.abort()
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

  return (
    <div className="app">
      <header className="header">
        <h1>🍳 Chef Agent</h1>
        <p>Extract, translate, and chat about recipes</p>
      </header>

      <main className="main">
        <div className="chat-section">
          <h2>Ask the Chef</h2>
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
            <h2>Recipes ({recipes.length})</h2>
            <div className="recipes-grid">
              {recipes.map((recipe, index) => (
                <div
                  key={index}
                  className={`recipe-card ${selectedRecipe === recipe ? 'selected' : ''}`}
                  onClick={() => setSelectedRecipe(selectedRecipe === recipe ? null : recipe)}
                >
                  <h3>{recipe.name}</h3>
                  {recipe.subtitle && <p className="subtitle">{recipe.subtitle}</p>}
                  {recipe.blurb && <p className="blurb">{recipe.blurb}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedRecipe && (
          <div className="recipe-detail">
            <div className="recipe-header">
              <h2>{selectedRecipe.name}</h2>
              <button onClick={() => setSelectedRecipe(null)}>Close</button>
            </div>
            {selectedRecipe.subtitle && <p className="subtitle">{selectedRecipe.subtitle}</p>}
            {selectedRecipe.blurb && <p className="blurb">{selectedRecipe.blurb}</p>}

            {selectedRecipe.ingredients.length > 0 && (
              <div className="section">
                <h3>Ingredients</h3>
                <ul>
                  {selectedRecipe.ingredients.map((ing, i) => (
                    <li key={i}>
                      {ing.name} <span className="category">({ing.category})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedRecipe.phases.length > 0 && (
              <div className="section">
                <h3>Method</h3>
                {selectedRecipe.phases.map((phase, pi) => (
                  <div key={pi}>
                    <h4>{phase.label}</h4>
                    <ol>
                      {phase.steps.map((step, si) => (
                        <li key={si}>
                          <strong>{step.title}</strong>
                          {step.lines.map((line, li) => (
                            <div key={li}>{line}</div>
                          ))}
                          {step.badge && <div className="badge">{step.badge}</div>}
                          {step.tip && <div className="tip">💡 {step.tip}</div>}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}

            {selectedRecipe.finale && (
              <div className="finale">
                <p>{selectedRecipe.finale}</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
