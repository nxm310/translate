"use client";

import { useEffect, useState, useCallback, use } from "react";
import {
  LiveKitRoom,
  useLocalParticipant,
  useRoomContext,
  useRemoteParticipants,
  TrackToggle,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import SessionQRCode from "@/components/SessionQRCode";

interface TranslationInfo {
  language: string;
  translatorIdentity: string;
  status: string;
  subscriberCount: number;
}

const FLAGS: Record<string, string> = {
  en: "🇺🇸", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹",
  pt: "🇧🇷", ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳", ar: "🇸🇦",
  hi: "🇮🇳", ru: "🇷🇺", tr: "🇹🇷", nl: "🇳🇱", pl: "🇵🇱", sv: "🇸🇪",
};

const LANG_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ja: "Japanese", ko: "Korean", zh: "Chinese", ar: "Arabic",
  hi: "Hindi", ru: "Russian", tr: "Turkish", nl: "Dutch", pl: "Polish", sv: "Swedish",
};

function BroadcastControls({ sessionId }: { sessionId: string }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [isMicOn, setIsMicOn] = useState(false);
  const audioTracks = useTracks([Track.Source.Microphone]);
  const remoteParticipants = useRemoteParticipants();

  // Count only real attendees, not translator bots
  const listenerCount = remoteParticipants.filter(
    (p) => !p.identity.startsWith("translator-")
  ).length;

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/session/${sessionId}/watch`
      : "";

  const fetchTranslations = useCallback(async () => {
    try {
      const res = await fetch(`/api/translate/status?sessionId=${sessionId}`);
      const data = await res.json();
      setTranslations(data.translations || []);
    } catch (err) {
      console.error("Failed to fetch translations:", err);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchTranslations();
    const interval = setInterval(fetchTranslations, 3000);
    return () => clearInterval(interval);
  }, [fetchTranslations]);

  useEffect(() => {
    const hasAudio = audioTracks.some(
      (t) => t.participant.identity === localParticipant.identity
    );
    setIsMicOn(hasAudio);
  }, [audioTracks, localParticipant.identity]);

  return (
    <div className="container page-top">
      <div className="card enter">
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <h1 className="display display-md" style={{ marginBottom: 8, background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Diffusion en cours
          </h1>
          <div style={{ display: "inline-flex", padding: "4px 12px", background: "rgba(255,255,255,0.05)", borderRadius: "100px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="mono" style={{ fontSize: "11px", letterSpacing: "1px" }}>{sessionId}</p>
          </div>
        </div>

        {/* Mic status */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              background: "rgba(0,0,0,0.2)",
              padding: "16px 20px",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.05)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div className={`waveform ${isMicOn ? "active" : "idle"}`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="waveform-bar" />
                ))}
              </div>
              <span className={`status ${isMicOn ? "status--active" : ""}`} style={{ color: isMicOn ? "" : "var(--fg-ghost)" }}>
                <span className={`status-dot ${isMicOn ? "pulse" : ""}`} />
                {isMicOn ? "En direct" : "Muet"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg-secondary)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span className="mono" style={{ fontSize: "14px", fontWeight: "500" }}>{listenerCount}</span>
            </div>
          </div>

          <TrackToggle
            source={Track.Source.Microphone}
            className={`btn ${isMicOn ? 'btn-danger' : 'btn-primary'}`}
            style={{ borderRadius: "16px" }}
          />
        </div>

        <hr className="rule" style={{ margin: "24px 0" }} />

        {/* QR code */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <span className="label">Partager avec les participants</span>
          <div style={{ padding: "16px", background: "white", borderRadius: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <SessionQRCode url={joinUrl} size={160} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", padding: "8px 16px", borderRadius: "100px" }}>
            <p className="mono" style={{ fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>
              {joinUrl}
            </p>
            <button 
              onClick={() => navigator.clipboard.writeText(joinUrl)}
              style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </div>

        <hr className="rule" style={{ margin: "24px 0" }} />

        {/* Active translations */}
        <div>
          <span className="label" style={{ marginBottom: 16, display: "block" }}>
            Traductions actives ({translations.length})
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {translations.length === 0 ? (
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "16px", padding: "20px", textAlign: "center" }}>
                <p className="body-sm italic" style={{ opacity: 0.6 }}>
                  Aucune traduction active.<br/>Les participants peuvent les demander depuis leurs appareils.
                </p>
              </div>
            ) : (
              translations.map((t) => (
                <div key={t.language} className="lang-row">
                  <div className="lang-row-left">
                    <span className="lang-flag">{FLAGS[t.language] || "🌐"}</span>
                    <span className="lang-name">
                      {LANG_NAMES[t.language] || t.language.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="lang-meta" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      {t.subscriberCount}
                    </span>
                    <span className={`status status--${t.status === "active" ? "active" : "waiting"}`} style={{ padding: "4px 8px", fontSize: "10px" }}>
                      <span className="status-dot pulse" />
                      {t.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          <button
            className="btn btn-outline"
            onClick={() => {
              room.disconnect();
              window.location.href = "/";
            }}
            style={{ width: "100%", borderColor: "rgba(239, 68, 68, 0.3)", color: "var(--error)" }}
          >
            Terminer la diffusion
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BroadcastPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const [token, setToken] = useState("");
  const [livekitUrl, setLivekitUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchToken() {
      try {
        const identity = `organizer-host`;
        const res = await fetch(
          `/api/token?room=${sessionId}&identity=${identity}&role=organizer`
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setToken(data.token);
        setLivekitUrl(data.serverUrl);
      } catch (err) {
        setError((err as Error).message);
      }
    }
    fetchToken();
  }, [sessionId]);

  if (error) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: "center", maxWidth: 400 }}>
          <p className="display display-md" style={{ marginBottom: 16 }}>
            Échec de la connexion
          </p>
          <p className="body-sm" style={{ marginBottom: 32 }}>{error}</p>
          <button className="btn btn-outline" onClick={() => (window.location.href = "/")}>
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (!token || !livekitUrl) {
    return (
      <div className="page">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div className="spinner" />
          <p className="mono">Initialisation de la session...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <LiveKitRoom
        video={false}
        audio={true}
        token={token}
        serverUrl={livekitUrl}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          minHeight: "100vh"
        }}
        onDisconnected={() => {
          setError("Déconnecté de la session LiveKit. Veuillez vérifier votre connexion.");
        }}
      >
        <BroadcastControls sessionId={sessionId} />
      </LiveKitRoom>
    </div>
  );
}
