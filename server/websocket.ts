
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

export function setupWebSocket(server: Server) {
    const wss = new WebSocketServer({ server, path: "/gemini-live" });

    wss.on("connection", (ws: WebSocket) => {
        console.log("Client connected to Gemini Live Proxy");

        // Connect to Gemini Live API
        // Note: Gemini Live API endpoint requires authentication and specific handshake.
        // For this implementation, we will act as a passthrough proxy.
        // The client sends the "setup" message with the key? Or we inject it?
        // Using a library like 'ws' to connect to 'wss://...'

        let geminiWs: WebSocket | null = null;

        try {
            const geminiUrl = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=" + process.env.GEMINI_API_KEY;
            geminiWs = new WebSocket(geminiUrl);

            geminiWs.on("open", () => {
                console.log("Connected to Google Gemini Live API");
            });

            geminiWs.on("message", (data) => {
                // Forward message from Gemini to Client
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(data);
                }
            });

            geminiWs.on("error", (err) => {
                console.error("Gemini WebSocket Error:", err);
                ws.close();
            });

            geminiWs.on("close", () => {
                console.log("Gemini WebSocket Closed");
                ws.close();
            });

        } catch (e) {
            console.error("Failed to connect to Gemini:", e);
            ws.close();
        }

        ws.on("message", (data) => {
            // Forward message from Client to Gemini
            if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
                geminiWs.send(data);
            }
        });

        ws.on("close", () => {
            console.log("Client disconnected");
            if (geminiWs) geminiWs.close();
        });
    });
}
