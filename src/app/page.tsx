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
  
  const [apiKey, setApiKey] = useState("");
  const [needsApiKey, setNeedsApiKey] = useState(false);
  
  const clientRef = useRef<GeminiClient | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check local storage for API key on mount
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setNeedsApiKey(true);
    }
  }, []);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts]);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem("gemini_api_key", apiKey.trim());
      setNeedsApiKey(false);
    }
  };

  const startConversation = async () => {
    try {
      if (!apiKey) {
        setNeedsApiKey(true);
        return;
      }

      setSessionState("connecting");
      setErrorMsg("");
      setTranscripts([]);
      
      const ENGLISH_NAMES: Record<string, string> = {
        "en": "English", "fr": "French", "es": "Spanish", "de": "German", 
        "it": "Italian", "pt": "Portuguese", "zh": "Chinese", "ja": "Japanese", 
        "ko": "Korean", "ru": "Russian", "ar": "Arabic", "uk": "Ukrainian", "el": "Greek"
      };

      const engName1 = ENGLISH_NAMES[lang1] || lang1;
      const engName2 = ENGLISH_NAMES[lang2] || lang2;
      
      const systemInstruction = `You are a strict, real-time, bidirectional audio translator. The two spoken languages are ${engName1} and ${engName2}.
CRITICAL RULES:
1. If you hear ${engName1}, you MUST translate it into ${engName2}.
2. If you hear ${engName2}, you MUST translate it into ${engName1}.
3. You must NEVER speak English unless English is explicitly one of the two languages.
4. Do not answer questions or add commentary. Only output the direct translation.`;
      
      const client = new GeminiClient(apiKey, systemInstruction);
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

        {needsApiKey ? (
          <div className="card enter-d1" style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
            <h2 className="heading-lg">Clé API requise</h2>
            <p className="body-sm" style={{ color: "var(--fg-ghost)" }}>
              Pour utiliser cette application directement depuis GitHub Pages, veuillez entrer votre clé API Gemini. 
              Elle sera sauvegardée <b>uniquement</b> sur votre téléphone.
            </p>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 8 }}>Clé API Gemini</label>
              <input 
                type="password" 
                className="select-field" 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
                placeholder="AIzaSy..." 
                style={{ width: "100%", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
              />
            </div>
            <button className="btn btn-primary" onClick={saveApiKey} style={{ marginTop: 8 }}>
              Enregistrer
            </button>
          </div>
        ) : sessionState === "idle" ? (
          <div className="card enter-d1" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ width: "100%" }}>
                <label className="label" style={{ display: "block", marginBottom: 8, textAlign: "left" }}>Langue 1</label>
                <select className="select-field" value={lang1} onChange={(e) => setLang1(e.target.value)}>
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
              </div>
              
              <div style={{ display: "flex", justifyContent: "center", color: "var(--fg-ghost)", padding: "4px 0" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
              </div>
              
              <div style={{ width: "100%" }}>
                <label className="label" style={{ display: "block", marginBottom: 8, textAlign: "left" }}>Langue 2</label>
                <select className="select-field" value={lang2} onChange={(e) => setLang2(e.target.value)}>
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                </select>
              </div>
            </div>
            
            <button className="btn btn-primary" onClick={startConversation} style={{ marginTop: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
              Démarrer la conversation
            </button>
            
            <div style={{ marginTop: 8 }}>
              <button 
                className="btn-text" 
                onClick={() => setNeedsApiKey(true)}
                style={{ fontSize: 12, color: "var(--fg-ghost)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Changer de clé API
              </button>
            </div>
            
            {errorMsg && <p className="body-sm" style={{ color: "var(--error)", marginTop: 8 }}>{errorMsg}</p>}
          </div>
        ) : null}

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
