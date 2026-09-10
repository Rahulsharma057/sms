"use client";

import { useRef, useState } from "react";
import { Box, IconButton, Typography, Stack, Tooltip } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";

export default function VoiceNoteRecorder({ onChange }) {
  // onChange(blob: Blob | null, durationSeconds: number)
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);
  const audioElRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const seconds = Math.round((Date.now() - startTimeRef.current) / 1000);
        setAudioUrl(url);
        setDuration(seconds);
        onChange(blob, seconds);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Mic access error:", err);
      alert("Could not access microphone. Please allow microphone permission.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const removeRecording = () => {
    setAudioUrl(null);
    setDuration(0);
    setPlaying(false);
    onChange(null, 0);
  };

  const togglePlay = () => {
    if (!audioElRef.current) return;
    if (playing) {
      audioElRef.current.pause();
    } else {
      audioElRef.current.play();
    }
    setPlaying((p) => !p);
  };

  return (
    <Box sx={{ p: 1.2, border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        {!audioUrl ? (
          <Tooltip title={recording ? "Stop recording" : "Record a voice note"}>
            <IconButton
              onClick={recording ? stopRecording : startRecording}
              sx={{
                bgcolor: recording ? "error.main" : "primary.main",
                color: "white",
                "&:hover": { bgcolor: recording ? "error.dark" : "primary.dark" },
              }}
            >
              {recording ? <StopIcon /> : <MicIcon />}
            </IconButton>
          </Tooltip>
        ) : (
          <>
            <IconButton onClick={togglePlay} sx={{ color: "primary.main" }}>
              {playing ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <audio
              ref={audioElRef}
              src={audioUrl}
              onEnded={() => setPlaying(false)}
              style={{ display: "none" }}
            />
            <Typography variant="body2" color="text.secondary">
              Voice note ({duration}s)
            </Typography>
            <IconButton size="small" onClick={removeRecording} sx={{ color: "error.main" }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </>
        )}
        {recording && (
          <Typography variant="caption" color="error.main">
            Recording...
          </Typography>
        )}
        {!audioUrl && !recording && (
          <Typography variant="caption" color="text.secondary">
            Tap mic to record a voice note (optional)
          </Typography>
        )}
      </Stack>
    </Box>
  );
}