# OSCE Simulation

## Overview
A mobile-first web application for medical students to practice OSCE (Objective Structured Clinical Examination) patient interactions through AI-powered chat and voice simulations.

## Tech Stack
- **Frontend**: React Native (Expo) - works in mobile browsers
- **Backend**: Express.js with TypeScript
- **AI**: OpenAI GPT-4o-mini for chat, GPT-4o-realtime for voice conversations
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
  realtime.ts          # WebSocket relay for voice mode

/cases                 # Patient case JSON files
  case_chest_pain.json
  case_abdominal_pain.json
```

## Features

### Home Screen
- Large, mobile-friendly navigation buttons
- Overview of app features

### Create Custom Case
- Multi-step form to create patient cases
- Step 0: Choose creation method:
  - Start from Scratch: Manually enter all patient details
  - Import from Document: Upload EI/CI PDF or text file
  - Generate with AI: Select specialty and difficulty to auto-generate Singapore-focused case
- Step 1: Patient info (name, age, gender, complaint)
- Step 2: Vital signs
- Step 3: Medical history
- Step 4: AI acting instructions
- Step 5: Preview and save options
- Save locally (AsyncStorage) or upload to server
- Validation on each step

### AI Case Generator
- Specialties: Cardiology, Respiratory, GI, Neurology, Renal, Endocrine, MSK, O&G, Infectious Disease
- Difficulty levels:
  - Easy: Textbook presentations (classic symptoms, obvious diagnosis)
  - Medium: Atypical presentations (requires good clinical reasoning)
  - Challenging: Rare conditions or unusual presentations (diagnostic dilemmas)
- Singapore context: Local patient names, chronic disease patterns (DM, HTN, HLD), local conditions (dengue, TB), healthcare settings

### PDF Import Feature
- Import OSCE cases from EI (Examiner Instructions) or CI (Candidate Instructions) PDFs
- AI-powered extraction using OpenAI to parse document content
- Auto-fills form fields with extracted patient info, vitals, history, and acting instructions
- Users can review and edit AI-extracted data before saving
- Supports PDF and text file formats

### OSCE Simulator
- Case selection dropdown
- Collapsible patient details with vital signs
- Real-time chat with AI patient
- Voice Mode button for natural voice conversations
- Chat history persisted via AsyncStorage
- **Get Assessment** button to evaluate clerking performance after session

### Post-Session Assessment
- AI-powered evaluation of student's clerking performance
- Supports uploaded calibration/assessment guidelines (PDFs)
- Falls back to standard OSCE assessment criteria when no calibration is provided
- Assessment domains include: History Taking, Physical Examination, Problem Definition, Investigations, Management, Communication, and Professionalism
- Displays overall grade (Distinction/Pass/Borderline/Fail)
- Provides detailed feedback with strengths, areas for improvement, and missed opportunities

### Voice Mode (Web only)
- Real-time voice conversations with AI patient using OpenAI Realtime API
- Animated audio visualizer showing speech activity
- Patient avatar with speaking animation
- Live transcription of both student and patient speech
- Server VAD (Voice Activity Detection) for automatic turn-taking
- WebSocket relay architecture: Client -> Backend -> OpenAI Realtime API
- Audio format: PCM16 at 24kHz mono

### Feedback
- Rating selector
- Text feedback form
- Saved to feedback.csv

## API Endpoints

- `GET /api/cases` - List all available cases
- `GET /api/cases/:caseId` - Get specific case details
- `POST /api/cases` - Save a custom case (upload)
- `POST /api/parse-case` - Parse OSCE document content using AI
- `POST /api/parse-calibration` - Parse calibration/assessment document using AI
- `POST /api/assess` - Generate AI assessment based on conversation history
- `PATCH /api/cases/:caseId/criteria` - Update case with assessment criteria
- `POST /api/chat` - Send message to AI patient
- `POST /api/feedback` - Submit user feedback
- `GET /api/health` - Health check
- `WS /api/realtime` - WebSocket endpoint for voice mode (relays to OpenAI Realtime API)

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
  "assessment_criteria": "Optional: Custom assessment criteria from calibration document"
}
```

## Environment Variables
- `OPENAI_API_KEY` - Required for AI patient responses

## Running the App
- Backend runs on port 5000
- Frontend runs on port 8081
- Access via Expo web or scan QR code with Expo Go
