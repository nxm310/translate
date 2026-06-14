"use client";

import { useState, useRef, useEffect } from "react";
import { GeminiClient } from "@/lib/gemini-client";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";

interface Transcript {
  id: string;
  text: string;
  isFinal: boolean;
  lang: string;
}

export default function Home() {
  const [lang1, setLang1] = useState("fr");
  const [lang2, setLang2] = useState("en");
  
  const [sessionState, setSessionState] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [apiKey, setApiKey] = useState("");
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  
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
      
      const client = new GeminiClient(apiKey, lang1, lang2);
      clientRef.current = client;
      
      client.onStateChange = (state) => setSessionState(state);
      client.onError = (err) => setErrorMsg(err);
      client.onVolumeChange = (vol) => setMicVolume(vol);
      
      client.onTranscript = (text, isFinal, targetLang) => {
        setTranscripts((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.isFinal || last.lang !== targetLang) {
            const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            return [...prev, { id, text, isFinal, lang: targetLang }];
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

  const stopConversation = async () => {
    if (clientRef.current) {
      await clientRef.current.disconnect();
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
              <div className="waveform active" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, height: 40, margin: "16px 0" }}>
                {Array.from({ length: 9 }).map((_, i) => {
                  const factor = 1 - Math.abs(i - 4) * 0.15;
                  const height = sessionState === "connected" 
                    ? Math.max(4, Math.round(micVolume * factor * 0.4)) 
                    : 6;
                  return (
                    <div 
                      key={i} 
                      className="waveform-bar"
                      style={{ 
                        width: 4, 
                        height: `${height}px`, 
                        borderRadius: 2, 
                        background: sessionState === "connected" ? "var(--accent)" : "var(--fg-ghost)",
                        transition: "height 0.05s ease",
                        boxShadow: sessionState === "connected" ? "0 0 8px var(--accent-soft)" : "none",
                        animation: "none"
                      }} 
                    />
                  );
                })}
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
                transcripts.map((t, i) => {
                  const langObj = SUPPORTED_LANGUAGES.find(l => l.code === t.lang);
                  const flag = langObj ? langObj.flag : "";
                  return (
                    <div key={`${t.id}-${i}`} className={`transcript-bubble ${!t.isFinal ? "partial" : ""}`} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 20 }}>{flag}</span>
                      <div style={{ flex: 1 }}>{t.text}</div>
                    </div>
                  );
                })
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
