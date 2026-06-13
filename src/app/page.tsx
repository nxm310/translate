"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createSession() {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerName: "host" }),
      });
      const data = await res.json();
      router.push(`/session/${data.sessionId}/broadcast`);
    } catch (err) {
      console.error("Failed to create session:", err);
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Hero Section */}
        <div className="enter" style={{ marginBottom: "16px" }}>
          <div style={{ display: "inline-flex", padding: "8px 16px", borderRadius: "100px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", marginBottom: "24px" }}>
            <span className="label" style={{ color: "var(--accent)" }}>PROPULSÉ PAR GEMINI LIVE API</span>
          </div>
          <h1 className="display display-xl" style={{ marginBottom: 16 }}>
            Traduction<br/>Instantanée
          </h1>
          <p className="body enter-d1" style={{ maxWidth: 360, margin: "0 auto", fontSize: "18px" }}>
            Traduction vocale en temps réel dans plusieurs langues. Connectez-vous facilement avec votre public.
          </p>
        </div>

        {/* CTA */}
        <div className="enter-d2" style={{ padding: "0 16px", marginTop: "16px" }}>
          <button
            className="btn btn-primary"
            onClick={createSession}
            disabled={loading}
            id="create-session-btn"
          >
            {loading ? (
              <>
                <span className="spinner" /> Initialisation...
              </>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Démarrer la diffusion
              </>
            )}
          </button>
        </div>

        {/* Steps */}
        <div className="card enter-d3" style={{ marginTop: 40, textAlign: "left" }}>
          <h3 className="display" style={{ fontSize: "20px", marginBottom: "24px" }}>Comment ça marche</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {[
              { title: "Parlez naturellement", desc: "Votre voix est diffusée instantanément." },
              { title: "Partagez le lien", desc: "Les participants scannent un QR ou ouvrent le lien." },
              { title: "Traduction IA", desc: "Gemini traduit directement dans la langue de leur choix." }
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: "16px" }}>
                <div style={{ 
                  width: "28px", height: "28px", borderRadius: "50%", 
                  background: "var(--accent-soft)", color: "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", fontWeight: "bold", flexShrink: 0
                }}>
                  {i + 1}
                </div>
                <div>
                  <p className="body" style={{ color: "var(--fg)", fontWeight: "500", marginBottom: "4px" }}>{step.title}</p>
                  <p className="body-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
