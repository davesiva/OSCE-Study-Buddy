import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

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
  singlish_level: string;
  expected_diagnosis: string;
  menstrual_history?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function getSinglishInstruction(level: string): string {
  if (level === "high") {
    return `Use heavy Singlish expressions naturally. Include common phrases like 'lah', 'leh', 'lor', 'sia', 'can or not', 'how come', 'aiyo', 'walao'. Mix English with occasional Chinese/Malay words. Speak in a very casual, local Singaporean manner.`;
  } else if (level === "moderate") {
    return `Use moderate Singlish. Include occasional 'lah', 'leh', 'lor' at the end of sentences. Speak in a casual but understandable Singaporean English style. Don't overdo the slang.`;
  }
  return `Speak in standard English with minimal Singlish. You may occasionally use 'lah' or 'okay' in a Singaporean way, but keep the language clear and professional.`;
}

function buildSystemPrompt(caseData: CaseData): string {
  const singlishInstruction = getSinglishInstruction(caseData.singlish_level || "low");
  
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
${singlishInstruction}

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

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
