"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
  useRemoteParticipants,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, RoomEvent } from "livekit-client";
import LanguageSelector from "./components/LanguageSelector";

interface TranscriptEntry {
  id: string;
  text: string;
  language: string;
  final: boolean;
  timestamp: number;
}

function AttendeeView({ sessionId }: { sessionId: string }) {
  const room = useRoomContext();
  const [currentLanguage, setCurrentLanguage] = useState("original");
  const [translatorIdentity, setTranslatorIdentity] = useState<string | null>(null);
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const currentLanguageRef = useRef(currentLanguage);
  const remoteParticipants = useRemoteParticipants();
  const audioTracks = useTracks([Track.Source.Microphone]);

  const organizerParticipant = remoteParticipants.find((p) =>
    p.identity.startsWith("organizer-")
  );

  useEffect(() => {
    if (!room) return;
    const handleData = (
      payload: Uint8Array,
      participant: unknown,
      kind: unknown,
      topic: string | undefined,
    ) => {
      if (topic !== "transcription") return;
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type !== "transcription") return;
        if (data.language !== currentLanguageRef.current) return;

        setTranscripts((prev) => {
          const existing = prev.findIndex((t) => t.id === data.segmentId);
          const entry: TranscriptEntry = {
            id: data.segmentId,
            text: data.text,
            language: data.language,
            final: data.final,
            timestamp: data.timestamp,
          };
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = {
              ...updated[existing],
              text: updated[existing].text + data.text,
              final: data.final,
            };
            return updated;
          }
          const next = [...prev, entry];
          return next.slice(-50);
        });
      } catch {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  useEffect(() => {
    if (!room) return;
    const updateSubscriptions = () => {
      const participants = room.remoteParticipants;
      for (const [, participant] of participants) {
        const isOrganizer = participant.identity.startsWith("organizer-");
        const isSelectedTranslator = translatorIdentity && participant.identity === translatorIdentity;
        for (const [, pub] of participant.trackPublications) {
          if (pub.kind === Track.Kind.Audio) {
            if (currentLanguage === "original") {
              pub.setSubscribed(isOrganizer);
            } else {
              pub.setSubscribed(!!isSelectedTranslator);
            }
          }
        }
      }
    };
    updateSubscriptions();
    const handleUpdate = () => updateSubscriptions();
    room.on(RoomEvent.TrackPublished, handleUpdate);
    room.on(RoomEvent.ParticipantConnected, handleUpdate);
    return () => {
      room.off(RoomEvent.TrackPublished, handleUpdate);
      room.off(RoomEvent.ParticipantConnected, handleUpdate);
    };
  }, [room, currentLanguage, translatorIdentity, remoteParticipants]);

  useEffect(() => {
    const hasAudio = audioTracks.some((t) => {
      const pub = t.publication;
      if (currentLanguage === "original") {
        return t.participant.identity.startsWith("organizer-") && pub.isSubscribed;
      } else {
        return translatorIdentity && t.participant.identity === translatorIdentity && pub.isSubscribed;
      }
    });
    setIsReceivingAudio(hasAudio);
  }, [audioTracks, currentLanguage, translatorIdentity]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentLanguageRef.current && currentLanguageRef.current !== "original") {
        const body = JSON.stringify({
          sessionId,
          targetLanguage: currentLanguageRef.current,
        });
        navigator.sendBeacon(
          "/api/translate/unsubscribe",
          new Blob([body], { type: "application/json" })
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [sessionId]);

  const handleLanguageChange = useCallback(
    (langCode: string, newTranslatorIdentity: string | null) => {
      const prev = currentLanguageRef.current;
      if (prev && prev !== "original" && prev !== langCode) {
        fetch("/api/translate/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, targetLanguage: prev }),
        }).catch(() => {});
      }
      setCurrentLanguage(langCode);
      currentLanguageRef.current = langCode;
      setTranslatorIdentity(newTranslatorIdentity);
      setTranscripts([]);
    },
    [sessionId]
  );

  const isConnected = organizerParticipant !== undefined;

  return (
    <div className="container page-top">
      <div className="card enter">
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <h1 className="display display-md" style={{ marginBottom: 8, background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Session en direct
          </h1>
          <div style={{ display: "inline-flex", padding: "4px 12px", background: "rgba(255,255,255,0.05)", borderRadius: "100px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="mono" style={{ fontSize: "11px", letterSpacing: "1px" }}>{sessionId}</p>
          </div>
        </div>

        {/* Visualizer & Status */}
        <div style={{ 
          background: "rgba(0,0,0,0.2)", 
          borderRadius: "20px", 
          padding: "24px", 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          gap: "20px",
          marginBottom: "24px",
          border: "1px solid rgba(255,255,255,0.05)"
        }}>
          <div className={`waveform ${isReceivingAudio ? "active" : "idle"}`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="waveform-bar" />
            ))}
          </div>

          {isConnected ? (
            <span className="status status--active">
              <span className="status-dot pulse" />
              {currentLanguage === "original"
                ? "Écoute en direct"
                : `Traduction : ${currentLanguage.toUpperCase()}`}
            </span>
          ) : (
            <span className="status status--waiting">
              <span className="status-dot pulse" />
              En attente du diffuseur
            </span>
          )}
        </div>

        {/* Language selector */}
        <div style={{ marginBottom: "24px" }}>
          <LanguageSelector
            sessionId={sessionId}
            currentLanguage={currentLanguage}
            onLanguageChange={handleLanguageChange}
          />
        </div>

        {/* Transcription output */}
        <div>
          <span className="label" style={{ display: "block", marginBottom: 12 }}>
            Transcription en direct
          </span>

          <div
            style={{
              height: 250,
              overflowY: "auto",
              paddingRight: 4,
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            {transcripts.length === 0 ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p className="body-sm italic" style={{ textAlign: "center", opacity: 0.7 }}>
                  {currentLanguage === "original"
                    ? "Sélectionnez une langue pour voir la traduction."
                    : "En attente de voix..."}
                </p>
              </div>
            ) : (
              transcripts.map((t, i) => (
                <div
                  key={`${t.id}-${i}`}
                  className={`transcript-bubble ${!t.final ? "partial" : ""}`}
                >
                  {t.text}
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const [token, setToken] = useState("");
  const [livekitUrl, setLivekitUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    async function fetchToken() {
      try {
        const identity = `attendee-${Math.random().toString(36).slice(2, 8)}`;
        const res = await fetch(
          `/api/token?room=${sessionId}&identity=${identity}&role=attendee`
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
          <button className="btn btn-outline" onClick={() => window.location.reload()}>
            Réessayer la connexion
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
          <p className="mono">Rejoindre la session...</p>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="page">
        <div className="card enter" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
          </div>
          <h1 className="display display-md" style={{ marginBottom: 16 }}>
            Prêt à écouter
          </h1>
          <p className="body-sm" style={{ marginBottom: 40, maxWidth: 280, margin: "0 auto 40px" }}>
            Appuyez ci-dessous pour rejoindre la session en direct et activer le son.
          </p>
          <button className="btn btn-primary" onClick={() => setStarted(true)}>
            Commencer l'écoute
          </button>
          <p className="mono" style={{ marginTop: 32, fontSize: 11, opacity: 0.5 }}>
            ID de session : {sessionId}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <LiveKitRoom
        video={false}
        audio={false}
        token={token}
        serverUrl={livekitUrl}
        connectOptions={{ autoSubscribe: false }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          minHeight: "100vh"
        }}
      >
        <RoomAudioRenderer />
        <AttendeeView sessionId={sessionId} />
      </LiveKitRoom>
    </div>
  );
}
