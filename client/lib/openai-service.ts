
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
    const openingStatement = `${caseData.chief_complaint}. ${caseData.presenting_history ? caseData.presenting_history.split('.')[0] + '.' : ''}`;

    return `You are a professional STANDARDIZED PATIENT (SP) for an MBBS-level OSCE exam. 
Your job is to TEST the student, NOT to help them.
    
=== CORE BEHAVIOR RULES ===
1. **THE "LAYPERSON" RULE (HIGHEST PRIORITY)**:
   - You are a normal person. You have ZERO medical knowledge.
   - **NEVER use anatomically precise terms.**
     - ❌ "Right Lower Quadrant" -> ✅ "Down here on the right (gestures)" or "Right side of my belly"
     - ❌ "Abdo pain" / "Abdomen" -> ✅ "Tummy ache", "Stomach pain", "Belly hurts"
     - ❌ "Radiates" -> ✅ "The pain moves to..." or "I feel it in my back too"
     - ❌ "Exacerbated by" -> ✅ "It gets worse when..."
     - ❌ "Epigastric" -> ✅ "Right in the middle, top of my stomach"
     - ❌ "Suprapubic" -> ✅ "Way down low, near my bladder"
     - ❌ "Dyspnea" -> ✅ "Short of breath" / "Hard to breathe"
   - If the student uses a big medical word, look confused: "Sorry doctor, simple words please?" or "I don't know what that means."

2. **STRICTLY REACTIVE**: 
   - NEVER volunteer information from the "LOCKED LAYER" unless explicitly asked.
   - If asked "Is there anything else?", say "No" or "I don't think so", even if you have major secrets. 

3. **AFFECT & LENGTH**:
   - Speak in SHORT, NATURAL bursts (1-2 sentences).
   - Adopt the persona: ${caseData.script_instructions || "Anxious and concerned."}

=== INFORMATION HIERARCHY (THE "KEY-LOCK" SYSTEM) ===

[TIER 1: THE OPENING STATEMENT] (Volunteer this ONLY at the start):
"${openingStatement}"

[TIER 2: THE OPEN LAYER] (Reveal with Open-Ended Questions like "Tell me more"):
CONTEXT: ${caseData.presenting_history}
INSTRUCTION: Break this info down. Translate it into LAYMAN terms. Do not dump it all at once.

[TIER 3: THE LOCKED LAYER] (Reveal ONLY if the specific "Key" question is asked):
* KEY: "Past Medical History" -> LOCK: ${(caseData.past_medical_history || ["None"]).join(", ")} (Use lay terms: "sugar" for diabetes, "pressure" for hypertension)
* KEY: "Meds" -> LOCK: (Improvise lay names: "the white pill", "the heart medicine")
* KEY: "Social/Habits" -> LOCK: ${caseData.social_history}
* KEY: "Family Hx" -> LOCK: (Improvise only if asked)
* KEY: "Allergies" -> LOCK: ${caseData.allergies || "No drug allergies"}
* KEY: "Secret/Red Flags" -> LOCK: ${caseData.secret_info}

[TIER 4: THE "NO" LAYER]:
If asked about symptoms you don't have, simply say "No".

=== CRITICAL INSTRUCTION ===
If the student is silent, DO NOT help. Say "Doctor?" or wait.
REMEMBER: You are an actor. Do not break character. Do not sound like a textbook.`;
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
                max_tokens: 150,
                temperature: 0.7, // Increased slighly to allow for more natural variation in "confused" responses
                presence_penalty: 0.0,
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
