export type Sprache = "en" | "la";

// Minimale Typen: die Web Speech API fehlt in lib.dom
type ErkennungsErgebnis = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Erkennung = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: ErkennungsErgebnis) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};
type ErkennungsKlasse = new () => Erkennung;

function erkennungsKlasse(): ErkennungsKlasse | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ErkennungsKlasse; webkitSpeechRecognition?: ErkennungsKlasse };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Aufsagen geht nur für Englisch: die Browser-Erkennung kennt kein Latein. */
export function aufsagenMoeglich(sprache: Sprache): boolean {
  return sprache === "en" && erkennungsKlasse() !== null;
}

export function vorlesenMoeglich(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Latein: falls keine lateinische Stimme da ist, klingt die italienische am ehesten passend. */
export function vorlesen(text: string, sprache: Sprache) {
  if (!vorlesenMoeglich()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (sprache === "en") {
    u.lang = "en-GB";
  } else {
    const latein = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("la"));
    u.lang = latein ? latein.lang : "it-IT";
    if (latein) u.voice = latein;
  }
  u.rate = 0.85;
  synth.speak(u);
}

/** Startet die Aufnahme; gibt eine Funktion zum Abbrechen zurück. */
export function aufnehmen(
  sprache: Sprache,
  bei: { text: (t: string) => void; ende: () => void; fehler: (code: string) => void },
): () => void {
  const Klasse = erkennungsKlasse();
  if (!Klasse || sprache !== "en") {
    bei.fehler("nicht-unterstuetzt");
    return () => {};
  }
  const r = new Klasse();
  r.lang = "en-GB";
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (e) => bei.text(e.results[0][0].transcript);
  r.onerror = (e) => bei.fehler(e.error);
  r.onend = bei.ende;
  r.start();
  return () => r.stop();
}
