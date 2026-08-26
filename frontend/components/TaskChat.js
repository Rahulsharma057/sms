"use client";
import { useEffect, useRef, useState } from "react";
import {
  Box, Paper, Typography, TextField, IconButton, Chip, MenuItem, Select,
  Divider, Avatar, Stack,
} from "@mui/material";
import { Send } from "@mui/icons-material";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const STATUS_COLORS = { pending: "warning", "in-progress": "info", completed: "success" };

export default function TaskChat({ taskId, onClose }) {
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  const loadTask = async () => {
    const { data } = await api.get(`/tasks/${taskId}`);
    setTask(data);
  };

  useEffect(() => {
    if (taskId) loadTask();
  }, [taskId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [task?.messages?.length]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    await api.post(`/tasks/${taskId}/messages`, { text });
    setText("");
    loadTask();
  };

  const changeStatus = async (status) => {
    await api.patch(`/tasks/${taskId}/status`, { status });
    loadTask();
  };

  if (!task) return null;

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, maxWidth: 700, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
        <Box>
          <Typography variant="h6" fontWeight={700}>{task.title}</Typography>
          <Typography variant="body2" color="text.secondary">{task.description}</Typography>
          {task.dueDate && <Typography variant="caption" color="text.secondary">Due: {task.dueDate}</Typography>}
        </Box>
        <Select
          size="small"
          value={task.status}
          onChange={(e) => changeStatus(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="in-progress">In Progress</MenuItem>
          <MenuItem value="completed">Completed</MenuItem>
        </Select>
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ maxHeight: 350, overflowY: "auto", mb: 2, pr: 1 }}>
        {task.messages.length === 0 && (
          <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
            No messages yet. Start the conversation about this task.
          </Typography>
        )}
        {task.messages.map((m) => {
          const mine = m.sender?._id === user.id || m.sender === user.id;
          return (
            <Box key={m._id} sx={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", mb: 1.5 }}>
              <Box sx={{ maxWidth: "75%" }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: mine ? "right" : "left" }}>
                  {m.senderName || m.sender?.name}
                </Typography>
                <Box
                  sx={{
                    bgcolor: mine ? "primary.main" : "grey.200",
                    color: mine ? "white" : "text.primary",
                    px: 2, py: 1, borderRadius: 2,
                  }}
                >
                  <Typography variant="body2">{m.text}</Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
        <div ref={bottomRef} />
      </Box>

      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
        />
        <IconButton color="primary" onClick={sendMessage}><Send /></IconButton>
      </Box>
    </Paper>
  );
}
