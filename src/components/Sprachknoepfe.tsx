"use client";

import { useEffect, useRef, useState } from "react";
import { aufnehmen, aufsagenMoeglich, vorlesen, vorlesenMoeglich, type Sprache } from "@/lib/sprache";

const klein = "rounded-lg border border-neutral-300 px-3 py-2 text-sm";

export function VorlesenKnopf({ text, sprache }: { text: string; sprache: Sprache }) {
  const [da, setDa] = useState(false);
  useEffect(() => setDa(vorlesenMoeglich()), []);
  if (!da) return null;
  return (
    <button type="button" className={klein} onClick={() => vorlesen(text, sprache)} aria-label={`${text} anhören`}>
      🔊 Anhören
    </button>
  );
}

export function AufsagenKnopf({ sprache, onText }: { sprache: Sprache; onText: (t: string) => void }) {
  const [da, setDa] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => setDa(aufsagenMoeglich(sprache)), [sprache]);
  useEffect(() => () => stopRef.current(), []);

  if (!da) return null;

  function start() {
    if (laeuft) return stopRef.current();
    setHinweis(null);
    setLaeuft(true);
    stopRef.current = aufnehmen(sprache, {
      text: onText,
      ende: () => setLaeuft(false),
      fehler: (code) => {
        setLaeuft(false);
        setHinweis(
          code === "not-allowed" || code === "service-not-allowed"
            ? "Bitte erlaube dem Browser das Mikrofon."
            : code === "no-speech"
              ? "Ich habe nichts gehört. Versuche es nochmal."
              : "Das Aufsagen hat nicht geklappt.",
        );
      },
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" className={`${klein} ${laeuft ? "border-red-500 text-red-600" : ""}`} onClick={start}>
        {laeuft ? "🎙️ Ich höre zu … (tippen zum Stoppen)" : "🎙️ Aufsagen"}
      </button>
      {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
    </div>
  );
}
