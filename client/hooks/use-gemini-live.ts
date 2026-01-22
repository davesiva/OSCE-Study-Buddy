
import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";

interface UseGeminiLiveProps {
    onTranscript?: (text: string, isUser: boolean) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: string) => void;
}

export function useGeminiLive({ onTranscript, onConnect, onDisconnect, onError }: UseGeminiLiveProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false); // Is AI speaking?

    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null); // Fallback to ScriptProcessor for broader compatibility
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const playbackNextStartTimeRef = useRef<number>(0);

    // Connect
    const connect = useCallback(async () => {
        try {
            if (wsRef.current?.readyState === WebSocket.OPEN) return;

            // Determine correct WS URL (localhost vs production)
            // Assuming Vite proxy handles /gemini-live or we connect to the server port directly
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/gemini-live`;

            console.log("Connecting to Gemini Live Proxy:", wsUrl);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("WS Connected");
                setIsConnected(true);
                onConnect?.();

                // Send Setup Message
                // Gemini Live needs a "setup" message to define the model and voice config.
                // However, we are proxying raw traffic. The setup message format:
                // { setup: { model: "models/gemini-2.0-flash-exp", generationConfig: { ... } } }
                // Note: For now we rely on default or send a basic setup.
                const setupMessage = {
                    setup: {
                        model: "models/gemini-2.0-flash-exp",
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: {
                                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } // "Aoede" is a good voice
                            }
                        }
                    }
                };
                ws.send(JSON.stringify(setupMessage));
            };

            ws.onmessage = async (event) => {
                // Handle incoming messages (JSON or Blob)
                // Gemini sends Text (JSON) or Binary (Audio)

                let data = event.data;
                if (data instanceof Blob) {
                    // Audio Data! Play it!
                    playAudioChunk(await data.arrayBuffer());
                    setIsSpeaking(true);
                } else if (typeof data === "string") {
                    // JSON control message
                    try {
                        const msg = JSON.parse(data);
                        // Handle "turnComplete" or transcriptions if Gemini provides them (server-side VAD might send events)
                        if (msg.serverContent?.modelTurn?.parts) {
                            // Text transcript (optional)
                        }
                    } catch (e) {
                        // Might be partial JSON
                    }
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                onDisconnect?.();
            };

            ws.onerror = (e) => {
                console.error("WS Error", e);
                onError?.("Connection error");
            };

            // Initialize Audio setup
            await startAudioStream();

        } catch (e: any) {
            console.error(e);
            onError?.(e.message);
        }
    }, []);

    const disconnect = useCallback(() => {
        wsRef.current?.close();
        stopAudioStream();
        setIsConnected(false);
    }, []);

    // Audio Recording (Stream to Server)
    const startAudioStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000, // Gemini prefers 16k
                }
            });

            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);

            // Use ScriptProcessor for recording (simple and works for 16k mono)
            // Buffer size 2048 or 4096 is good balance for latency vs CPU
            processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(audioContextRef.current.destination);

            processorRef.current.onaudioprocess = (e) => {
                if (wsRef.current?.readyState !== WebSocket.OPEN) return;

                // Get standard PCM
                const inputData = e.inputBuffer.getChannelData(0);

                // Convert Float32 (-1 to 1) to Int16 (PCM)
                // Gemini expects "realtime_input" with "media_chunks" for audio
                // The protocol expects JSON wrapper usually: 
                // { realtime_input: { media_chunks: [{ mime_type: "audio/pcm", data: BASE64 }] } }
                // Let's create the message.

                const pcmData = floatTo16BitPCM(inputData);
                const base64Audio = arrayBufferToBase64(pcmData.buffer);

                const msg = {
                    realtime_input: {
                        media_chunks: [
                            {
                                mime_type: "audio/pcm",
                                data: base64Audio
                            }
                        ]
                    }
                };
                wsRef.current.send(JSON.stringify(msg));
            };

        } catch (e) {
            console.error("Mic Error", e);
            throw e;
        }
    };

    const stopAudioStream = () => {
        sourceRef.current?.disconnect();
        processorRef.current?.disconnect();
        audioContextRef.current?.close();
    };

    // Audio Playback
    const playAudioChunk = (arrayBuffer: ArrayBuffer) => {
        // Decode raw PCM? 
        // Gemini sends raw PCM usually if configured, or wav.
        // If setup requested "audio/pcm", we get pcm.
        // Actually default response might be PCM 24kHz or 16kHz Little Endian.
        // Let's assume PCM 24kHz for now (standard for Gemini Live).

        if (!audioContextRef.current) return;

        const float32Data = pcm16ToFloat32(new Int16Array(arrayBuffer));
        const buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000); // 24kHz is standard Gemini output
        buffer.copyToChannel(float32Data, 0);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);

        // Simple queueing
        const now = audioContextRef.current.currentTime;
        const start = Math.max(now, playbackNextStartTimeRef.current);
        source.start(start);
        playbackNextStartTimeRef.current = start + buffer.duration;

        source.onended = () => {
            // Check if queue empty?
            if (audioContextRef.current?.currentTime && audioContextRef.current.currentTime >= playbackNextStartTimeRef.current) {
                setIsSpeaking(false);
            }
        };
    };

    return { connect, disconnect, isConnected, isSpeaking };
}

// Helpers
function floatTo16BitPCM(input: Float32Array) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

function pcm16ToFloat32(input: Int16Array) {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
        output[i] = input[i] / 32768.0;
    }
    return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}
