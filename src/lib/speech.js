import { useRef, useState, useCallback, useEffect } from "react";

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

export function speechSupported() {
  return !!SpeechRecognitionAPI;
}

/**
 * Continuous live transcription. Calls onFinalChunk(text) every time a
 * finalized sentence/phrase comes in, so the caller can batch it off to
 * the fact-checker without re-processing the whole running transcript.
 */
export function useLiveSpeech({ onFinalChunk }) {
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [fullTranscript, setFullTranscript] = useState("");
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const onFinalChunkRef = useRef(onFinalChunk);
  onFinalChunkRef.current = onFinalChunk;

  const buildRecognition = useCallback(() => {
    const rec = new SpeechRecognitionAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          setFullTranscript(prev => (prev ? prev + " " : "") + text.trim());
          onFinalChunkRef.current?.(text.trim());
        } else {
          interim += text;
        }
      }
      setInterimText(interim);
    };

    rec.onerror = e => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error);
    };

    rec.onend = () => {
      // browsers auto-stop after periods of silence — restart seamlessly if we're
      // still supposed to be listening (user hasn't paused/ended)
      if (recognitionRef.current?.__shouldRun) {
        try { rec.start(); } catch {}
      }
    };

    return rec;
  }, []);

  const start = useCallback(() => {
    setError(null);
    const rec = buildRecognition();
    rec.__shouldRun = true;
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      setError(String(err));
    }
  }, [buildRecognition]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.__shouldRun = false;
      recognitionRef.current.stop();
    }
    setListening(false);
    setInterimText("");
  }, []);

  const reset = useCallback(() => {
    setFullTranscript("");
    setInterimText("");
  }, []);

  useEffect(() => () => { if (recognitionRef.current) { recognitionRef.current.__shouldRun = false; recognitionRef.current.stop(); } }, []);

  return { listening, interimText, fullTranscript, error, start, stop, reset, supported: speechSupported() };
}

export function speak(text, enabled) {
  if (!enabled || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.05;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}
