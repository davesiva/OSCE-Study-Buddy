import WebSocket, { WebSocketServer } from "ws";
import type { Server } from "node:http";
import type { IncomingMessage } from "node:http";

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
}

function buildVoiceInstructions(caseData: CaseData): string {

  return `You are a standardized patient in an OSCE (Objective Structured Clinical Examination) simulation for medical students. You are having a voice conversation with the student. Your goal is to behave like a REAL patient, not a textbook.

CHARACTER PROFILE:
- Name: ${caseData.patient_name || "Patient"}
- Age: ${caseData.age || "Unknown"} years old
- Gender: ${caseData.gender || "Unknown"}
- Chief Complaint: ${caseData.chief_complaint || "Not specified"}

PRESENTING HISTORY (your internal knowledge - reveal gradually):
${caseData.presenting_history || "Not provided"}

PAST MEDICAL HISTORY (your internal knowledge - reveal only when asked):
${(caseData.past_medical_history || ["Not provided"]).join("\n")}

SOCIAL HISTORY:
${caseData.social_history || "Not provided"}

ALLERGIES:
${caseData.allergies || "No known allergies"}

ACTING INSTRUCTIONS:
${caseData.script_instructions || "Act as a cooperative patient."}

SECRET INFORMATION (only reveal if directly asked relevant questions):
${caseData.secret_info || "None"}

CRITICAL - HOW TO RESPOND LIKE A REAL PATIENT:

1. USE EVERYDAY LANGUAGE, NOT MEDICAL TERMS:
   - Say "my tummy hurts" not "I have abdominal pain"
   - Say "the sugar problem" not "Type 2 Diabetes"
   - Say "some heart thing years ago" not "myocardial infarction"
   - Say "hurts quite bad" not "pain score 7 out of 10"
   - Say "the small white pill" not the medication name
   - Say "the cancer spread" not "Stage IV with metastases"

2. GIVE VAGUE, BRIEF INITIAL ANSWERS:
   - First response should be SHORT - just 1 sentence
   - "What brings you in?" → "My stomach's been hurting, doctor"
   - NOT a long detailed history all at once

3. REQUIRE PROBING - reveal details ONLY when specifically asked:
   - Give duration only if asked "How long?"
   - Give location details only if asked "Where exactly?"
   - Give character only if asked "What does it feel like?"
   - Don't mention pain scores unless asked to rate it

4. BE REALISTICALLY UNCERTAIN:
   - "I think it's called... lisi-something?" for medications
   - "Maybe 3 or 4 years ago?" for dates
   - "The doctor said something about my heart"

5. ANSWER ONLY WHAT IS ASKED:
   - If asked about pain, don't volunteer your bowel habits
   - Let the student extract information through questions

VOICE CONVERSATION RULES:
- Keep responses very brief - 1-2 sentences maximum
- Use natural speech: "um", "ah", pauses, hesitations
- Match vocal emotion: nervous, in pain, worried, confused
- Stay in character at all times
- If asked about vitals, say "The doctor can check that"
- Don't diagnose yourself or suggest conditions
- Redirect politely if asked something inappropriate`;
}

export function setupRealtimeWebSocket(server: Server): void {
  const wss = new WebSocketServer({ 
    server, 
    path: "/api/realtime" 
  });

  console.log("Realtime WebSocket server initialized on /api/realtime");

  wss.on("connection", (clientWs: WebSocket, _req: IncomingMessage) => {
    console.log("Client connected to realtime WebSocket");

    let openaiWs: WebSocket | null = null;
    let caseData: CaseData | null = null;
    let isSessionConfigured = false;

    clientWs.on("message", async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "session.configure") {
          caseData = message.caseData;
          console.log("Configuring session for case:", caseData?.patient_name);

          if (!process.env.OPENAI_API_KEY) {
            clientWs.send(JSON.stringify({
              type: "error",
              message: "OpenAI API key not configured"
            }));
            return;
          }

          openaiWs = new WebSocket(
            "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
            {
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "OpenAI-Beta": "realtime=v1",
              },
            }
          );

          openaiWs.on("open", () => {
            console.log("Connected to OpenAI Realtime API");

            const patientGender = caseData?.gender?.toLowerCase() || "";
            const isMale = patientGender === "male" || patientGender === "m";
            const selectedVoice = isMale ? "echo" : "coral";
            console.log(`Patient gender: ${caseData?.gender}, using voice: ${selectedVoice}`);

            const sessionConfig = {
              type: "session.update",
              session: {
                modalities: ["text", "audio"],
                instructions: buildVoiceInstructions(caseData!),
                voice: selectedVoice,
                input_audio_format: "pcm16",
                output_audio_format: "pcm16",
                input_audio_transcription: {
                  model: "whisper-1",
                },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.6,
                  prefix_padding_ms: 500,
                  silence_duration_ms: 1200,
                },
              },
            };

            openaiWs!.send(JSON.stringify(sessionConfig));
            isSessionConfigured = true;

            clientWs.send(JSON.stringify({
              type: "session.ready",
              message: "Voice session ready"
            }));
          });

          openaiWs.on("message", (data: WebSocket.Data) => {
            try {
              const event = JSON.parse(data.toString());

              if (event.type === "response.audio.delta") {
                clientWs.send(JSON.stringify({
                  type: "audio.delta",
                  delta: event.delta,
                }));
              } else if (event.type === "response.audio.done") {
                clientWs.send(JSON.stringify({
                  type: "audio.done",
                }));
              } else if (event.type === "response.audio_transcript.delta") {
                clientWs.send(JSON.stringify({
                  type: "transcript.delta",
                  role: "assistant",
                  delta: event.delta,
                }));
              } else if (event.type === "response.audio_transcript.done") {
                clientWs.send(JSON.stringify({
                  type: "transcript.done",
                  role: "assistant",
                  transcript: event.transcript,
                }));
              } else if (event.type === "conversation.item.input_audio_transcription.completed") {
                clientWs.send(JSON.stringify({
                  type: "transcript.done",
                  role: "user",
                  transcript: event.transcript,
                }));
              } else if (event.type === "input_audio_buffer.speech_started") {
                clientWs.send(JSON.stringify({
                  type: "speech.started",
                }));
              } else if (event.type === "input_audio_buffer.speech_stopped") {
                clientWs.send(JSON.stringify({
                  type: "speech.stopped",
                }));
              } else if (event.type === "response.done") {
                clientWs.send(JSON.stringify({
                  type: "response.done",
                }));
              } else if (event.type === "error") {
                console.error("OpenAI error:", event.error);
                clientWs.send(JSON.stringify({
                  type: "error",
                  message: event.error?.message || "Unknown error from OpenAI",
                }));
              }
            } catch (e) {
              console.error("Error parsing OpenAI message:", e);
            }
          });

          openaiWs.on("error", (error: Error) => {
            console.error("OpenAI WebSocket error:", error);
            clientWs.send(JSON.stringify({
              type: "error",
              message: "Connection error with AI service",
            }));
          });

          openaiWs.on("close", () => {
            console.log("OpenAI WebSocket closed");
            clientWs.send(JSON.stringify({
              type: "session.closed",
            }));
          });

        } else if (message.type === "audio.append") {
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
              type: "input_audio_buffer.append",
              audio: message.audio,
            }));
          }
        } else if (message.type === "audio.commit") {
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
              type: "input_audio_buffer.commit",
            }));
            openaiWs.send(JSON.stringify({
              type: "response.create",
            }));
          }
        } else if (message.type === "response.cancel") {
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
              type: "response.cancel",
            }));
          }
        }
      } catch (e) {
        console.error("Error processing client message:", e);
      }
    });

    clientWs.on("close", () => {
      console.log("Client disconnected from realtime WebSocket");
      if (openaiWs) {
        openaiWs.close();
      }
    });

    clientWs.on("error", (error: Error) => {
      console.error("Client WebSocket error:", error);
      if (openaiWs) {
        openaiWs.close();
      }
    });
  });
}
