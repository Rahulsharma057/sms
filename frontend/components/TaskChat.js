"use client";
import { useEffect, useRef, useState } from "react";
import { Box, Typography, TextField, IconButton, CircularProgress, Fade } from "@mui/material";
import { Send, DoneAll, Done, ChatBubbleOutlineRounded } from "@mui/icons-material";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const POLL_MS = 5000;

function formatMessageTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// This component only renders the message thread + composer.
// Task title/description/status live in the parent's header (ChatPane) —
// don't duplicate them here.
export default function TaskChat({ taskId }) {
  const { user } = useAuth();
  const myId = user?.id || user?._id;

  const [task, setTask] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const loadTask = async ({ silent } = {}) => {
    try {
      const { data } = await api.get(`/tasks/${taskId}`);
      setTask(data);
    } catch {
      if (!silent) setTask(null);
    }
  };

  const markSeen = async () => {
    try {
      await api.patch(`/tasks/${taskId}/messages/seen`);
    } catch {
      // non-critical, ignore
    }
  };

  // Load task on mount / when switching tasks, mark seen, and poll lightly
  // so the "Seen" tick and new messages from the other side show up
  // without a manual refresh.
  useEffect(() => {
    if (!taskId) return;
    setTask(null);
    loadTask().then(markSeen);

    const interval = setInterval(() => loadTask({ silent: true }), POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Mark newly-arrived messages as seen while this chat stays open
  useEffect(() => {
    if (task?.messages?.length) markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.messages?.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [task?.messages?.length]);

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    const value = text.trim();
    setText("");
    setSending(true);
    try {
      await api.post(`/tasks/${taskId}/messages`, { text: value });
      await loadTask({ silent: true });
    } finally {
      setSending(false);
    }
  };

  if (!task) {
    return (
      <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  // The two participants on a task are always assignedTo + assignedBy.
  const otherPartyId =
    String(task.assignedTo?._id) === String(myId)
      ? task.assignedBy?._id
      : task.assignedTo?._id;

  const lastOwnMessage = [...task.messages].reverse().find(
    (m) => String(m.sender?._id || m.sender) === String(myId),
  );

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        bgcolor: "#f8f9fb",
      }}
    >
      {/* MESSAGE LIST — flexes to fill available height, scrolls internally */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: { xs: 1.25, sm: 2, md: 2.5 },
          py: { xs: 1.25, sm: 2 },
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(0,0,0,0.15)", borderRadius: 10 },
        }}
      >
        {task.messages.length === 0 ? (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              py: 4,
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                bgcolor: "action.hover",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1.25,
              }}
            >
              <ChatBubbleOutlineRounded sx={{ fontSize: 24, color: "text.disabled" }} />
            </Box>
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              No messages yet
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ maxWidth: 220, mt: 0.5 }}>
              Start the conversation about this task
            </Typography>
          </Box>
        ) : (
          task.messages.map((m, idx) => {
            const mine = String(m.sender?._id || m.sender) === String(myId);
            const seenByOther = otherPartyId
              ? m.seenBy?.some((id) => String(id) === String(otherPartyId))
              : false;
            const showStatusTag = mine && lastOwnMessage && m._id === lastOwnMessage._id;

            // Group consecutive messages from the same sender a bit tighter
            const prev = task.messages[idx - 1];
            const prevMine = prev ? String(prev.sender?._id || prev.sender) === String(myId) : null;
            const grouped = prev && prevMine === mine;

            return (
              <Fade in key={m._id} timeout={200}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: mine ? "flex-end" : "flex-start",
                    mb: grouped ? 0.4 : 1.5,
                  }}
                >
                  <Box sx={{ maxWidth: { xs: "82%", sm: "72%", md: "65%" } }}>
                    {!mine && !grouped && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", ml: 1, mb: 0.25, fontWeight: 600 }}
                      >
                        {m.senderName || m.sender?.name}
                      </Typography>
                    )}
                    <Box
                      sx={{
                        bgcolor: mine ? "primary.main" : "#fff",
                        color: mine ? "white" : "text.primary",
                        px: { xs: 1.5, sm: 1.75 },
                        py: { xs: 0.85, sm: 1 },
                        borderRadius: 2.5,
                        borderTopRightRadius: mine ? (grouped ? 8 : 4) : 20,
                        borderTopLeftRadius: mine ? 20 : grouped ? 8 : 4,
                        boxShadow: mine
                          ? "0 1px 2px rgba(0,0,0,0.08)"
                          : "0 1px 2px rgba(0,0,0,0.06)",
                        border: mine ? "none" : "1px solid #ececec",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ wordBreak: "break-word", fontSize: { xs: "0.85rem", sm: "0.875rem" } }}
                      >
                        {m.text}
                      </Typography>
                    </Box>
                    <Stack2 mine={mine}>
                      {m.createdAt && (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10.5 }}>
                          {formatMessageTime(m.createdAt)}
                        </Typography>
                      )}
                      {showStatusTag && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "flex", alignItems: "center", gap: 0.3, fontSize: 10.5 }}
                        >
                          {seenByOther ? (
                            <>
                              <DoneAll sx={{ fontSize: 13, color: "primary.main" }} /> Seen
                            </>
                          ) : (
                            <>
                              <Done sx={{ fontSize: 13 }} /> Sent
                            </>
                          )}
                        </Typography>
                      )}
                    </Stack2>
                  </Box>
                </Box>
              </Fade>
            );
          })
        )}
        <div ref={bottomRef} />
      </Box>

      {/* COMPOSER — pinned to the bottom of the panel, never scrolls away */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
          px: { xs: 1.25, sm: 2 },
          py: { xs: 1, sm: 1.25 },
          borderTop: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
          bgcolor: "background.paper",
        }}
      >
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 3,
              bgcolor: "#f3f4f6",
              fontSize: { xs: "0.85rem", sm: "0.9rem" },
            },
          }}
        />
        <IconButton
          color="primary"
          onClick={sendMessage}
          disabled={sending || !text.trim()}
          sx={{
            bgcolor: text.trim() ? "primary.main" : "action.disabledBackground",
            color: text.trim() ? "white" : "action.disabled",
            width: { xs: 38, sm: 42 },
            height: { xs: 38, sm: 42 },
            flexShrink: 0,
            "&:hover": { bgcolor: text.trim() ? "primary.dark" : "action.disabledBackground" },
          }}
        >
          {sending ? <CircularProgress size={18} color="inherit" /> : <Send sx={{ fontSize: 19 }} />}
        </IconButton>
      </Box>
    </Box>
  );
}

// Small helper for the timestamp/seen row under a bubble — right-aligned for
// my own messages, left-aligned for the other person's.
function Stack2({ mine, children }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        justifyContent: mine ? "flex-end" : "flex-start",
        mt: 0.3,
        px: 0.5,
      }}
    >
      {children}
    </Box>
  );
}