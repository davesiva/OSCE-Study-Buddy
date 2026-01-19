import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { setupRealtimeWebSocket } from "./realtime";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  assessment_criteria?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(caseData: CaseData): string {
  
  return `You are a standardized patient in an OSCE (Objective Structured Clinical Examination) simulation for medical students.

CHARACTER PROFILE:
- Name: ${caseData.patient_name || "Patient"}
- Age: ${caseData.age || "Unknown"} years old
- Gender: ${caseData.gender || "Unknown"}
- Chief Complaint: ${caseData.chief_complaint || "Not specified"}

PRESENTING HISTORY:
${caseData.presenting_history || "Not provided"}

PAST MEDICAL HISTORY:
${(caseData.past_medical_history || ["Not provided"]).join("\n")}

SOCIAL HISTORY:
${caseData.social_history || "Not provided"}

ALLERGIES:
${caseData.allergies || "No known allergies"}

${caseData.menstrual_history ? `MENSTRUAL HISTORY:\n${caseData.menstrual_history}` : ""}

ACTING INSTRUCTIONS:
${caseData.script_instructions || "Act as a cooperative patient."}

SECRET INFORMATION (only reveal if directly asked relevant questions):
${caseData.secret_info || "None"}

LANGUAGE STYLE:
Speak in clear, natural English. Be conversational and friendly.

IMPORTANT RULES:
1. Stay in character at all times as the patient
2. Only provide information when asked - don't volunteer everything at once
3. Show appropriate emotions (pain, anxiety, etc.) based on your condition
4. If asked about vitals or examination findings, say "The doctor/nurse can check that"
5. Do not diagnose yourself or suggest what condition you might have
6. Respond naturally as a real patient would - be conversational
7. Keep responses concise (1-3 sentences usually) unless the question requires more detail
8. If the student asks something inappropriate or off-topic, redirect politely as a patient would`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all cases
  app.get("/api/cases", (_req: Request, res: Response) => {
    try {
      const casesDir = path.resolve(process.cwd(), "cases");
      const cases: CaseData[] = [];
      
      if (fs.existsSync(casesDir)) {
        const files = fs.readdirSync(casesDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            const filePath = path.join(casesDir, file);
            const content = fs.readFileSync(filePath, "utf-8");
            const caseData = JSON.parse(content) as CaseData;
            cases.push(caseData);
          }
        }
      }
      
      res.json(cases);
    } catch (error) {
      console.error("Error loading cases:", error);
      res.status(500).json({ error: "Failed to load cases" });
    }
  });

  // Get a specific case
  app.get("/api/cases/:caseId", (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const casesDir = path.resolve(process.cwd(), "cases");
      
      if (fs.existsSync(casesDir)) {
        const files = fs.readdirSync(casesDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            const filePath = path.join(casesDir, file);
            const content = fs.readFileSync(filePath, "utf-8");
            const caseData = JSON.parse(content) as CaseData;
            if (caseData.case_id === caseId) {
              res.json(caseData);
              return;
            }
          }
        }
      }
      
      res.status(404).json({ error: "Case not found" });
    } catch (error) {
      console.error("Error loading case:", error);
      res.status(500).json({ error: "Failed to load case" });
    }
  });

  // Chat with AI patient
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { messages, caseData } = req.body as {
        messages: ChatMessage[];
        caseData: CaseData;
      };

      if (!messages || !caseData) {
        res.status(400).json({ error: "Missing messages or caseData" });
        return;
      }

      const systemPrompt = buildSystemPrompt(caseData);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content || "I'm sorry, I couldn't respond.";
      res.json({ content });
    } catch (error) {
      console.error("Error in chat:", error);
      res.status(500).json({ error: "Failed to get response from AI" });
    }
  });

  // Save feedback
  app.post("/api/feedback", (req: Request, res: Response) => {
    try {
      const { feedback, rating } = req.body as { feedback: string; rating: string };
      
      if (!feedback) {
        res.status(400).json({ error: "Feedback is required" });
        return;
      }

      const feedbackFile = path.resolve(process.cwd(), "feedback.csv");
      const timestamp = new Date().toISOString();
      const line = `"${timestamp}","${feedback.replace(/"/g, '""')}","${rating}"\n`;
      
      if (!fs.existsSync(feedbackFile)) {
        fs.writeFileSync(feedbackFile, "timestamp,feedback,rating\n");
      }
      
      fs.appendFileSync(feedbackFile, line);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving feedback:", error);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  // Generate AI case based on specialty and difficulty
  app.post("/api/generate-case", async (req: Request, res: Response) => {
    try {
      const { specialty, difficulty } = req.body as { specialty: string; difficulty: string };
      
      if (!specialty) {
        res.status(400).json({ error: "Specialty is required" });
        return;
      }

      const specialtyNames: Record<string, string> = {
        cardiology: "Cardiology (heart conditions)",
        respiratory: "Respiratory (lung conditions)",
        gastroenterology: "Gastroenterology (digestive system)",
        neurology: "Neurology (nervous system)",
        renal: "Renal (kidney conditions)",
        endocrine: "Endocrinology (hormonal conditions)",
        msk: "Musculoskeletal (bones, joints, muscles)",
        obgyn: "Obstetrics & Gynaecology",
        infectious: "Infectious Diseases",
      };

      const difficultyInstructions: Record<string, string> = {
        easy: `Create a TEXTBOOK/CLASSIC presentation that medical students learn in their early years.
- The diagnosis should be obvious with clear, classic symptoms
- Use common conditions like: pneumonia, acute MI with classic symptoms, appendicitis, UTI, gastroenteritis, asthma exacerbation
- Patient gives clear, straightforward answers
- No red herrings or confusing symptoms`,
        medium: `Create an ATYPICAL presentation of a relatively common condition.
- The symptoms may not follow the textbook presentation
- Include some distractors in the history that require good clinical reasoning
- Examples: diabetic patient with silent MI, elderly with atypical pneumonia, young patient with unusual presentation
- Patient may give vague answers initially but reveals key info when probed`,
        challenging: `Create a CHALLENGING case with either a rare condition OR a common condition with very unusual presentation.
- Include multiple red herrings and distractors
- The diagnosis should be non-obvious and require careful history-taking
- Examples: Addisonian crisis, pheochromocytoma, thyroid storm, pulmonary embolism presenting as anxiety, Guillain-Barré, aortic dissection in young patient
- Critical information should only be revealed if student asks specific questions
- Patient may initially present with misleading chief complaint`,
      };

      const prompt = `You are an expert medical educator creating OSCE (Objective Structured Clinical Examination) cases for medical students in Singapore.

Generate a realistic patient case for the specialty: ${specialtyNames[specialty] || specialty}
Difficulty level: ${difficulty?.toUpperCase() || "MEDIUM"}

${difficultyInstructions[difficulty] || difficultyInstructions.medium}

SINGAPORE CONTEXT (IMPORTANT):
- Use Singaporean patient names and demographics (Chinese, Malay, Indian, or Eurasian names)
- Reference local healthcare settings (polyclinic, restructured hospital like SGH, NUH, TTSH, Changi General)
- Include locally relevant conditions: dengue fever, hand-foot-mouth disease, tuberculosis (for infectious)
- Consider local chronic disease patterns: high prevalence of Type 2 DM, hypertension, hyperlipidaemia, chronic kidney disease, NAFLD
- Include relevant social history: HDB living, hawker food diet, traditional Chinese medicine use, medication compliance issues
- Use local medication brand names where appropriate

Generate a complete case in the following JSON format:
{
  "patient_name": "Full Singaporean name with title (Mr./Mrs./Mdm./Ms.)",
  "age": <age as number>,
  "gender": "Male or Female",
  "chief_complaint": "Main presenting complaint with duration",
  "presenting_history": "Detailed history of presenting illness (3-5 sentences)",
  "blood_pressure": "e.g., 130/85 mmHg",
  "heart_rate": "e.g., 88 bpm",
  "respiratory_rate": "e.g., 18/min",
  "temperature": "e.g., 37.2°C",
  "spo2": "e.g., 98% on room air",
  "past_medical_history": ["Condition 1 with medications if relevant", "Condition 2"],
  "social_history": "Occupation, smoking/alcohol status, living situation, diet",
  "allergies": "Known allergies or 'No known drug allergies (NKDA)'",
  "script_instructions": "Detailed acting instructions for how the AI patient should behave, their personality, emotions, and specific behaviors. Include how they should respond to different types of questions.",
  "secret_info": "Critical information that should only be revealed if the student asks the right questions. This is key for challenging cases.",
  "expected_diagnosis": "The actual diagnosis"
}

Return ONLY the JSON object, no additional text.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.8,
      });

      const responseText = response.choices[0]?.message?.content || "";
      
      let extractedData;
      try {
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonText = jsonMatch ? jsonMatch[1] : responseText;
        extractedData = JSON.parse(jsonText.trim());
      } catch {
        const jsonStart = responseText.indexOf("{");
        const jsonEnd = responseText.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          extractedData = JSON.parse(responseText.slice(jsonStart, jsonEnd + 1));
        } else {
          throw new Error("Could not parse JSON from AI response");
        }
      }

      res.json({ success: true, data: extractedData });
    } catch (error) {
      console.error("Error generating case:", error);
      res.status(500).json({ error: "Failed to generate case. Please try again." });
    }
  });

  // Save a custom case (upload)
  app.post("/api/cases", (req: Request, res: Response) => {
    try {
      const caseData = req.body as CaseData & { is_custom?: boolean };
      
      if (!caseData.patient_name || !caseData.chief_complaint) {
        res.status(400).json({ error: "Patient name and chief complaint are required" });
        return;
      }

      const casesDir = path.resolve(process.cwd(), "cases");
      if (!fs.existsSync(casesDir)) {
        fs.mkdirSync(casesDir, { recursive: true });
      }

      const fileName = `case_custom_${caseData.case_id || Date.now()}.json`;
      const filePath = path.join(casesDir, fileName);
      
      fs.writeFileSync(filePath, JSON.stringify(caseData, null, 2));
      
      res.json({ success: true, case_id: caseData.case_id, fileName });
    } catch (error) {
      console.error("Error saving case:", error);
      res.status(500).json({ error: "Failed to save case" });
    }
  });

  // Parse PDF content to extract case data
  app.post("/api/parse-case", async (req: Request, res: Response) => {
    try {
      const { content } = req.body as { content: string };
      
      if (!content) {
        res.status(400).json({ error: "PDF content is required" });
        return;
      }

      const prompt = `You are an expert at parsing OSCE (Objective Structured Clinical Examination) documents. 
Extract the patient case information from the following document content and return it as JSON.

The document may be either:
- EI (Examiner Instructions) - contains detailed patient info, history, and expected findings
- CI (Candidate Instructions) - contains scenario info and patient vitals

Extract and return ONLY a valid JSON object with these fields:
{
  "patient_name": "Full name of the patient",
  "age": "Age as a number",
  "gender": "Male or Female",
  "chief_complaint": "Main presenting complaint",
  "presenting_history": "Detailed history of presenting illness",
  "blood_pressure": "Blood pressure reading (e.g., 120/80 mmHg)",
  "heart_rate": "Heart rate (e.g., 72/min or 72 bpm)",
  "respiratory_rate": "Respiratory rate if available",
  "temperature": "Temperature if available",
  "spo2": "Oxygen saturation if available",
  "past_medical_history": "List of past medical conditions, each on a new line",
  "social_history": "Social history details",
  "allergies": "Known allergies or 'No known allergies'",
  "script_instructions": "How the patient should act/behave, their emotions, personality traits. Include any specific behaviors or responses the patient should exhibit.",
  "secret_info": "Information the patient only reveals when asked specific questions (from the examiner instructions)",
  "expected_diagnosis": "The expected or actual diagnosis if mentioned"
}

Important:
- Extract as much information as possible from the document
- For script_instructions, synthesize how the patient should behave based on the context
- For secret_info, include any information that should only be revealed with direct questioning
- Return ONLY the JSON object, no additional text

Document content:
${content}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      });

      const responseText = response.choices[0]?.message?.content || "";
      
      // Try to parse the JSON from the response
      let extractedData;
      try {
        // Remove markdown code blocks if present
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonText = jsonMatch ? jsonMatch[1] : responseText;
        extractedData = JSON.parse(jsonText.trim());
      } catch {
        // If parsing fails, try to find JSON object in the text
        const jsonStart = responseText.indexOf("{");
        const jsonEnd = responseText.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          extractedData = JSON.parse(responseText.slice(jsonStart, jsonEnd + 1));
        } else {
          throw new Error("Could not parse JSON from AI response");
        }
      }

      res.json({ success: true, data: extractedData });
    } catch (error) {
      console.error("Error parsing case:", error);
      res.status(500).json({ error: "Failed to parse the document. Please try again." });
    }
  });

  // Parse calibration/assessment document
  app.post("/api/parse-calibration", async (req: Request, res: Response) => {
    try {
      const { content } = req.body as { content: string };
      
      if (!content) {
        res.status(400).json({ error: "Calibration document content is required" });
        return;
      }

      const prompt = `You are an expert at parsing OSCE (Objective Structured Clinical Examination) calibration and assessment documents.
Extract the assessment criteria from the following document and return it as a structured text format that can be used to evaluate a medical student's performance.

The document may contain:
- Grading domains (History Taking, Physical Examination, Problem Definition, etc.)
- Pass/fail criteria
- Expected behaviors and skills
- Marking guidelines

Extract and organize the assessment criteria in a clear, structured format that includes:
1. Each domain being assessed
2. What constitutes a pass, fail, or distinction for each domain
3. Key things the examiner should look for
4. Any red flags that indicate poor performance

Return the assessment criteria as clear, readable text (not JSON).

Document content:
${content}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      });

      const assessmentCriteria = response.choices[0]?.message?.content || "";
      
      res.json({ success: true, assessment_criteria: assessmentCriteria });
    } catch (error) {
      console.error("Error parsing calibration:", error);
      res.status(500).json({ error: "Failed to parse calibration document" });
    }
  });

  // Generate assessment for a clerking session
  app.post("/api/assess", async (req: Request, res: Response) => {
    try {
      const { messages, caseData } = req.body as {
        messages: ChatMessage[];
        caseData: CaseData;
      };

      if (!messages || messages.length === 0) {
        res.status(400).json({ error: "No conversation to assess" });
        return;
      }

      const conversationText = messages
        .map((m) => `${m.role === "user" ? "Student" : "Patient"}: ${m.content}`)
        .join("\n");

      let assessmentPrompt = `You are an experienced OSCE examiner assessing a medical student's clerking performance.

CASE INFORMATION:
- Patient: ${caseData.patient_name}, ${caseData.age} years old, ${caseData.gender}
- Chief Complaint: ${caseData.chief_complaint}
- Expected Diagnosis: ${caseData.expected_diagnosis || "Not specified"}

CONVERSATION TRANSCRIPT:
${conversationText}

`;

      if (caseData.assessment_criteria) {
        assessmentPrompt += `
ASSESSMENT CRITERIA (from calibration document):
${caseData.assessment_criteria}

Based on the above criteria, provide a detailed assessment of the student's performance.
`;
      } else {
        assessmentPrompt += `
Assess the student's performance based on standard OSCE domains:
1. History Taking Skills - Use of open/closed questions, pacing, allowing patient to speak
2. Relevance of History - Coverage of presenting complaint, red flags, relevant systems review
3. Physical Examination Skills - Appropriate examination approach (if discussed)
4. Problem Definition - Identification of key issues and differential diagnoses
5. Management Plan - Appropriate investigations and treatment suggestions
6. Communication Skills - Clarity, empathy, rapport building, patient education
7. Professionalism - Respect, ethics, patient autonomy
`;
      }

      assessmentPrompt += `
Provide your assessment in the following format:

OVERALL GRADE: [Distinction / Pass / Borderline / Fail]

DOMAIN SCORES:
[For each relevant domain, provide: Domain Name - Grade - Brief comment]

STRENGTHS:
[List 2-3 things the student did well]

AREAS FOR IMPROVEMENT:
[List 2-3 specific areas where the student could improve]

SPECIFIC FEEDBACK:
[Provide detailed, constructive feedback on the student's approach]

MISSED OPPORTUNITIES:
[List any important questions or topics the student failed to explore]`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: assessmentPrompt }],
        max_tokens: 1500,
        temperature: 0.4,
      });

      const assessment = response.choices[0]?.message?.content || "Unable to generate assessment.";
      
      res.json({ 
        success: true, 
        assessment,
        hasCustomCriteria: !!caseData.assessment_criteria
      });
    } catch (error) {
      console.error("Error generating assessment:", error);
      res.status(500).json({ error: "Failed to generate assessment" });
    }
  });

  // Update case with assessment criteria
  app.patch("/api/cases/:caseId/criteria", (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const { assessment_criteria } = req.body as { assessment_criteria: string };
      
      const casesDir = path.resolve(process.cwd(), "cases");
      
      if (fs.existsSync(casesDir)) {
        const files = fs.readdirSync(casesDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            const filePath = path.join(casesDir, file);
            const content = fs.readFileSync(filePath, "utf-8");
            const caseData = JSON.parse(content) as CaseData;
            if (caseData.case_id === caseId) {
              caseData.assessment_criteria = assessment_criteria;
              fs.writeFileSync(filePath, JSON.stringify(caseData, null, 2));
              res.json({ success: true });
              return;
            }
          }
        }
      }
      
      res.status(404).json({ error: "Case not found" });
    } catch (error) {
      console.error("Error updating case criteria:", error);
      res.status(500).json({ error: "Failed to update assessment criteria" });
    }
  });

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  const httpServer = createServer(app);
  
  setupRealtimeWebSocket(httpServer);

  return httpServer;
}
