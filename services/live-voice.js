const { WebSocketServer, WebSocket } = require("ws");

const { supabaseAdmin } = require("./supabase");
const env = require("../config/env");


/*
|--------------------------------------------------------------------------
| GEMINI LIVE VOICE RELAY
|--------------------------------------------------------------------------
|
| This is intentionally a "dumb" relay. It does NOT understand or
| reshape the Gemini Live protocol — it only:
|
| 1. Authenticates the incoming connection using the same Supabase
|    session tokens the rest of the API uses.
| 2. Opens a matching WebSocket to Gemini's Live API, using
|    GEMINI_API_KEY, which never reaches the browser.
| 3. Forwards every message the client sends straight to Gemini,
|    and every message Gemini sends straight back to the client.
|
| Keeping it this dumb means the frontend can evolve its audio
| handling independently, without ever requiring backend changes
| again once this relay is confirmed working.
|
*/

const GEMINI_LIVE_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";


function attachLiveVoiceRelay(server) {

  const wss = new WebSocketServer({
    server,
    path: "/ws/live"
  });

  wss.on(
    "connection",
    async (clientSocket, request) => {

      try {

        /*
         * Browsers can't send custom headers on a WebSocket
         * handshake, so the Supabase access token is passed as
         * a query param instead: wss://host/ws/live?token=...
         */

        const url = new URL(
          request.url,
          `http://${request.headers.host}`
        );

        const token = url.searchParams.get("token");

        if (!token) {
          clientSocket.close(4401, "Authentication required.");
          return;
        }

        const {
          data,
          error
        } = await supabaseAdmin.auth.getUser(token);

        if (error || !data?.user) {
          clientSocket.close(4401, "Invalid or expired session.");
          return;
        }

        if (!env.geminiApiKey) {
          clientSocket.close(
            4503,
            "Gemini Live is not configured on this server."
          );
          return;
        }


        /*
         * Open the upstream connection to Gemini.
         */

        const geminiSocket = new WebSocket(
          `${GEMINI_LIVE_WS_URL}?key=${env.geminiApiKey}`
        );

        let clientClosed = false;
        let geminiClosed = false;


        geminiSocket.on(
          "message",
          (data) => {
            if (clientSocket.readyState === WebSocket.OPEN) {
              clientSocket.send(data);
            }
          }
        );

        geminiSocket.on(
          "close",
          () => {
            geminiClosed = true;
            if (
              !clientClosed &&
              clientSocket.readyState === WebSocket.OPEN
            ) {
              clientSocket.close();
            }
          }
        );

        geminiSocket.on(
          "error",
          (err) => {
            console.error(
              "Gemini Live upstream error:",
              err.message
            );
          }
        );


        clientSocket.on(
          "message",
          (data) => {
            if (geminiSocket.readyState === WebSocket.OPEN) {
              geminiSocket.send(data);
            }
          }
        );

        clientSocket.on(
          "close",
          () => {
            clientClosed = true;
            if (
              !geminiClosed &&
              geminiSocket.readyState === WebSocket.OPEN
            ) {
              geminiSocket.close();
            }
          }
        );

        clientSocket.on(
          "error",
          (err) => {
            console.error(
              "Client Live socket error:",
              err.message
            );
          }
        );

      } catch (err) {

        console.error(
          "Live voice relay error:",
          err
        );

        try {
          clientSocket.close(1011, "Internal error.");
        } catch (_) {
          // socket may already be closed
        }
      }
    }
  );

  return wss;
}


module.exports = {
  attachLiveVoiceRelay
};
      
