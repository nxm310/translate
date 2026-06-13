"use client";

import { useState, useRef, useEffect } from "react";
import { GeminiClient } from "@/lib/gemini-client";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";

interface Transcript {
  id: string;
  text: string;
  isFinal: boolean;
}

export default function Home() {
  const [lang1, setLang1] = useState("fr");
  const [lang2, setLang2] = useState("en");
  
  const [sessionState, setSessionState] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  
  const clientRef = useRef<GeminiClient | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts]);

  const startConversation = async () => {
    try {
      setSessionState("connecting");
      setErrorMsg("");
      setTranscripts([]);
      
      const res = await fetch("/api/env");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const name1 = SUPPORTED_LANGUAGES.find(l => l.code === lang1)?.name || lang1;
      const name2 = SUPPORTED_LANGUAGES.find(l => l.code === lang2)?.name || lang2;
      
      const systemInstruction = `You are a bilingual real-time translator. The two people talking are speaking ${name1} and ${name2}. Listen carefully, detect which language is being spoken, and immediately translate it naturally to the other language. Speak the translation out loud. Keep it conversational and concise. Do not add any extra commentary.`;
      
      const client = new GeminiClient(data.apiKey, systemInstruction);
      clientRef.current = client;
      
      client.onStateChange = (state) => setSessionState(state);
      client.onError = (err) => setErrorMsg(err);
      
      let currentId = Date.now().toString();
      client.onTranscript = (text, isFinal) => {
        setTranscripts((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.isFinal) {
            currentId = Date.now().toString();
            return [...prev, { id: currentId, text, isFinal }];
          } else {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, text: last.text + " " + text, isFinal };
            return updated;
          }
        });
      };
      
      await client.connect();
    } catch (err: any) {
      setSessionState("error");
      setErrorMsg(err.message || "Failed to connect");
    }
  };

  const stopConversation = () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setSessionState("idle");
  };

  return (
    <div className="page page-top">
      <div className="container" style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Header */}
        <div className="enter" style={{ marginBottom: "16px" }}>
          <div style={{ display: "inline-flex", padding: "8px 16px", borderRadius: "100px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", marginBottom: "24px" }}>
            <span className="label" style={{ color: "var(--accent)" }}>TRADUCTEUR DE POCHE IA</span>
          </div>
          <h1 className="display display-xl" style={{ marginBottom: 16 }}>
            Traduction<br/>Instantanée
          </h1>
        </div>

        {sessionState === "idle" && (
          <div className="card enter-d1" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="label" style={{ display: "block", marginBottom: 8, textAlign: "left" }}>Moi</label>
                <select className="select-field" value={lang1} onChange={(e) => setLang1(e.target.value)}>
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name} {l.flag}</option>)}
                </select>
              </div>
              
              <div style={{ padding: "0 8px", color: "var(--fg-ghost)", alignSelf: "flex-end", marginBottom: 12 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3v18M10 10l7-7 7 7M7 21V3M14 14l-7 7-7-7"/></svg>
              </div>
              
              <div style={{ flex: 1 }}>
                <label className="label" style={{ display: "block", marginBottom: 8, textAlign: "left" }}>Autre personne</label>
                <select className="select-field" value={lang2} onChange={(e) => setLang2(e.target.value)}>
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name} {l.flag}</option>)}
                </select>
              </div>
            </div>
            
            <button className="btn btn-primary" onClick={startConversation} style={{ marginTop: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
              Démarrer la conversation
            </button>
            {errorMsg && <p className="body-sm" style={{ color: "var(--error)", marginTop: 8 }}>{errorMsg}</p>}
          </div>
        )}

        {(sessionState === "connecting" || sessionState === "connected") && (
          <div className="card enter">
            <div style={{ marginBottom: 24 }}>
              <div className={`waveform ${sessionState === "connected" ? "active" : "idle"}`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="waveform-bar" />
                ))}
              </div>
              <span className={`status ${sessionState === "connected" ? "status--active" : "status--waiting"}`} style={{ marginTop: 24, display: "inline-flex" }}>
                <span className="status-dot pulse" />
                {sessionState === "connecting" ? "Connexion à Gemini..." : "Écoute en cours..."}
              </span>
            </div>
            
            <div style={{ height: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: 8, background: "rgba(0,0,0,0.2)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)", textAlign: "left" }}>
              {transcripts.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p className="body-sm italic" style={{ opacity: 0.5 }}>Posez le téléphone entre vous et parlez.</p>
                </div>
              ) : (
                transcripts.map((t, i) => (
                  <div key={`${t.id}-${i}`} className={`transcript-bubble ${!t.isFinal ? "partial" : ""}`}>
                    {t.text}
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
            
            <button className="btn btn-outline" onClick={stopConversation} style={{ marginTop: 24, width: "100%", borderColor: "rgba(239, 68, 68, 0.3)", color: "var(--error)" }}>
              Terminer
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
