"use client";

import { useEffect, useRef, useState } from "react";
import { TextField, IconButton, InputAdornment, Tooltip } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";

export default function VoiceTextField({
  label,
  value,
  onChange, // (newValue: string) => void
  multiline = false,
  minRows,
  fullWidth = true,
  size = "small",
  required = false,
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const baseTextRef = useRef("");

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      const base = baseTextRef.current;
      const separator = base && !base.endsWith(" ") ? " " : "";
      const combined = `${base}${finalTranscript ? separator + finalTranscript : ""}${interimTranscript}`.trimStart();
      onChange(combined);

      if (finalTranscript) {
        baseTextRef.current = `${base}${separator}${finalTranscript}`.trimStart();
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;

    return () => recognition.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      baseTextRef.current = value || "";
      recognitionRef.current.start();
      setListening(true);
    }
  };

  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth={fullWidth}
      size={size}
      multiline={multiline}
      minRows={minRows}
      required={required}
      InputProps={{
        endAdornment: supported ? (
          <InputAdornment position="end">
            <Tooltip title={listening ? "Listening... tap to stop" : "Speak to type"}>
              <IconButton
                size="small"
                onClick={toggleListening}
                sx={{ color: listening ? "error.main" : "text.secondary" }}
              >
                {listening ? <GraphicEqIcon fontSize="small" /> : <MicIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ) : undefined,
      }}
    />
  );
}