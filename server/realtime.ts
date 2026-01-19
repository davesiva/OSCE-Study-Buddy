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
  singlish_level: string;
  expected_diagnosis: string;
}

function getSinglishInstruction(level: string): string {
  if (level === "high") {
    return `Use heavy Singlish expressions naturally. Include common phrases like 'lah', 'leh', 'lor', 'sia', 'can or not', 'how come', 'aiyo', 'walao'. Mix English with occasional Chinese/Malay words. Speak in a very casual, local Singaporean manner.`;
  } else if (level === "moderate") {
    return `Use moderate Singlish. Include occasional 'lah', 'leh', 'lor' at the end of sentences. Speak in a casual but understandable Singaporean English style. Don't overdo the slang.`;
  }
  return `Speak in standard English with minimal Singlish. You may occasionally use 'lah' or 'okay' in a Singaporean way, but keep the language clear and professional.`;
}

function buildVoiceInstructions(caseData: CaseData): string {
  const singlishInstruction = getSinglishInstruction(caseData.singlish_level || "low");

  return `You are a standardized patient in an OSCE (Objective Structured Clinical Examination) simulation for medical students. You are having a voice conversation with the student.

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

ACTING INSTRUCTIONS:
${caseData.script_instructions || "Act as a cooperative patient."}

SECRET INFORMATION (only reveal if directly asked relevant questions):
${caseData.secret_info || "None"}

LANGUAGE STYLE:
${singlishInstruction}

VOICE CONVERSATION RULES:
1. Stay in character at all times as the patient
2. Only provide information when asked - don't volunteer everything at once
3. Show appropriate emotions (pain, anxiety, etc.) through your voice tone
4. If asked about vitals or examination findings, say "The doctor or nurse can check that"
5. Do not diagnose yourself or suggest what condition you might have
6. Respond naturally as a real patient would - be conversational
7. Keep responses brief and natural for spoken conversation (1-2 sentences)
8. Use natural speech patterns with fillers like "um", "ah", pauses
9. If the student asks something inappropriate, redirect politely as a patient would
10. Match your vocal emotion to your character's state - nervous, in pain, worried, etc.`;
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

            const sessionConfig = {
              type: "session.update",
              session: {
                modalities: ["text", "audio"],
                instructions: buildVoiceInstructions(caseData!),
                voice: "shimmer",
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
