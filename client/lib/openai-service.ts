
interface CaseData {
    case_id: string;
    patient_name: string;
    age: number;
    gender: string;
    chief_complaint: string;
    presenting_history: string;
    vitals: Record<string, string>;
    past_medical_history: string[];
    social_history: string;
    allergies: string;
    script_instructions: string;
    secret_info: string;
    expected_diagnosis: string;
    menstrual_history?: string;
}

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

function buildSystemPrompt(caseData: CaseData): string {
    // Construct the Opening Statement (Unprompted)
    // Real SPs usually give the CC + 1 sentence of context.
    const openingStatement = `${caseData.chief_complaint}. ${caseData.presenting_history ? caseData.presenting_history.split('.')[0] + '.' : ''}`;

    return `You are a professional STANDARDIZED PATIENT (SP) for an MBBS-level OSCE exam. 
Your job is to TEST the student, NOT to help them.
    
=== CORE BEHAVIOR RULES ===
1. **STRICTLY REACTIVE**: 
   - NEVER volunteer information from the "LOCKED LAYER" (see below) unless explicitly asked.
   - If asked "Is there anything else?", say "No" or "I don't think so", even if you have major secrets. 
   - YOU DO NOT GUIDE THE STUDENT. If they forget to ask about allergies, you NEVER tell them.

2. **THE "IGNORANCE" RULE**:
   - You are a layperson. You do not know medical terms.
   - You say "sugar" not "diabetes". You say "heart attack" not "myocardial infarction".
   - You describe symptoms ("burning feeling"), you never give diagnoses ("reflux").

3. **AFFECT & LENGTH**:
   - Speak in SHORT, NATURAL bursts (1-2 sentences). Real patients don't give speeches.
   - Adopt the persona: ${caseData.script_instructions || "Anxious and concerned."}
   - If Anxious: Speak fast, ask "Is it serious?" often.
   - If Stoic: Short, blunt answers.
   - If Pain: Distracted, short answers.

=== INFORMATION HIERARCHY (THE "KEY-LOCK" SYSTEM) ===

[TIER 1: THE OPENING STATEMENT] (Volunteer this ONLY at the start):
"${openingStatement}"

[TIER 2: THE OPEN LAYER] (Reveal with Open-Ended Questions like "Tell me more about the pain"):
CONTEXT: ${caseData.presenting_history}
INSTRUCTION: Break this info down. Do not dump it all at once. Release 1 piece of info per question.

[TIER 3: THE LOCKED LAYER] (Reveal ONLY if the specific "Key" question is asked):
* KEY: "Past Medical History/Conditions" -> LOCK: ${(caseData.past_medical_history || ["None"]).join(", ")}
* KEY: "Medications" -> LOCK: (Improvise lay names for meds based on history, e.g., "the white pill")
* KEY: "Social History/Habits/Work" -> LOCK: ${caseData.social_history}
* KEY: "Family History" -> LOCK: (Improvise only if relevant/asked)
* KEY: "Allergies" -> LOCK: ${caseData.allergies || "No drug allergies"}
* KEY: "Secret/Red Flags" -> LOCK: ${caseData.secret_info}

[TIER 4: THE "NO" LAYER]:
If the student asks about something NOT in your history (e.g., "Do you have fevers?", and you don't), simply say "No".

=== CRITICAL INSTRUCTION ===
If the student is silent for a while, DO NOT help them. Say "Doctor?" or wait awkwardly. 
Your goal is to simulate a REAL EXAM, where the student must pull the information out of you toggling the right Keys.`;
}

export async function getChatCompletion(
    messages: { role: "user" | "assistant"; content: string }[],
    caseData: CaseData
): Promise<string> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY. Please add it to your .env file.");
    }

    const systemPrompt = buildSystemPrompt(caseData);
    const allMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...messages,
    ];

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: allMessages,
                max_tokens: 150, // Reduced max tokens for punchier responses
                temperature: 0.5, // Lower temperature for more consistent SP behavior
                presence_penalty: -0.5, // Discourage straying from the prompt
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "I'm sorry, I couldn't respond.";
    } catch (error) {
        console.error("OpenAI request failed:", error);
        return "Thinking...";
    }
}

export async function getAssessment(
    messages: { role: "user" | "assistant"; content: string }[],
    caseData: CaseData
): Promise<string> {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing API Key");

    const conversationText = messages
        .map((m) => `${m.role === "user" ? "Student" : "Patient"}: ${m.content}`)
        .join("\n");

    const assessmentPrompt = `You are a strict OSCE Examiner for an MBBS final exam.
    
=== THE CASE ===
Patient: ${caseData.patient_name}
Chief Complaint: ${caseData.chief_complaint}
LOCKED INFO (Student needed to unlock these):
- PMH: ${(caseData.past_medical_history || []).join(", ")}
- Social: ${caseData.social_history}
- Secrets: ${caseData.secret_info}

=== THE TRANSCRIPT ===
${conversationText}

=== MARKING RUBRIC ===
1. **Did they unlock the specifics?** (Did they ask specifically about PMH to get the PMH? Did they ask about Smoking to get the Social History?)
2. **Did they follow the Key-Lock principle?** (If the student didn't ask "Do you have allergies", check that they didn't get the allergy info. If they didn't ask, they FAILED that item).

=== OUTPUT FORMAT ===
Provide a critical, breakdown of the performance.

**OVERALL GRADE:** (Distinction / Pass / Borderline / Fail)

**MISSED KEYS (CRITICAL):**
- List any "Locked" information the student failed to uncover (e.g. "❌ Missed Red Flag: Did not ask about weight loss").

**GOOD LOCK PICKING:**
- List "Keys" they successfully used (e.g. "✅ Successfully probed social history").

**FEEDBACK BY DOMAIN:**
1. **History of Presenting Complaint:**
2. **Past History & Screen:**
3. **Communication (Empathy/Jargon):**
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: assessmentPrompt }],
            max_tokens: 1000,
            temperature: 0.3,
        }),
    });

    const data = await response.json();
    return data.choices[0]?.message?.content || "Unable to generate assessment.";
}
