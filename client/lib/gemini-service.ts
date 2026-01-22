import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini Client
// We use the EXPO_PUBLIC prefix if we want it visible to the client bundle 
// BUT for security, standard API keys should usually be backend-only. 
// However, sticking to the current "Client-Side" architecture for Chat (as per current openai-service),
// we will use the key directly. Note: This exposes the key in the bundle.
// The migration plan calls for a backend proxy for Voice, but for Chat we are mirroring the current setup.
// Using a direct key is acceptable for prototypes/student apps but not production-safe without a proxy.
// Given the user just pasted the key, we'll proceed with direct client access for now to match the existing pattern.

const API_KEY = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

function getClient() {
    if (!genAI) {
        if (!API_KEY) {
            console.warn("Missing GEMINI_API_KEY");
            // Fallback for types, but this will fail at runtime if not set
            return new GoogleGenerativeAI("dummy");
        }
        genAI = new GoogleGenerativeAI(API_KEY);
    }
    return genAI;
}

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface CaseData {
    patient_name: string;
    age: number;
    gender: string;
    chief_complaint: string;
    presenting_history: string;
    vitals: any;
    past_medical_history: string[];
    social_history: string;
    allergies: string;
    script_instructions: string;
    secret_info: string;
    expected_diagnosis: string;
}

const SYSTEM_INSTRUCTIONS = `
You are a Standardized Patient (SP) for a medical OSCE exam.
Your goal is to act like a real patient with a specific condition.
- Speak naturally, using layman's terms (unless you have medical background in your persona).
- Do not volunteer all information at once. Wait for the student to ask.
- If the student asks about something unrelated, be vague or say "I don't know".
- If the student is empathetic, respond positively.
- If the student is rude, become withdrawn or irritated.
- STAY IN CHARACTER AT ALL TIMES.
- NEVER break character to give feedback during the consult.
- If the student is silent, ask "Doctor?" or "Are you there?"`

export async function getChatCompletion(
    messages: { role: string; content: string }[],
    caseData: CaseData
): Promise<string> {
    try {
        const client = getClient();
        // Gemini 1.5 Flash is the fast, cost-effective model
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Construct the prompt history
        // Gemini supports "user" and "model" roles. "system" is passed as systemInstruction to the model config usually,
        // or we can prepend it to the first message.

        // For simplicity, we'll prepend the system instruction + case context
        const contextPrompt = `
${SYSTEM_INSTRUCTIONS}

PATIENT DATA:
Name: ${caseData.patient_name}
Age: ${caseData.age}
Complaint: ${caseData.chief_complaint}
History: ${caseData.presenting_history}
Secret Info (Reveal only if asked): ${caseData.secret_info}
Acting Instructions: ${caseData.script_instructions}
`;

        // Convert OpenAI-style messages to Gemini history
        const history = messages.slice(0, -1).map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));

        const lastMessage = messages[messages.length - 1];

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: contextPrompt }] // Inject system context as first user message
                },
                {
                    role: "model",
                    parts: [{ text: "I understand. I am ready to act as the patient." }] // Prime the model
                },
                ...history
            ],
            generationConfig: {
                maxOutputTokens: 300,
                temperature: 0.7,
            },
        });

        const result = await chat.sendMessage(lastMessage.content);
        const response = result.response.text();
        return response;

    } catch (error) {
        console.error("Gemini Chat Error:", error);
        throw new Error("Failed to get response from Gemini.");
    }
}

export async function generateCase(
    specialty: string,
    difficulty: string
): Promise<any> {
    const client = getClient();
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
    You are an expert medical educator creating OSCE cases.
    Generate a realistic patient case for Specialty: "${specialty}" and Difficulty: "${difficulty}".
    
    SINGAPORE CONTEXT: Use local names, locations (hospitals like SGH/NUH), and cultural context.

    Return a purely JSON object with this structure:
    {
      "patient_name": "Full Name",
      "age": 45,
      "gender": "Male",
      "chief_complaint": "Short complaint",
      "presenting_history": "3-5 sentences of history",
      "blood_pressure": "120/80",
      "heart_rate": "80",
      "respiratory_rate": "16",
      "temperature": "37.0",
      "spo2": "99%",
      "past_medical_history": ["Condition 1"],
      "social_history": "Smoking, Alcohol, Occupation",
      "allergies": "NKDA",
      "script_instructions": "How to act",
      "secret_info": "Hidden clues",
      "expected_diagnosis": "Diagnosis"
    }
    RETURN ONLY JSON. NO MARKDOWN.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Clean up markdown code blocks if present
        const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Gemini Generate Case Error:", e);
        throw new Error("Failed to generate case.");
    }
}

export async function getAssessment(
    messages: { role: string; content: string }[],
    caseData: CaseData
): Promise<string> {
    const client = getClient();
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
    You are a Medical Examiner grading a student's OSCE performance.
    
    PATIENT: ${caseData.patient_name}, ${caseData.age}yo
    DIAGNOSIS: ${caseData.expected_diagnosis}

    TRANSCRIPT:
    ${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}

    Please provide a detailed assessment in MARKDOWN format:
    1. **History Taking**: Did they ask the right questions? (OLD CARTS, Red Flags)
    2. **Empathy**: Were they professional and comforting?
    3. **Diagnosis**: Did they likely reach the correct conclusion?
    4. **Score**: Give a score out of 10.
    `;


    const result = await model.generateContent(prompt);
    return result.response.text();
}

// Helper to convert Blob to Base64
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result?.toString().split(",")[1];
            resolve(base64data || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
    const client = getClient();
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
        const base64Audio = await blobToBase64(audioBlob);

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: "audio/wav", // Assuming WAV from recorder, or mp3?
                    data: base64Audio
                }
            },
            { text: "Transcribe this audio exactly. Return only the text." }
        ]);

        return result.response.text();
    } catch (error) {
        console.error("Gemini Transcription Error:", error);
        return "";
    }
}
