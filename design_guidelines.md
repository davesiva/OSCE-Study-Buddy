# Medical Student Assistant - Design Guidelines

## 1. Brand Identity

**Purpose**: Educational tool for medical students to practice OSCE (Objective Structured Clinical Examination) patient interactions via AI-powered chat simulation.

**Aesthetic Direction**: Clean, professional medical education aesthetic with approachable, student-friendly elements. Focus on clarity and functionality over decoration. The app should feel like a trusted study companion, not intimidating or clinical.

**Memorable Element**: The AI patient chatbot that adapts its language style (including Singlish variants) to provide realistic, culturally-relevant practice scenarios.

## 2. Navigation Architecture

**Root Navigation**: Streamlit's native hamburger menu (sidebar)

**Pages**:
1. **🏠 Home** - Dashboard with large navigation buttons
2. **🩺 OSCE Simulator** - AI chat interface for patient simulation
3. **💡 Feedback** - Simple form for user feedback

**Layout**: `layout="centered"` - optimized for vertical phone screens

## 3. Screen-by-Screen Specifications

### Home Screen (Dashboard)
- **Purpose**: Primary navigation hub for easy one-thumb access
- **Header**: Page title with emoji "🏠 Medical Student Assistant"
- **Layout**: 
  - Full-width, vertically stacked
  - Large, tappable navigation buttons (minimum 60px height)
  - Each button should span full container width
  - Generous vertical spacing between buttons (24px minimum)
- **Components**:
  - Welcome message/brief description
  - Three large primary action buttons:
    - "Start OSCE Practice" → OSCE Simulator
    - "Submit Feedback" → Feedback page
    - Optional: Quick stats or recent activity
- **Insets**: Standard Streamlit centered container padding

### OSCE Simulator Screen
- **Purpose**: Practice patient interactions via AI chat
- **Header**: 
  - Page title "🩺 OSCE Simulator"
  - Case selection dropdown (full-width)
- **Layout**:
  - Collapsible patient details section (using expander)
  - Scrollable chat history
  - Fixed bottom chat input
- **Components**:
  - **Case Selector**: Dropdown menu showing available cases
  - **Patient Details Expander**: Collapsible section titled "Show Patient Details" containing:
    - Patient name, age
    - Chief complaint
    - Vital signs
    - Relevant case context
  - **Chat Interface**:
    - Chat history container (scrollable)
    - Message bubbles (user and AI patient)
    - Bottom-anchored text input
- **State Management**: Chat history must persist during session
- **Insets**: Chat input sticks to bottom with safe area padding

### Feedback Screen
- **Purpose**: Collect user feedback
- **Header**: Page title "💡 Feedback"
- **Layout**: Simple vertical form
- **Components**:
  - Text area for feedback (multi-line)
  - Submit button (full-width, primary style)
  - Success/confirmation message after submission
- **Insets**: Standard form padding

## 4. Color Palette

**Medical Blue Palette** (trustworthy, professional):
- **Primary**: `#0066CC` (Medical Blue - buttons, headers)
- **Primary Hover**: `#0052A3` (Darker blue for interaction states)
- **Background**: `#FFFFFF` (Clean white)
- **Surface**: `#F5F7FA` (Light blue-gray for cards/expanders)
- **Text Primary**: `#1A1A1A` (Near-black for readability)
- **Text Secondary**: `#6B7280` (Gray for metadata)
- **Success**: `#10B981` (Green for confirmations)
- **Border**: `#E5E7EB` (Light gray for dividers)

## 5. Typography

**Font**: System default (Streamlit's default font stack for web readability)

**Type Scale**:
- **Page Titles**: Bold, 28px
- **Section Headers**: Semi-bold, 20px
- **Body Text**: Regular, 16px (minimum for mobile readability)
- **Button Text**: Medium, 16px
- **Chat Messages**: Regular, 15px
- **Metadata/Labels**: Regular, 14px, secondary color

## 6. Visual Design

- **Buttons**: 
  - Large touch targets (minimum 48px height)
  - Rounded corners (8px radius)
  - Clear labels with emojis for visual scanning
  - Sufficient padding (16px vertical, 24px horizontal)
- **Chat Bubbles**: 
  - Distinct styling for user vs AI messages
  - Adequate padding (12px)
  - Rounded corners (12px)
  - Clear timestamp/sender labels
- **Forms**: 
  - Full-width inputs
  - Clear labels above fields
  - Adequate spacing between fields (16px)
- **Spacing**: 
  - Between sections: 32px
  - Between elements: 16px
  - Within components: 8-12px

## 7. Assets to Generate

### Required Assets:
1. **app-icon.png** (512x512px)
   - Medical cross or stethoscope icon with graduation cap
   - Used in: Browser tab, mobile bookmark
   
2. **empty-chat.png** (400x300px)
   - Illustration of a friendly doctor/patient interaction or chat bubbles with medical symbols
   - Used in: OSCE Simulator when no case selected or chat is empty
   
3. **feedback-success.png** (300x200px)
   - Simple checkmark or thumbs up illustration
   - Used in: Feedback page after successful submission

### Style: 
- Simple line illustrations or flat icons
- Use primary blue color palette
- Friendly, approachable medical theme
- Avoid overly clinical or intimidating imagery

## 8. AI Chat Behavior

- Patient persona adapts based on JSON case data
- Language style adjusts according to `singlish_level` field (if present)
- Responses should be realistic but educationally appropriate
- Clear indication that this is AI simulation (display in UI)

## 9. Data Integration

- Cases loaded from JSON files in `cases/` folder
- Feedback saved to CSV for later review
- All data operations happen locally (no cloud storage required)