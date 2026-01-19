import streamlit as st
import json
import os
import csv
from datetime import datetime
from openai import OpenAI

# Page configuration - MUST be first Streamlit command
st.set_page_config(
    page_title="Medical Student Assistant",
    page_icon="🩺",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# Custom CSS for mobile-first design
st.markdown("""
<style>
    /* Mobile-first styling */
    .stApp {
        max-width: 100%;
    }
    
    /* Large navigation buttons */
    .nav-button {
        display: block;
        width: 100%;
        padding: 20px 24px;
        margin: 12px 0;
        font-size: 18px;
        font-weight: 600;
        text-align: left;
        background: linear-gradient(135deg, #0066CC 0%, #0052A3 100%);
        color: white;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .nav-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
    }
    
    /* Welcome card */
    .welcome-card {
        background: linear-gradient(135deg, #F5F7FA 0%, #E8ECF1 100%);
        padding: 24px;
        border-radius: 16px;
        margin-bottom: 24px;
        border: 1px solid #E5E7EB;
    }
    
    /* Case info card */
    .case-info {
        background: #F5F7FA;
        padding: 16px;
        border-radius: 12px;
        margin: 12px 0;
        border-left: 4px solid #0066CC;
    }
    
    /* Vital signs grid */
    .vitals-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin: 16px 0;
    }
    
    .vital-item {
        background: white;
        padding: 12px;
        border-radius: 8px;
        text-align: center;
        border: 1px solid #E5E7EB;
    }
    
    .vital-label {
        font-size: 12px;
        color: #6B7280;
        margin-bottom: 4px;
    }
    
    .vital-value {
        font-size: 16px;
        font-weight: 600;
        color: #1A1A1A;
    }
    
    /* Success message */
    .success-message {
        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        margin: 20px 0;
    }
    
    /* Page headers */
    .page-header {
        font-size: 28px;
        font-weight: 700;
        color: #1A1A1A;
        margin-bottom: 8px;
    }
    
    .page-subtitle {
        font-size: 16px;
        color: #6B7280;
        margin-bottom: 24px;
    }
    
    /* Hide Streamlit branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    
    /* Improve button styling */
    .stButton > button {
        width: 100%;
        padding: 16px 24px;
        font-size: 16px;
        font-weight: 600;
        border-radius: 12px;
        border: none;
        transition: all 0.2s;
    }
    
    .stButton > button:hover {
        transform: translateY(-1px);
    }
    
    /* Chat message styling */
    .stChatMessage {
        padding: 12px !important;
        border-radius: 12px !important;
    }
    
    /* Expander styling */
    .streamlit-expanderHeader {
        font-size: 16px !important;
        font-weight: 600 !important;
    }
    
    /* Text input styling */
    .stTextArea textarea {
        border-radius: 12px !important;
        border: 2px solid #E5E7EB !important;
        padding: 12px !important;
    }
    
    .stTextArea textarea:focus {
        border-color: #0066CC !important;
        box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1) !important;
    }
</style>
""", unsafe_allow_html=True)


def load_cases():
    """Load all case files from the cases directory."""
    cases = {}
    cases_dir = "cases"
    
    if os.path.exists(cases_dir):
        for filename in os.listdir(cases_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(cases_dir, filename)
                try:
                    with open(filepath, "r") as f:
                        case_data = json.load(f)
                        case_id = case_data.get("case_id", filename.replace(".json", ""))
                        cases[case_id] = case_data
                except Exception as e:
                    st.error(f"Error loading {filename}: {e}")
    
    return cases


def ensure_feedback_csv():
    """Create feedback.csv if it doesn't exist."""
    feedback_file = "feedback.csv"
    if not os.path.exists(feedback_file):
        with open(feedback_file, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "feedback", "rating"])
    return feedback_file


def save_feedback(feedback_text, rating):
    """Save feedback to CSV file."""
    feedback_file = ensure_feedback_csv()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with open(feedback_file, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([timestamp, feedback_text, rating])


def get_singlish_instruction(level):
    """Get language instruction based on Singlish level."""
    if level == "high":
        return """Use heavy Singlish expressions naturally. Include common phrases like 'lah', 'leh', 'lor', 'sia', 'can or not', 'how come', 'aiyo', 'walao'. 
        Mix English with occasional Chinese/Malay words. Speak in a very casual, local Singaporean manner."""
    elif level == "moderate":
        return """Use moderate Singlish. Include occasional 'lah', 'leh', 'lor' at the end of sentences. 
        Speak in a casual but understandable Singaporean English style. Don't overdo the slang."""
    else:  # low or default
        return """Speak in standard English with minimal Singlish. You may occasionally use 'lah' or 'okay' in a Singaporean way, 
        but keep the language clear and professional."""


def get_ai_response(messages, case_data):
    """Get AI response from OpenAI."""
    try:
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        
        singlish_level = case_data.get("singlish_level", "low")
        singlish_instruction = get_singlish_instruction(singlish_level)
        
        system_prompt = f"""You are a standardized patient in an OSCE (Objective Structured Clinical Examination) simulation for medical students.

CHARACTER PROFILE:
- Name: {case_data.get('patient_name', 'Patient')}
- Age: {case_data.get('age', 'Unknown')} years old
- Gender: {case_data.get('gender', 'Unknown')}
- Chief Complaint: {case_data.get('chief_complaint', 'Not specified')}

PRESENTING HISTORY:
{case_data.get('presenting_history', 'Not provided')}

PAST MEDICAL HISTORY:
{chr(10).join(case_data.get('past_medical_history', ['Not provided']))}

SOCIAL HISTORY:
{case_data.get('social_history', 'Not provided')}

ALLERGIES:
{case_data.get('allergies', 'No known allergies')}

ACTING INSTRUCTIONS:
{case_data.get('script_instructions', 'Act as a cooperative patient.')}

SECRET INFORMATION (only reveal if directly asked relevant questions):
{case_data.get('secret_info', 'None')}

LANGUAGE STYLE:
{singlish_instruction}

IMPORTANT RULES:
1. Stay in character at all times as the patient
2. Only provide information when asked - don't volunteer everything at once
3. Show appropriate emotions (pain, anxiety, etc.) based on your condition
4. If asked about vitals or examination findings, say "The doctor/nurse can check that"
5. Do not diagnose yourself or suggest what condition you might have
6. Respond naturally as a real patient would - be conversational
7. Keep responses concise (1-3 sentences usually) unless the question requires more detail
8. If the student asks something inappropriate or off-topic, redirect politely as a patient would"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                *messages
            ],
            max_tokens=300,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        return f"I'm sorry, I'm having trouble responding right now. (Error: {str(e)})"


def home_page():
    """Render the home page with navigation buttons."""
    st.markdown('<p class="page-header">Medical Student Assistant</p>', unsafe_allow_html=True)
    
    st.markdown("""
    <div class="welcome-card">
        <h3 style="margin: 0 0 8px 0; color: #1A1A1A;">Welcome, Future Doctor!</h3>
        <p style="margin: 0; color: #6B7280; font-size: 15px;">
            Practice your clinical skills with AI-powered patient simulations. 
            Perfect for OSCE preparation and history-taking practice.
        </p>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("### Quick Actions")
    
    col1 = st.columns(1)[0]
    
    with col1:
        if st.button("Start OSCE Practice", key="nav_osce", use_container_width=True, type="primary"):
            st.session_state.current_page = "osce"
            st.rerun()
        
        st.markdown("<div style='height: 8px'></div>", unsafe_allow_html=True)
        
        if st.button("Submit Feedback", key="nav_feedback", use_container_width=True):
            st.session_state.current_page = "feedback"
            st.rerun()
    
    st.markdown("---")
    
    st.markdown("### About This App")
    st.markdown("""
    - **OSCE Simulator**: Practice taking patient histories with AI patients
    - **Realistic Cases**: Based on common clinical presentations
    - **Singlish Support**: Patients speak in authentic Singaporean English
    - **Instant Feedback**: Chat with patients in real-time
    """)


def osce_page():
    """Render the OSCE simulator page."""
    st.markdown('<p class="page-header">OSCE Simulator</p>', unsafe_allow_html=True)
    st.markdown('<p class="page-subtitle">Practice your history-taking skills</p>', unsafe_allow_html=True)
    
    # Load cases
    cases = load_cases()
    
    if not cases:
        st.warning("No cases found. Please add JSON case files to the 'cases' folder.")
        if st.button("Back to Home", use_container_width=True):
            st.session_state.current_page = "home"
            st.rerun()
        return
    
    # Case selector
    case_names = {case_id: f"{data.get('patient_name', 'Unknown')} - {data.get('chief_complaint', 'Unknown')}" 
                  for case_id, data in cases.items()}
    
    selected_case_id = st.selectbox(
        "Select a Case",
        options=list(cases.keys()),
        format_func=lambda x: case_names.get(x, x),
        key="case_selector"
    )
    
    # Reset chat when case changes
    if "current_case_id" not in st.session_state or st.session_state.current_case_id != selected_case_id:
        st.session_state.current_case_id = selected_case_id
        st.session_state.messages = []
    
    case_data = cases[selected_case_id]
    
    # Patient details in expander
    with st.expander("Show Patient Details", expanded=False):
        st.markdown(f"**Patient:** {case_data.get('patient_name', 'Unknown')}")
        st.markdown(f"**Age/Gender:** {case_data.get('age', 'Unknown')} years old, {case_data.get('gender', 'Unknown')}")
        st.markdown(f"**Chief Complaint:** {case_data.get('chief_complaint', 'Not specified')}")
        
        st.markdown("---")
        st.markdown("**Vital Signs:**")
        
        vitals = case_data.get('vitals', {})
        if vitals:
            cols = st.columns(2)
            vital_items = list(vitals.items())
            for i, (key, value) in enumerate(vital_items):
                with cols[i % 2]:
                    label = key.replace("_", " ").title()
                    st.metric(label=label, value=value)
        
        if case_data.get('allergies'):
            st.markdown(f"**Allergies:** {case_data.get('allergies')}")
    
    st.markdown("---")
    
    # Initialize messages in session state
    if "messages" not in st.session_state:
        st.session_state.messages = []
    
    # Display chat messages
    for message in st.session_state.messages:
        with st.chat_message(message["role"], avatar="👨‍⚕️" if message["role"] == "user" else "🤒"):
            st.markdown(message["content"])
    
    # Welcome message if no messages yet
    if not st.session_state.messages:
        st.info("Start by greeting the patient or asking about their complaint. Try: 'Hello, I'm the medical student. What brings you in today?'")
    
    # Chat input
    if prompt := st.chat_input("Type your question to the patient..."):
        # Add user message
        st.session_state.messages.append({"role": "user", "content": prompt})
        
        with st.chat_message("user", avatar="👨‍⚕️"):
            st.markdown(prompt)
        
        # Get AI response
        with st.chat_message("assistant", avatar="🤒"):
            with st.spinner("Patient is thinking..."):
                ai_messages = [{"role": m["role"], "content": m["content"]} 
                              for m in st.session_state.messages]
                response = get_ai_response(ai_messages, case_data)
                st.markdown(response)
        
        # Add assistant message
        st.session_state.messages.append({"role": "assistant", "content": response})
    
    # Action buttons
    st.markdown("---")
    col1, col2 = st.columns(2)
    
    with col1:
        if st.button("Clear Chat", use_container_width=True):
            st.session_state.messages = []
            st.rerun()
    
    with col2:
        if st.button("Back to Home", use_container_width=True):
            st.session_state.current_page = "home"
            st.rerun()


def feedback_page():
    """Render the feedback page."""
    st.markdown('<p class="page-header">Feedback</p>', unsafe_allow_html=True)
    st.markdown('<p class="page-subtitle">Help us improve this app</p>', unsafe_allow_html=True)
    
    # Show success message if just submitted
    if st.session_state.get("feedback_submitted"):
        st.markdown("""
        <div class="success-message">
            <h3 style="margin: 0;">Thank You!</h3>
            <p style="margin: 8px 0 0 0;">Your feedback has been submitted successfully.</p>
        </div>
        """, unsafe_allow_html=True)
        
        if st.button("Submit Another Response", use_container_width=True):
            st.session_state.feedback_submitted = False
            st.rerun()
        
        st.markdown("<div style='height: 16px'></div>", unsafe_allow_html=True)
        
        if st.button("Back to Home", use_container_width=True):
            st.session_state.feedback_submitted = False
            st.session_state.current_page = "home"
            st.rerun()
        return
    
    # Feedback form
    with st.form("feedback_form"):
        st.markdown("**How would you rate your experience?**")
        rating = st.select_slider(
            "Rating",
            options=["Very Poor", "Poor", "Average", "Good", "Excellent"],
            value="Good",
            label_visibility="collapsed"
        )
        
        st.markdown("<div style='height: 16px'></div>", unsafe_allow_html=True)
        
        feedback_text = st.text_area(
            "Share your thoughts",
            placeholder="What did you like? What could be improved? Any suggestions for new cases?",
            height=150
        )
        
        st.markdown("<div style='height: 16px'></div>", unsafe_allow_html=True)
        
        submitted = st.form_submit_button("Submit Feedback", use_container_width=True, type="primary")
        
        if submitted:
            if feedback_text.strip():
                save_feedback(feedback_text, rating)
                st.session_state.feedback_submitted = True
                st.rerun()
            else:
                st.error("Please enter your feedback before submitting.")
    
    st.markdown("<div style='height: 24px'></div>", unsafe_allow_html=True)
    
    if st.button("Back to Home", use_container_width=True):
        st.session_state.current_page = "home"
        st.rerun()


def main():
    """Main application entry point."""
    # Initialize session state
    if "current_page" not in st.session_state:
        st.session_state.current_page = "home"
    
    # Sidebar navigation
    with st.sidebar:
        st.markdown("### Navigation")
        
        if st.button("Home", key="sidebar_home", use_container_width=True):
            st.session_state.current_page = "home"
            st.rerun()
        
        if st.button("OSCE Simulator", key="sidebar_osce", use_container_width=True):
            st.session_state.current_page = "osce"
            st.rerun()
        
        if st.button("Feedback", key="sidebar_feedback", use_container_width=True):
            st.session_state.current_page = "feedback"
            st.rerun()
        
        st.markdown("---")
        st.markdown("**Medical Student Assistant**")
        st.markdown("Practice OSCE with AI patients")
    
    # Route to appropriate page
    if st.session_state.current_page == "home":
        home_page()
    elif st.session_state.current_page == "osce":
        osce_page()
    elif st.session_state.current_page == "feedback":
        feedback_page()
    else:
        home_page()


if __name__ == "__main__":
    main()
