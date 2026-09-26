# Chef Agent

A full-stack recipe agent that extracts, translates, and answers questions about recipes using AI.

## Features

- 📖 Extract structured recipes from unformatted text
- 🌍 Translate recipes to Hindi
- 💬 Chat with the Chef Agent about recipes
- 🎨 Beautiful, responsive UI
- 📱 Works on mobile and desktop

## Architecture

- **Backend**: Python FastAPI + PydanticAI
- **Frontend**: React + Vite + TypeScript
- **AI Model**: OpenAI (via Portkey)

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the root directory with:
```
PORTKEY_API_KEY=your-key-here
RECIPES_GOOGLE_DOC_URL=optional-google-doc-url
```

Run the backend:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/recipes` - Get all loaded recipes
- `POST /api/extract` - Extract recipes from text
- `POST /api/translate` - Translate a recipe to Hindi
- `POST /api/chat` - Ask the Chef a question

## Deployment

Both backend and frontend can be deployed to Render:

### Backend
- Runtime: Python 3
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port 8000`

### Frontend
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment Variable: `VITE_API_URL=https://your-backend-url`

## Development

- Backend API docs available at `http://localhost:8000/docs`
- Frontend hot reload enabled during development
- TypeScript for type safety
