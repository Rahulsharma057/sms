"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  Box,
  Typography,
  TextField,
  IconButton,
  CircularProgress,
  Fade,
  Avatar,
  Chip,
  Stack,
} from "@mui/material";

import {
  Send,
  DoneAll,
  Done,
  ChatBubbleOutlineRounded,
  GroupOutlined,
  PersonOutline,
} from "@mui/icons-material";

import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const POLL_MS = 5000;

function formatMessageTime(dateStr) {
  if (!dateStr) return "";

  const d = new Date(dateStr);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const AVATAR_COLORS = [
  "#6366F1",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

function colorForName(name = "") {
  const idx = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/);

  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/**
 * Return a normalized list of users involved in the task.
 *
 * INDIVIDUAL / SEPARATE:
 * assignedBy + assignedTo
 *
 * GROUP:
 * assignedBy + participants[]
 */
function getTaskPeople(task) {
  if (!task) return [];

  const people = [];

  if (task.assignedBy) {
    people.push(task.assignedBy);
  }

  if (task.mode === "GROUP") {
    if (Array.isArray(task.participants)) {
      people.push(...task.participants);
    }
  } else if (task.assignedTo) {
    people.push(task.assignedTo);
  }

  const unique = new Map();

  people.forEach((person) => {
    const id = person?._id || person;

    if (!id) return;

    const key = String(id);

    if (!unique.has(key)) {
      unique.set(key, person);
    }
  });

  return [...unique.values()];
}

function getPersonId(person) {
  return String(person?._id || person || "");
}

function isSameUser(a, b) {
  return String(a) === String(b);
}

/**
 * For a group task:
 * message is considered seen when every other participant
 * has seen it.
 *
 * For individual/separate:
 * message is seen when the other party has seen it.
 */
function isMessageSeenByOthers(task, message, myId) {
  if (!task || !message || !myId) return false;

  const seenBy = Array.isArray(message.seenBy)
    ? message.seenBy.map(String)
    : [];

  const people = getTaskPeople(task);

  const otherPeople = people.filter(
    (person) => getPersonId(person) && !isSameUser(getPersonId(person), myId),
  );

  if (!otherPeople.length) {
    return false;
  }

  return otherPeople.every((person) => seenBy.includes(getPersonId(person)));
}

export default function TaskChat({ taskId }) {
  const { user } = useAuth();

  const myId = user?.id || user?._id;

  const [task, setTask] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // ======================================================
  // LOAD TASK
  // ======================================================

  const loadTask = async ({ silent = false } = {}) => {
    if (!taskId) return;

    try {
      const { data } = await api.get(`/tasks/${taskId}`);

      setTask(data);
      setLoadError("");
    } catch (err) {
      if (!silent) {
        setTask(null);

        setLoadError(
          err?.response?.data?.message || "Could not load conversation.",
        );
      }
    }
  };

  // ======================================================
  // MARK MESSAGES SEEN
  // ======================================================

  const markSeen = async () => {
    if (!taskId) return;

    try {
      await api.patch(`/tasks/${taskId}/messages/seen`);
    } catch {
      // Seen status is non-critical.
    }
  };

  // ======================================================
  // INITIAL LOAD + POLLING
  // ======================================================

  useEffect(() => {
    if (!taskId) return;

    setTask(null);
    setLoadError("");

    const initialize = async () => {
      await loadTask();
      await markSeen();
    };

    initialize();

    const interval = setInterval(() => {
      loadTask({ silent: true });
    }, POLL_MS);

    return () => {
      clearInterval(interval);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // ======================================================
  // MARK NEW MESSAGES AS SEEN
  // ======================================================

  useEffect(() => {
    if (!task?.messages?.length) return;

    markSeen();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.messages?.length]);

  // ======================================================
  // AUTO SCROLL
  // ======================================================

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [task?.messages?.length]);

  // ======================================================
  // TASK PEOPLE
  // ======================================================

  const taskPeople = useMemo(() => getTaskPeople(task), [task]);

  const otherPeople = useMemo(() => {
    return taskPeople.filter(
      (person) => !isSameUser(getPersonId(person), myId),
    );
  }, [taskPeople, myId]);

  // ======================================================
  // SEND MESSAGE
  // ======================================================

  const sendMessage = async () => {
    if (!text.trim() || sending || !taskId) {
      return;
    }

    const value = text.trim();

    setText("");
    setSending(true);

    try {
      await api.post(`/tasks/${taskId}/messages`, {
        text: value,
      });

      await loadTask({ silent: true });

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } catch (err) {
      setText(value);

      setLoadError(err?.response?.data?.message || "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  // ======================================================
  // LOADING
  // ======================================================

  if (!task) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 1,
          px: 2,
        }}
      >
        {loadError ? (
          <>
            <Typography variant="body2" color="error.main" textAlign="center">
              {loadError}
            </Typography>

            <IconButton size="small" onClick={() => loadTask()} color="primary">
              ↻
            </IconButton>
          </>
        ) : (
          <CircularProgress size={22} />
        )}
      </Box>
    );
  }

  const isGroup = task.mode === "GROUP";

  // ======================================================
  // LAST OWN MESSAGE
  // ======================================================

  const messages = Array.isArray(task.messages) ? task.messages : [];

  const lastOwnMessage = [...messages]
    .reverse()
    .find(
      (message) =>
        String(message.sender?._id || message.sender) === String(myId),
    );

  // ======================================================
  // GROUP SUMMARY
  // ======================================================

  const groupParticipantCount = Array.isArray(task.participants)
    ? task.participants.length
    : 0;

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
      {/* ==================================================
          GROUP / PARTICIPANTS INFO
          ================================================== */}

      {isGroup && (
        <Box
          sx={{
            px: { xs: 1.25, sm: 2 },
            py: 0.8,
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              minWidth: 0,
            }}
          >
            <GroupOutlined
              sx={{
                fontSize: 18,
                color: "primary.main",
                flexShrink: 0,
              }}
            />

            <Typography
              variant="caption"
              fontWeight={700}
              noWrap
              sx={{
                minWidth: 0,
              }}
            >
              Group conversation
            </Typography>

            <Chip
              size="small"
              label={`${groupParticipantCount} ${
                groupParticipantCount === 1 ? "teacher" : "teachers"
              }`}
              sx={{
                height: 22,
                fontSize: 11,
                fontWeight: 700,
                ml: "auto",
              }}
            />
          </Stack>

          {/* Participant names */}
          {task.participants?.length > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                mt: 0.35,
                ml: 3.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {task.participants
                .map((participant) => participant?.name || "Teacher")
                .join(", ")}
            </Typography>
          )}
        </Box>
      )}

      {/* ==================================================
          MESSAGE LIST
          ================================================== */}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: {
            xs: 1.25,
            sm: 2,
            md: 2.5,
          },
          py: {
            xs: 1.25,
            sm: 2,
          },

          "&::-webkit-scrollbar": {
            width: 6,
          },

          "&::-webkit-scrollbar-thumb": {
            bgcolor: "rgba(0,0,0,0.15)",
            borderRadius: 10,
          },
        }}
      >
        {messages.length === 0 ? (
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
              {isGroup ? (
                <GroupOutlined
                  sx={{
                    fontSize: 24,
                    color: "text.disabled",
                  }}
                />
              ) : (
                <ChatBubbleOutlineRounded
                  sx={{
                    fontSize: 24,
                    color: "text.disabled",
                  }}
                />
              )}
            </Box>

            <Typography variant="body2" fontWeight={600} color="text.secondary">
              No messages yet
            </Typography>

            <Typography
              variant="caption"
              color="text.disabled"
              sx={{
                maxWidth: 250,
                mt: 0.5,
              }}
            >
              {isGroup
                ? "Start the group conversation about this task"
                : "Start the conversation about this task"}
            </Typography>
          </Box>
        ) : (
          messages.map((message, index) => {
            const senderId = String(
              message.sender?._id || message.sender || "",
            );

            const mine = senderId === String(myId);

            const senderName =
              message.senderName || message.sender?.name || "User";

            const seenByOther =
              mine && isMessageSeenByOthers(task, message, myId);

            const showStatusTag =
              mine && lastOwnMessage && message._id === lastOwnMessage._id;

            // ------------------------------------------
            // GROUP CONSECUTIVE MESSAGES
            // ------------------------------------------

            const previous = messages[index - 1];

            const previousSenderId = previous
              ? String(previous.sender?._id || previous.sender || "")
              : null;

            const grouped = previous && previousSenderId === senderId;

            return (
              <Fade
                in
                key={message._id || `${message.createdAt}-${index}`}
                timeout={200}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: mine ? "flex-end" : "flex-start",
                    mb: grouped ? 0.4 : 1.5,
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: {
                        xs: "84%",
                        sm: "72%",
                        md: "65%",
                      },
                    }}
                  >
                    {/* =================================
                        SENDER HEADER
                        ================================= */}

                    {!mine && (
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.65}
                        sx={{
                          ml: 1,
                          mb: grouped ? 0.15 : 0.3,
                        }}
                      >
                        {isGroup && !grouped && (
                          <Avatar
                            sx={{
                              width: 20,
                              height: 20,
                              fontSize: 9,
                              bgcolor: colorForName(senderName),
                            }}
                          >
                            {initials(senderName)}
                          </Avatar>
                        )}

                        {!grouped && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              fontWeight: 700,
                              fontSize: 10.5,
                            }}
                          >
                            {senderName}
                          </Typography>
                        )}
                      </Stack>
                    )}

                    {/* =================================
                        MESSAGE BUBBLE
                        ================================= */}

                    <Box
                      sx={{
                        bgcolor: mine ? "primary.main" : "#fff",

                        color: mine ? "white" : "text.primary",

                        px: {
                          xs: 1.5,
                          sm: 1.75,
                        },

                        py: {
                          xs: 0.85,
                          sm: 1,
                        },

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
                        sx={{
                          wordBreak: "break-word",

                          whiteSpace: "pre-wrap",

                          fontSize: {
                            xs: "0.85rem",
                            sm: "0.875rem",
                          },

                          lineHeight: 1.5,
                        }}
                      >
                        {message.text}
                      </Typography>
                    </Box>

                    {/* =================================
                        TIME + SENT / SEEN
                        ================================= */}

                    <MessageMeta mine={mine}>
                      {message.createdAt && (
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{
                            fontSize: 10.5,
                          }}
                        >
                          {formatMessageTime(message.createdAt)}
                        </Typography>
                      )}

                      {showStatusTag && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.3,
                            fontSize: 10.5,
                          }}
                        >
                          {seenByOther ? (
                            <>
                              <DoneAll
                                sx={{
                                  fontSize: 13,
                                  color: "primary.main",
                                }}
                              />

                              {isGroup ? "Seen by all" : "Seen"}
                            </>
                          ) : (
                            <>
                              <Done
                                sx={{
                                  fontSize: 13,
                                }}
                              />
                              Sent
                            </>
                          )}
                        </Typography>
                      )}
                    </MessageMeta>
                  </Box>
                </Box>
              </Fade>
            );
          })
        )}

        <div ref={bottomRef} />
      </Box>

      {/* ==================================================
          COMPOSER
          ================================================== */}

      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
          px: {
            xs: 1.25,
            sm: 2,
          },
          py: {
            xs: 1,
            sm: 1.25,
          },
          borderTop: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
          bgcolor: "background.paper",
        }}
      >
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder={isGroup ? "Message the group..." : "Type a message..."}
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
              fontSize: {
                xs: "0.85rem",
                sm: "0.9rem",
              },
            },
          }}
        />

        <IconButton
          color="primary"
          onClick={sendMessage}
          disabled={sending || !text.trim()}
          aria-label="Send message"
          sx={{
            bgcolor: text.trim() ? "primary.main" : "action.disabledBackground",

            color: text.trim() ? "white" : "action.disabled",

            width: {
              xs: 38,
              sm: 42,
            },

            height: {
              xs: 38,
              sm: 42,
            },

            flexShrink: 0,

            "&:hover": {
              bgcolor: text.trim()
                ? "primary.dark"
                : "action.disabledBackground",
            },
          }}
        >
          {sending ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <Send sx={{ fontSize: 19 }} />
          )}
        </IconButton>
      </Box>
    </Box>
  );
}

// ======================================================
// MESSAGE META
// ======================================================

function MessageMeta({ mine, children }) {
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
