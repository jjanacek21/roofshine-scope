import { useCallback, useEffect, useRef, useState } from "react";

// Minimal wrapper around browser SpeechRecognition (Web Speech API).
// Chrome/Edge on desktop + Android support this well; Safari desktop does not.

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition?: any;
  }
}

export type UseVoiceInputOpts = {
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  autoSubmitSilenceMs?: number; // if set, calls onFinal after this much silence
  lang?: string;
};

export function useVoiceInput(opts: UseVoiceInputOpts = {}) {
  const { onFinal, onInterim, autoSubmitSilenceMs, lang = "en-US" } = opts;
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(false);

  const recRef = useRef<any>(null);
  const finalBufRef = useRef<string>("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SRClass);
  }, []);

  const stopSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stop = useCallback(() => {
    stopSilenceTimer();
    const r = recRef.current;
    if (r) {
      try {
        r.onend = null;
        r.stop();
      } catch {
        /* ignore */
      }
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const commitFinal = useCallback(() => {
    const text = finalBufRef.current.trim();
    finalBufRef.current = "";
    setTranscript("");
    if (text && onFinal) onFinal(text);
  }, [onFinal]);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SRClass) return;
    stop();
    const r = new SRClass();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;

    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0].transcript;
        if (res.isFinal) {
          finalBufRef.current = (finalBufRef.current + " " + txt).trim();
        } else {
          interim += txt;
        }
      }
      const combined = (finalBufRef.current + " " + interim).trim();
      setTranscript(combined);
      onInterim?.(combined);

      if (autoSubmitSilenceMs) {
        stopSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
          commitFinal();
        }, autoSubmitSilenceMs);
      }
    };

    r.onerror = () => {
      stop();
    };

    r.onend = () => {
      // If we still have buffered final text, commit it.
      if (finalBufRef.current.trim()) commitFinal();
      setListening(false);
    };

    recRef.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang, autoSubmitSilenceMs, onInterim, commitFinal, stop]);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, transcript, start, stop, commitFinal };
}
