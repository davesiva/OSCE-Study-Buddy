# Medical Student Assistant

## Overview
A mobile-first web application for medical students to practice OSCE (Objective Structured Clinical Examination) patient interactions through AI-powered chat simulations.

## Tech Stack
- **Frontend**: React Native (Expo) - works in mobile browsers
- **Backend**: Express.js with TypeScript
- **AI**: OpenAI GPT-4o-mini for patient simulation
- **Data**: Local JSON files for cases, CSV for feedback

## Project Structure

```
/client                 # React Native frontend
  /screens
    HomeScreen.tsx      # Dashboard with navigation buttons
    OSCESimulatorScreen.tsx  # AI patient chat interface
    FeedbackScreen.tsx  # Feedback form
  /components           # Reusable UI components
  /navigation          # React Navigation setup
  /constants           # Theme and styling

/server                # Express.js backend
  index.ts             # Server setup
  routes.ts            # API endpoints

/cases                 # Patient case JSON files
  case_chest_pain.json
  case_abdominal_pain.json
```

## Features

### Home Screen
- Large, mobile-friendly navigation buttons
- Overview of app features

### OSCE Simulator
- Case selection dropdown
- Collapsible patient details with vital signs
- Real-time chat with AI patient
- Chat history persisted via AsyncStorage
- Singlish language support (configurable per case)

### Feedback
- Rating selector
- Text feedback form
- Saved to feedback.csv

## API Endpoints

- `GET /api/cases` - List all available cases
- `GET /api/cases/:caseId` - Get specific case details
- `POST /api/chat` - Send message to AI patient
- `POST /api/feedback` - Submit user feedback
- `GET /api/health` - Health check

## Case JSON Schema

```json
{
  "case_id": "unique_id",
  "patient_name": "Patient Name",
  "age": 55,
  "gender": "Male/Female",
  "chief_complaint": "Main complaint",
  "presenting_history": "Detailed history",
  "vitals": {
    "blood_pressure": "120/80 mmHg",
    "heart_rate": "72 bpm"
  },
  "past_medical_history": ["Condition 1", "Condition 2"],
  "social_history": "Social details",
  "allergies": "Allergy info",
  "script_instructions": "How AI should act",
  "secret_info": "Info revealed only when asked",
  "singlish_level": "low|moderate|high"
}
```

## Environment Variables
- `OPENAI_API_KEY` - Required for AI patient responses

## Running the App
- Backend runs on port 5000
- Frontend runs on port 8081
- Access via Expo web or scan QR code with Expo Go
