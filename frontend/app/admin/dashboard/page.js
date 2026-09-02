"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  TextField,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Stack,
  Avatar,
  Skeleton,
  Divider,
  Button,
  Pagination,
  CircularProgress,
  Tooltip,
  InputAdornment,
} from "@mui/material";

import {
  Close,
  DescriptionOutlined,
  WarningAmberOutlined,
  GroupsOutlined,
  DeleteOutline,
  ArrowForward,
  FilterAltOff,
  Search,
  Apartment,
  HistoryEdu,
  Person,
  CalendarMonthOutlined,
  VisibilityOutlined,
  Refresh,
} from "@mui/icons-material";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api from "../../../lib/api";

/* =========================================================
   PROFESSIONAL INSTITUTIONAL PALETTE
========================================================= */

const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceSoft: "#F8FAFC",

  primary: "#1E3A5F",
  primaryDark: "#17304F",
  primaryLight: "#2563A6",
  primarySoft: "#EFF6FF",

  secondary: "#2563A6",
  secondarySoft: "#F0F6FC",

  red: "#DC2626",
  redDark: "#B91C1C",
  redSoft: "#FEF2F2",

  green: "#15803D",
  greenSoft: "#F0FDF4",

  textMain: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",

  border: "#E2E8F0",
  borderDark: "#CBD5E1",

  shadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
  shadowHover: "0 5px 16px rgba(15, 23, 42, 0.08)",
};

const AVATAR_COLORS = ["#1E3A5F", "#2563A6", "#15803D", "#B45309", "#DC2626"];

const ROWS_PER_PAGE = 10;

/* =========================================================
   HELPERS
========================================================= */

function colorForName(name = "") {
  const idx = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/);

  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/* =========================================================
   STATS
========================================================= */

const STATS = [
  {
    key: "total",
    label: "Total Reports",
    icon: DescriptionOutlined,
    color: COLORS.primary,
    softColor: COLORS.primarySoft,
  },
  {
    key: "urgent",
    label: "Urgent Matters",
    icon: WarningAmberOutlined,
    color: COLORS.red,
    softColor: COLORS.redSoft,
  },
  {
    key: "active",
    label: "Active Teachers",
    icon: GroupsOutlined,
    color: COLORS.secondary,
    softColor: COLORS.secondarySoft,
  },
];

/* =========================================================
   STAT CARD
========================================================= */

const StatCard = ({ label, value, icon: Icon, color, softColor, loading }) => (
  <Card
    elevation={0}
    sx={{
      bgcolor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 2.5,
      boxShadow: COLORS.shadow,
      height: 78,
      position: "relative",
      overflow: "hidden",
      transition: "border-color .2s ease, box-shadow .2s ease",

      "&:hover": {
        borderColor: `${color}55`,
        boxShadow: COLORS.shadowHover,
      },

      "&::after": {
        content: '""',
        position: "absolute",
        right: -28,
        top: -28,
        width: 85,
        height: 85,
        borderRadius: "50%",
        bgcolor: softColor,
        opacity: 0.65,
      },
    }}
  >
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{
        px: 1.75,
        height: "100%",
        position: "relative",
        zIndex: 1,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: softColor,
          color,
          border: `1px solid ${color}22`,
        }}
      >
        <Icon sx={{ fontSize: 21 }} />
      </Box>

      <Box sx={{ minWidth: 0 }}>
        {loading ? (
          <Skeleton width={42} height={27} sx={{ bgcolor: COLORS.border }} />
        ) : (
          <Typography
            sx={{
              color: COLORS.textMain,
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {value}
          </Typography>
        )}

        <Typography
          sx={{
            color: COLORS.textSecondary,
            fontSize: 12,
            fontWeight: 600,
            mt: 0.45,
          }}
        >
          {label}
        </Typography>
      </Box>
    </Stack>
  </Card>
);

/* =========================================================
   TABLE CELL
========================================================= */

const StyledTableCell = ({ children, sx, ...props }) => (
  <TableCell
    {...props}
    sx={{
      color: COLORS.textMain,
      borderColor: COLORS.border,
      py: 1.15,
      px: 1.75,
      fontSize: 13,
      ...sx,
    }}
  >
    {children}
  </TableCell>
);

/* =========================================================
   FILTER STYLES
========================================================= */

const filterStyles = {
  "& .MuiOutlinedInput-root": {
    bgcolor: COLORS.surface,
    color: COLORS.textMain,
    borderRadius: 1.75,
    minHeight: 40,

    "& fieldset": {
      borderColor: COLORS.border,
    },

    "&:hover fieldset": {
      borderColor: COLORS.primaryLight,
    },

    "&.Mui-focused fieldset": {
      borderColor: COLORS.primaryLight,
      borderWidth: 1,
    },
  },

  "& .MuiInputLabel-root": {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  "& .MuiInputLabel-root.Mui-focused": {
    color: COLORS.primaryLight,
  },

  "& .MuiInputBase-input": {
    fontSize: 13,
  },
};

/* =========================================================
   PAGINATION
========================================================= */

const paginationStyles = {
  "& .MuiPaginationItem-root": {
    color: COLORS.textSecondary,
    borderRadius: 1.5,
    fontWeight: 600,
    minWidth: 32,
    height: 32,
  },

  "& .Mui-selected": {
    bgcolor: `${COLORS.primary} !important`,
    color: "#FFFFFF !important",
  },

  "& .MuiPaginationItem-root:hover": {
    bgcolor: COLORS.primarySoft,
  },
};

/* =========================================================
   MAIN DASHBOARD
========================================================= */

function AdminDashboardInner() {
  const router = useRouter();

  const [reports, setReports] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [filterTeacher, setFilterTeacher] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [selectedReport, setSelectedReport] = useState(null);

  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* =======================================================
     LOAD REPORTS
  ======================================================= */

  const loadReports = (overrides = {}) => {
    setLoading(true);

    const teacher =
      overrides.teacher !== undefined ? overrides.teacher : filterTeacher;

    const from = overrides.from !== undefined ? overrides.from : fromDate;

    const to = overrides.to !== undefined ? overrides.to : toDate;

    const pageNum = overrides.page !== undefined ? overrides.page : page;

    const params = {
      page: pageNum,
      limit: ROWS_PER_PAGE,
      teacher,
      from,
      to,
    };

    Promise.all([
      api.get("/reports", { params }),

      api.get("/reports", {
        params: { limit: 1 },
      }),

      api.get("/reports", {
        params: {
          limit: 1,
          urgent: "true",
        },
      }),
    ])
      .then(([tableRes, totalRes, urgentRes]) => {
        setReports(tableRes.data?.reports || []);

        setTotalPages(tableRes.data?.pagination?.totalPages || 1);

        setPage(tableRes.data?.pagination?.page || 1);

        setTotalCount(totalRes.data?.pagination?.total || 0);

        setUrgentCount(urgentRes.data?.pagination?.total || 0);
      })
      .catch((err) => {
        console.error("Error loading reports:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadReports({ page: 1 });

    api
      .get("/users/teachers")
      .then((res) => setTeachers(res.data || []))
      .catch((err) => console.error("Error loading teachers:", err));
  }, []);

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await api.delete(`/reports/${deleteTarget._id}`);

      setDeleteTarget(null);

      const nextPage = reports.length === 1 && page > 1 ? page - 1 : page;

      loadReports({ page: nextPage });
    } catch (err) {
      console.error("Failed to delete report:", err);

      alert("Error deleting report. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  /* =======================================================
     RESET
  ======================================================= */

  const handleResetFilters = () => {
    setFilterTeacher("");
    setFromDate("");
    setToDate("");

    loadReports({
      teacher: "",
      from: "",
      to: "",
      page: 1,
    });
  };

  /* =======================================================
     STATS
  ======================================================= */

  const activeTeacherCount = useMemo(
    () => teachers.filter((teacher) => teacher.active).length,
    [teachers],
  );

  const statValues = {
    total: totalCount,
    urgent: urgentCount,
    active: activeTeacherCount,
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <Box
      sx={{
        bgcolor: COLORS.bg,
        minHeight: "100vh",
        pb: 4,
      }}
    >
      <Navbar />

      {/* =================================================
          HEADER
      ================================================= */}

      <Box
        sx={{
          bgcolor: COLORS.surface,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              py: { xs: 1.75, md: 2.25 },
            }}
          >
            <Stack
              direction={{
                xs: "column",
                sm: "row",
              }}
              justifyContent="space-between"
              alignItems={{
                xs: "flex-start",
                sm: "center",
              }}
              spacing={1.5}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: COLORS.primary,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
bgcolor:"rgba(37, 39, 150, 0.97)",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      width: 8,
                      height: 8,
                      bgcolor: COLORS.red,
                      borderRadius: "50%",
                      right: 5,
                      top: 5,
                    },
                  }}
                >
                  <HistoryEdu sx={{ fontSize: 21 ,bgcolor:"rgba(32, 34, 185, 0.97)"}} />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      color: COLORS.textMain,
                      fontWeight: 800,
                      fontSize: {
                        xs: 21,
                        md: 25,
                      },
                      lineHeight: 1.1,
                      letterSpacing: "-0.3px",
                    }}
                  >
                    Superadmin{" "}
                    <Box
                      component="span"
                      sx={{
                        color: "rgb(24, 36, 171)",
                      }}
                    >
                      Dashboard
                    </Box>
                  </Typography>

                  <Typography
                    sx={{
                      color: COLORS.textMuted,
                      fontSize: 12,
                      mt: 0.35,
                    }}
                  >
                    Monitor reports, teachers and centre activities from one
                    place.
                  </Typography>
                </Box>
              </Stack>

              <Button
                variant="contained"
                onClick={() => router.push("/admin/reports")}
                endIcon={<ArrowForward sx={{ fontSize: 17 }} />}
                startIcon={<HistoryEdu sx={{ fontSize: 18 }} />}
                sx={{
                  minHeight: 38,
                 bgcolor: "rgb(223, 42, 36)",
                  borderRadius: 1.75,
                  px: 4.75,
                  fontSize: 12.5,
                  fontWeight: 700,
                  textTransform: "none",
                  boxShadow: "none",
           
                  "&:hover": {
                    bgcolor: COLORS.primaryDark,
                    boxShadow: "none",
                  },
                }}
              >
                View History
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* =================================================
          CONTENT
      ================================================= */}

      <Container
        maxWidth="lg"
        sx={{
          mt: { xs: 1.75, md: 2.25 },
        }}
      >
        {/* =================================================
            STATS
        ================================================= */}

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {STATS.map((stat) => (
            <Grid item xs={12} sm={4} key={stat.key}>
              <StatCard
                {...stat}
                value={statValues[stat.key]}
                loading={loading}
              />
            </Grid>
          ))}
        </Grid>

        {/* =================================================
            REPORTS PANEL
        ================================================= */}

        <Paper
          elevation={0}
          sx={{
            bgcolor: COLORS.surface,
            borderRadius: 2.5,
            border: `1px solid ${COLORS.border}`,
            boxShadow: COLORS.shadow,
            overflow: "hidden",
          }}
        >
          {/* PANEL HEADER */}

  <Box
  sx={{
    px: { xs: 1.5, md: 2 },
    py: 1.4,
    bgcolor: "#FFFFFF",
    borderBottom: `1px solid ${COLORS.border}`,
  }}
>
  <Stack
    direction="row"
    justifyContent="space-between"
    alignItems="center"
    spacing={1}
  >
    <Box>
      <Stack
        direction="row"
        spacing={0.9}
        alignItems="center"
      >
        <DescriptionOutlined
          sx={{
            fontSize: 20,
            color: COLORS.primary,
          }}
        />

        <Typography
          sx={{
            color: "#27282b",
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "-0.2px",
          }}
        >
          Reports Overview
        </Typography>
      </Stack>

      <Typography
        sx={{
          color: "#64748B",
          fontSize: 11.5,
          mt: 0.25,
        }}
      >
        Filter and manage submitted teacher reports.
      </Typography>
    </Box>

    <Chip
      icon={
        <DescriptionOutlined
          sx={{ fontSize: 15 }}
        />
      }
      label={`${totalCount} Reports`}
      size="small"
      sx={{
        height: 28,
        bgcolor: "#EFF6FF",
        color: COLORS.primary,
        fontSize: 11.5,
        fontWeight: 700,
        borderRadius: 1.5,
        border: "1px solid #DBEAFE",

        "& .MuiChip-icon": {
          color: COLORS.primary,
        },
      }}
    />
  </Stack>
</Box>
          {/* =================================================
              FILTERS
          ================================================= */}

          <Box
            sx={{
              p: { xs: 1.5, md: 1.75 },
              bgcolor: "#FBFCFE",
              borderBottom: `1px solid ${COLORS.border}`,
              borderLeft: `3px solid ${COLORS.primary}`,
            }}
          >
            <Grid container spacing={1} alignItems="center">
              {/* TEACHER */}

              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Teacher"
                  value={filterTeacher}
                  onChange={(e) => {
                    const value = e.target.value;

                    setFilterTeacher(value);

                    loadReports({
                      teacher: value,
                      page: 1,
                    });
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person
                          sx={{
                            color: COLORS.primaryLight,
                            fontSize: 18,
                          }}
                        />
                      </InputAdornment>
                    ),
                  }}
                  sx={filterStyles}
                >
                  <MenuItem value="">All Teachers</MenuItem>

                  {teachers.map((teacher) => (
                    <MenuItem key={teacher._id} value={teacher._id}>
                      {teacher.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* FROM */}

              <Grid item xs={12} sm={6} md={2.5}>
                <TextField
                  type="date"
                  fullWidth
                  size="small"
                  label="From Date"
                  value={fromDate}
                  onChange={(e) => {
                    const value = e.target.value;

                    setFromDate(value);

                    loadReports({
                      from: value,
                      page: 1,
                    });
                  }}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarMonthOutlined
                          sx={{
                            color: COLORS.primaryLight,
                            fontSize: 18,
                          }}
                        />
                      </InputAdornment>
                    ),
                  }}
                  sx={filterStyles}
                />
              </Grid>

              {/* TO */}

              <Grid item xs={12} sm={6} md={2.5}>
                <TextField
                  type="date"
                  fullWidth
                  size="small"
                  label="To Date"
                  value={toDate}
                  onChange={(e) => {
                    const value = e.target.value;

                    setToDate(value);

                    loadReports({
                      to: value,
                      page: 1,
                    });
                  }}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarMonthOutlined
                          sx={{
                            color: COLORS.primaryLight,
                            fontSize: 18,
                          }}
                        />
                      </InputAdornment>
                    ),
                  }}
                  sx={filterStyles}
                />
              </Grid>

              {/* RESET */}

              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<FilterAltOff sx={{ fontSize: 17 }} />}
                  onClick={handleResetFilters}
                  sx={{
                    height: 40,
                    borderRadius: 1.75,
                    borderColor: COLORS.borderDark,
                    color: COLORS.textSecondary,
                    textTransform: "none",
                    fontSize: 12.5,
                    fontWeight: 700,

                    "&:hover": {
                      borderColor: COLORS.primary,
                      color: COLORS.primary,
                      bgcolor: COLORS.primarySoft,
                    },
                  }}
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
          </Box>

          {/* =================================================
              TABLE
          ================================================= */}

          <TableContainer
            sx={{
              overflowX: "auto",
            }}
          >
            <Table
              size="small"
              sx={{
                minWidth: 720,
              }}
            >
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: "rgba(23, 43, 143, 0.98)",
                  }}
                >
                  {["DATE", "TEACHER", "CENTRE", "STATUS", "ACTION"].map(
                    (heading, index) => (
                      <StyledTableCell
                        key={heading}
                        align={index === 4 ? "right" : "left"}
                        sx={{
                          fontWeight: 800,
                          color: "#FFFFFF",
                          fontSize: 10.5,
                          letterSpacing: ".6px",
                          py: 1.15,
                          borderColor: COLORS.primary,
                        }}
                      >
                        {heading}
                      </StyledTableCell>
                    ),
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {/* LOADING */}

                {loading &&
                  [...Array(5)].map((_, index) => (
                    <TableRow key={index}>
                      <StyledTableCell colSpan={5}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          <Skeleton
                            variant="rounded"
                            width={75}
                            height={16}
                            sx={{
                              bgcolor: COLORS.border,
                            }}
                          />

                          <Skeleton
                            variant="rounded"
                            width={180}
                            height={27}
                            sx={{
                              bgcolor: COLORS.border,
                            }}
                          />

                          <Skeleton
                            variant="rounded"
                            width={130}
                            height={16}
                            sx={{
                              bgcolor: COLORS.border,
                            }}
                          />
                        </Stack>
                      </StyledTableCell>
                    </TableRow>
                  ))}

                {/* EMPTY */}

                {!loading && reports.length === 0 && (
                  <TableRow>
                    <StyledTableCell colSpan={5}>
                      <Box
                        sx={{
                          py: 5,
                          textAlign: "center",
                        }}
                      >
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            mx: "auto",
                            mb: 1.25,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: COLORS.primarySoft,
                            color: COLORS.primary,
                          }}
                        >
                          <DescriptionOutlined
                            sx={{
                              fontSize: 22,
                            }}
                          />
                        </Box>

                        <Typography
                          sx={{
                            color: COLORS.textMain,
                            fontSize: 15,
                            fontWeight: 800,
                          }}
                        >
                          No reports found
                        </Typography>

                        <Typography
                          sx={{
                            color: COLORS.textMuted,
                            fontSize: 12,
                            mt: 0.35,
                          }}
                        >
                          No reports match the selected filters.
                        </Typography>

                        <Button
                          size="small"
                          startIcon={
                            <Refresh
                              sx={{
                                fontSize: 16,
                              }}
                            />
                          }
                          onClick={handleResetFilters}
                          sx={{
                            mt: 1,
                            color: COLORS.primary,
                            textTransform: "none",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          Reset Filters
                        </Button>
                      </Box>
                    </StyledTableCell>
                  </TableRow>
                )}

                {/* REPORTS */}

                {!loading &&
                  reports.map((report) => (
                    <TableRow
                      key={report._id}
                      hover
                      onClick={() => setSelectedReport(report)}
                      sx={{
                        cursor: "pointer",
                        transition: "background .15s",

                        "&:hover": {
                          bgcolor: COLORS.primarySoft,
                        },

                        "&:last-child td": {
                          borderBottom: 0,
                        },
                      }}
                    >
                      {/* DATE */}

                      <StyledTableCell>
                        <Stack
                          direction="row"
                          spacing={0.8}
                          alignItems="center"
                        >
                          <CalendarMonthOutlined
                            sx={{
                              fontSize: 16,
                              color: COLORS.primaryLight,
                            }}
                          />

                          <Typography
                            sx={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: COLORS.textSecondary,
                            }}
                          >
                            {report.date}
                          </Typography>
                        </Stack>
                      </StyledTableCell>

                      {/* TEACHER */}

                      <StyledTableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar
                            sx={{
                              width: 30,
                              height: 30,
                              fontSize: 10.5,
                              fontWeight: 800,
                              bgcolor: colorForName(report.teacher?.name),
                            }}
                          >
                            {initials(report.teacher?.name)}
                          </Avatar>

                          <Box>
                            <Typography
                              sx={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: COLORS.textMain,
                                lineHeight: 1.2,
                              }}
                            >
                              {report.teacher?.name || "Unknown Teacher"}
                            </Typography>

                            <Typography
                              sx={{
                                fontSize: 10.5,
                                color: COLORS.textMuted,
                                mt: 0.2,
                              }}
                            >
                              Teacher
                            </Typography>
                          </Box>
                        </Stack>
                      </StyledTableCell>

                      {/* CENTRE */}

                      <StyledTableCell>
                        <Stack
                          direction="row"
                          spacing={0.8}
                          alignItems="center"
                        >
                          <Apartment
                            sx={{
                              fontSize: 17,
                              color: COLORS.secondary,
                            }}
                          />

                          <Typography
                            sx={{
                              color: COLORS.textSecondary,
                              fontSize: 12.5,
                              fontWeight: 600,
                            }}
                          >
                            {report.centreBatch || "—"}
                          </Typography>
                        </Stack>
                      </StyledTableCell>

                      {/* STATUS */}

                      <StyledTableCell>
                        {report.urgentMatters ? (
                          <Chip
                            icon={
                              <WarningAmberOutlined
                                sx={{
                                  fontSize: "14px !important",
                                }}
                              />
                            }
                            label="Urgent"
                            size="small"
                            sx={{
                              height: 24,
                              bgcolor: COLORS.redSoft,
                              color: COLORS.red,
                              border: `1px solid #FECACA`,
                              fontSize: 10.5,
                              fontWeight: 700,
                              borderRadius: 1.5,

                              "& .MuiChip-icon": {
                                color: COLORS.red,
                              },
                            }}
                          />
                        ) : (
                          <Chip
                            label="Normal"
                            size="small"
                            sx={{
                              height: 24,
                              bgcolor: COLORS.greenSoft,
                              color: COLORS.green,
                              border: "1px solid #BBF7D0",
                              fontSize: 10.5,
                              fontWeight: 700,
                              borderRadius: 1.5,
                            }}
                          />
                        )}
                      </StyledTableCell>

                      {/* ACTION */}

                      <StyledTableCell
                        align="right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Stack
                          direction="row"
                          justifyContent="flex-end"
                          spacing={0.35}
                        >
                          <Tooltip title="View report">
                            <IconButton
                              size="small"
                              onClick={() => setSelectedReport(report)}
                              sx={{
                                width: 30,
                                height: 30,
                                color: COLORS.primary,
                                bgcolor: COLORS.primarySoft,

                                "&:hover": {
                                  bgcolor: "#DBEAFE",
                                },
                              }}
                            >
                              <VisibilityOutlined
                                sx={{
                                  fontSize: 17,
                                }}
                              />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Delete report">
                            <IconButton
                              size="small"
                              onClick={() => setDeleteTarget(report)}
                              sx={{
                                width: 30,
                                height: 30,
                                color: COLORS.red,
                                bgcolor: COLORS.redSoft,

                                "&:hover": {
                                  bgcolor: "#FEE2E2",
                                },
                              }}
                            >
                              <DeleteOutline
                                sx={{
                                  fontSize: 17,
                                }}
                              />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </StyledTableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* =================================================
              PAGINATION
          ================================================= */}

          <Divider
            sx={{
              borderColor: COLORS.border,
            }}
          />

 <Box
  sx={{
    px: { xs: 1, sm: 1.5, md: 2 },
    py: { xs: 0.7, sm: 0.75, md: 1.15 },

    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    gap: { xs: 0.5, sm: 1 },

    width: "100%",
    boxSizing: "border-box",

    // Mobile = White | Desktop = Blue
    bgcolor: {
      xs: "#FFFFFF",
      sm: "rgba(24, 43, 138, 0.98)",
    },

    borderTop: {
      xs: "1px solid #E5E7EB",
      sm: `1px solid ${COLORS.primaryDark}`,
    },
  }}
>
  {/* =========================
      REPORT COUNT
  ========================= */}
  <Typography
    sx={{
      color: {
        xs: "#333333",
        sm: "rgba(255,255,255,0.8)",
      },

      fontSize: {
        xs: 10.5,
        sm: 11,
        md: 11.5,
      },

      fontWeight: 600,

      whiteSpace: "nowrap",
      flexShrink: 0,
    }}
  >
    Showing{" "}
    <Box
      component="span"
      sx={{
        color: {
          xs: "#111111",
          sm: "#FFFFFF",
        },
        fontWeight: 800,
      }}
    >
      {reports.length}
    </Box>{" "}
    of{" "}
    <Box
      component="span"
      sx={{
        color: {
          xs: "#111111",
          sm: "#FFFFFF",
        },
        fontWeight: 800,
      }}
    >
      {totalCount}
    </Box>{" "}
    reports
  </Typography>

  {/* =========================
      PAGINATION
  ========================= */}
  <Pagination
    size="small"
    count={totalPages}
    page={page}
    onChange={(_event, value) =>
      loadReports({
        page: value,
      })
    }
    siblingCount={1}
    boundaryCount={0}
    sx={{
      flexShrink: 0,

      "& .MuiPagination-ul": {
        flexWrap: "nowrap",
        gap: 0,
      },

      "& .MuiPaginationItem-root": {
        minWidth: {
          xs: 24,
          sm: 28,
          md: 30,
        },

        width: {
          xs: 24,
          sm: 28,
          md: 30,
        },

        height: {
          xs: 24,
          sm: 28,
          md: 30,
        },

        padding: 0,

        margin: "0 1px",

        fontSize: {
          xs: 10,
          sm: 11,
          md: 12,
        },

        fontWeight: 700,

        borderRadius: {
          xs: 1,
          sm: 1.5,
        },

        border: {
          xs: "none",
          sm: "1px solid rgba(255,255,255,0.25)",
        },

        color: {
          xs: "rgba(24, 43, 138, 0.98)",
          sm: "#FFFFFF",
        },
      },

      // Hover
      "& .MuiPaginationItem-root:hover": {
        bgcolor: {
          xs: "rgba(24, 43, 138, 0.07)",
          sm: "rgba(255,255,255,0.15)",
        },

        borderColor: {
          xs: "transparent",
          sm: "#FFFFFF",
        },
      },

      // Active page
      "& .MuiPaginationItem-root.Mui-selected": {
        bgcolor: {
          xs: "rgba(24, 43, 138, 0.98) !important",
          sm: "#FFFFFF !important",
        },

        color: {
          xs: "#FFFFFF !important",
          sm: `${COLORS.primary} !important`,
        },

        borderColor: {
          xs: "transparent !important",
          sm: "#FFFFFF !important",
        },

        fontWeight: 800,
      },

      // Previous / Next
      "& .MuiPaginationItem-previousNext": {
        color: {
          xs: "rgba(24, 43, 138, 0.98)",
          sm: "#FFFFFF",
        },

        border: {
          xs: "none",
          sm: "1px solid rgba(255,255,255,0.25)",
        },
      },

      // Ellipsis
      "& .MuiPaginationItem-ellipsis": {
        color: {
          xs: "rgba(24, 43, 138, 0.98)",
          sm: "#FFFFFF",
        },
      },
    }}
  />
</Box>
        </Paper>
      </Container>

      {/* =====================================================
          DELETE DIALOG
      ===================================================== */}

      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: COLORS.surface,
            borderRadius: 2.5,
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 20px 50px rgba(15,23,42,.16)",
          },
        }}
      >
        <DialogContent
          sx={{
            p: { xs: 2.5, sm: 3 },
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box
              sx={{
                width: 42,
                height: 42,
                flexShrink: 0,
                borderRadius: 2,
                bgcolor: COLORS.redSoft,
                color: COLORS.red,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #FECACA",
              }}
            >
              <DeleteOutline sx={{ fontSize: 22 }} />
            </Box>

            <Box>
              <Typography
                sx={{
                  color: COLORS.textMain,
                  fontSize: 16,
                  fontWeight: 800,
                  lineHeight: 1.25,
                }}
              >
                Delete this report?
              </Typography>

              {deleteTarget && (
                <Typography
                  sx={{
                    color: COLORS.textSecondary,
                    fontSize: 12,
                    mt: 0.55,
                    fontWeight: 600,
                  }}
                >
                  {deleteTarget.date} —{" "}
                  {deleteTarget.teacher?.name || "Unknown Teacher"}
                </Typography>
              )}

              <Typography
                sx={{
                  color: COLORS.textMuted,
                  fontSize: 11.5,
                  mt: 0.65,
                  lineHeight: 1.5,
                }}
              >
                This action cannot be undone.
              </Typography>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: { xs: 2.5, sm: 3 },
            pb: { xs: 2.5, sm: 3 },
            pt: 0,
            gap: 1,
          }}
        >
          <Button
            fullWidth
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            sx={{
              height: 38,
              color: COLORS.textSecondary,
              bgcolor: COLORS.surfaceSoft,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 1.75,
              textTransform: "none",
              fontSize: 12.5,
              fontWeight: 700,

              "&:hover": {
                bgcolor: "#F1F5F9",
              },
            }}
          >
            Cancel
          </Button>

          <Button
            fullWidth
            onClick={handleDeleteConfirmed}
            variant="contained"
            disabled={deleting}
            sx={{
              height: 38,
              bgcolor: COLORS.red,
              borderRadius: 1.75,
              textTransform: "none",
              fontSize: 12.5,
              fontWeight: 700,
              boxShadow: "none",

              "&:hover": {
                bgcolor: COLORS.redDark,
                boxShadow: "none",
              },
            }}
          >
            {deleting ? (
              <CircularProgress
                size={18}
                sx={{
                  color: "#fff",
                }}
              />
            ) : (
              "Delete"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* =====================================================
          REPORT DETAIL DIALOG
      ===================================================== */}


<Dialog
  open={!!selectedReport}
  onClose={() => setSelectedReport(null)}
  maxWidth="md"
  fullWidth
  PaperProps={{
    sx: {
      bgcolor: COLORS.surface,
      borderRadius: 2.5,
      border: `1px solid ${COLORS.border}`,
      boxShadow: "0 22px 60px rgba(15,23,42,.18)",
      overflow: "hidden",
      maxHeight: "92vh",
    },
  }}
>
  {/* =================================================
      DIALOG HEADER
  ================================================= */}

  <DialogTitle
    sx={{
      p: 0,
      bgcolor: COLORS.primary,
      color: "#fff",
    }}
  >
    <Box
      sx={{
        px: { xs: 1.75, sm: 2.5 },
        py: 1.65,
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
      >
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 1.75,
              bgcolor: "rgba(255,255,255,.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(255,255,255,.18)",
            }}
          >
            <DescriptionOutlined sx={{ fontSize: 21 }} />
          </Box>

          <Box>
            <Typography
              sx={{
                fontSize: { xs: 14, sm: 15 },
                fontWeight: 800,
                lineHeight: 1.2,
              }}
            >
              Duty Officer's Inspection Checklist
            </Typography>

            <Typography
              sx={{
                fontSize: 10.5,
                opacity: 0.78,
                mt: 0.3,
              }}
            >
              Submitted report — view only
            </Typography>
          </Box>
        </Stack>

        <IconButton
          size="small"
          onClick={() => setSelectedReport(null)}
          sx={{
            color: "#fff",
            bgcolor: "rgba(255,255,255,.10)",

            "&:hover": {
              bgcolor: "rgba(255,255,255,.18)",
            },
          }}
        >
          <Close sx={{ fontSize: 19 }} />
        </IconButton>
      </Stack>
    </Box>

    <Box
      sx={{
        height: 3,
        bgcolor: COLORS.red,
      }}
    />
  </DialogTitle>

  {/* =================================================
      CONTENT
  ================================================= */}

  <DialogContent
    dividers
    sx={{
      borderColor: COLORS.border,
      p: { xs: 1.25, sm: 2 },
      bgcolor: "#FBFCFE",
    }}
  >
    {selectedReport && (
      <Stack spacing={1.5}>

        {/* =================================================
            BASIC INFORMATION
        ================================================= */}

        <Box>
          <Typography
            sx={{
              color: COLORS.primary,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".5px",
              mb: 0.75,
            }}
          >
            BASIC INFORMATION
          </Typography>

          <Box
            sx={{
              bgcolor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 1.75,
              overflow: "hidden",
            }}
          >
            <Grid container>
              <Grid item xs={12} sm={4}>
                <Box sx={{ p: 1.25 }}>
                  <Typography
                    sx={{
                      color: COLORS.textMuted,
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: ".45px",
                    }}
                  >
                    DATE
                  </Typography>

                  <Typography
                    sx={{
                      color: COLORS.textMain,
                      fontSize: 13,
                      fontWeight: 700,
                      mt: 0.25,
                    }}
                  >
                    {selectedReport.date || "—"}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={4}>
                <Box sx={{ p: 1.25 }}>
                  <Typography
                    sx={{
                      color: COLORS.textMuted,
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: ".45px",
                    }}
                  >
                    DUTY OFFICER
                  </Typography>

                  <Typography
                    sx={{
                      color: COLORS.textMain,
                      fontSize: 13,
                      fontWeight: 700,
                      mt: 0.25,
                    }}
                  >
                    {selectedReport.teacher?.name || "Unknown"}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={4}>
                <Box sx={{ p: 1.25 }}>
                  <Typography
                    sx={{
                      color: COLORS.textMuted,
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: ".45px",
                    }}
                  >
                    CENTRE / BATCH
                  </Typography>

                  <Typography
                    sx={{
                      color: COLORS.textMain,
                      fontSize: 13,
                      fontWeight: 700,
                      mt: 0.25,
                    }}
                  >
                    {selectedReport.centreBatch || "—"}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Box>

        {/* =================================================
            SUBMITTED BY
        ================================================= */}

        <Box
          sx={{
            p: 1.25,
            bgcolor: COLORS.primarySoft,
            border: "1px solid #DBEAFE",
            borderRadius: 1.75,
          }}
        >
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Avatar
              sx={{
                width: 38,
                height: 38,
                fontSize: 11,
                fontWeight: 800,
                bgcolor: colorForName(
                  selectedReport.teacher?.name
                ),
              }}
            >
              {initials(selectedReport.teacher?.name)}
            </Avatar>

            <Box>
              <Typography
                sx={{
                  color: COLORS.primaryLight,
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: ".45px",
                }}
              >
                SUBMITTED BY
              </Typography>

              <Typography
                sx={{
                  color: COLORS.textMain,
                  fontSize: 13.5,
                  fontWeight: 800,
                }}
              >
                {selectedReport.teacher?.name || "Unknown"}
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* =================================================
            CHECKLIST PROGRESS
        ================================================= */}

        {(() => {
          const checklistSections = [
            {
              key: "morningChecks",
              title: "Readiness Check",
            },
            {
              key: "middayChecks",
              title: "Assets Inspection",
            },
            {
              key: "afternoonChecks",
              title: " Maintenance Round",
            },
          ];

          const allChecks = checklistSections.flatMap(
            (section) =>
              Array.isArray(selectedReport[section.key])
                ? selectedReport[section.key]
                : []
          );

          const totalChecks = allChecks.length;

          const completedChecks = allChecks.filter(
            (item) =>
              item?.completed === true ||
              item?.checked === true ||
              item?.value === true
          ).length;

          return (
            <>
              {/* =================================================
                  PROGRESS
              ================================================= */}

              <Box
                sx={{
                  bgcolor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 1.75,
                  p: 1.35,
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 0.8 }}
                >
                  <Typography
                    sx={{
                      color: COLORS.primary,
                      fontSize: 11.5,
                      fontWeight: 800,
                    }}
                  >
                    CHECKLIST COMPLETION
                  </Typography>

                  <Chip
                    size="small"
                    label={`${completedChecks} / ${totalChecks}`}
                    sx={{
                      height: 24,
                      bgcolor:
                        totalChecks > 0 &&
                        completedChecks === totalChecks
                          ? COLORS.greenSoft
                          : COLORS.primarySoft,
                      color:
                        totalChecks > 0 &&
                        completedChecks === totalChecks
                          ? COLORS.green
                          : COLORS.primary,
                      fontSize: 10.5,
                      fontWeight: 800,
                      borderRadius: 1.5,
                    }}
                  />
                </Stack>

                <Box
                  sx={{
                    height: 7,
                    bgcolor: "#E2E8F0",
                    borderRadius: 99,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      width:
                        totalChecks > 0
                          ? `${(completedChecks / totalChecks) * 100}%`
                          : "0%",
                      height: "100%",
                      bgcolor:
                        completedChecks === totalChecks &&
                        totalChecks > 0
                          ? COLORS.green
                          : COLORS.primaryLight,
                      borderRadius: 99,
                      transition: "width .3s ease",
                    }}
                  />
                </Box>
              </Box>

              {/* =================================================
                  CHECKLIST SECTIONS
              ================================================= */}

              {checklistSections.map((section, sectionIndex) => {
                const checks = Array.isArray(
                  selectedReport[section.key]
                )
                  ? selectedReport[section.key]
                  : [];

                return (
                  <Box key={section.key}>
                    <Typography
                      sx={{
                        color: COLORS.primary,
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: ".5px",
                        mb: 0.75,
                      }}
                    >
                      {sectionIndex + 1}. {section.title}
                    </Typography>

                    <Box
                      sx={{
                        bgcolor: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 1.75,
                        overflow: "hidden",
                      }}
                    >
                      {checks.length === 0 ? (
                        <Box sx={{ p: 1.35 }}>
                          <Typography
                            sx={{
                              color: COLORS.textMuted,
                              fontSize: 12,
                              fontStyle: "italic",
                            }}
                          >
                            No checklist items recorded.
                          </Typography>
                        </Box>
                      ) : (
                        checks.map((item, index) => {
                          const isCompleted =
                            item?.completed === true ||
                            item?.checked === true ||
                            item?.value === true;

                          const label =
                            item?.label ||
                            item?.question ||
                            item?.title ||
                            item?.name ||
                            `Checklist item ${index + 1}`;

                          const remark =
                            item?.remark ||
                            item?.remarks ||
                            item?.note ||
                            "";

                          return (
                            <Box
                              key={item?._id || index}
                              sx={{
                                px: 1.25,
                                py: 1,
                                borderBottom:
                                  index !== checks.length - 1
                                    ? `1px solid ${COLORS.border}`
                                    : "none",
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="flex-start"
                              >
                                <Chip
                                  size="small"
                                  label={
                                    isCompleted
                                      ? "Completed"
                                      : "Not Completed"
                                  }
                                  sx={{
                                    flexShrink: 0,
                                    mt: 0.05,
                                    height: 22,
                                    bgcolor: isCompleted
                                      ? COLORS.greenSoft
                                      : COLORS.redSoft,
                                    color: isCompleted
                                      ? COLORS.green
                                      : COLORS.red,
                                    border: `1px solid ${
                                      isCompleted
                                        ? "#BBF7D0"
                                        : "#FECACA"
                                    }`,
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    borderRadius: 1.25,
                                  }}
                                />

                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography
                                    sx={{
                                      color: COLORS.textMain,
                                      fontSize: 12,
                                      fontWeight: 650,
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    {label}
                                  </Typography>

                                  {remark && (
                                    <Typography
                                      sx={{
                                        color: COLORS.textMuted,
                                        fontSize: 11,
                                        lineHeight: 1.45,
                                        mt: 0.35,
                                      }}
                                    >
                                      Remark: {remark}
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                            </Box>
                          );
                        })
                      )}
                    </Box>
                  </Box>
                );
              })}
            </>
          );
        })()}

        {/* =================================================
            POSITIVE OBSERVATIONS
        ================================================= */}

        <Box
          sx={{
            bgcolor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 1.75,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: 1.25,
              py: 0.8,
              bgcolor: COLORS.greenSoft,
              borderBottom: "1px solid #BBF7D0",
            }}
          >
            <Typography
              sx={{
                color: COLORS.green,
                fontSize: 11.5,
                fontWeight: 800,
              }}
            >
              Major Positive Observations
            </Typography>
          </Box>

          <Box sx={{ p: 1.25 }}>
            <Typography
              sx={{
                color: COLORS.textSecondary,
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedReport.positiveObservations ||
                "None reported"}
            </Typography>
          </Box>
        </Box>

        {/* =================================================
            HYGIENE LAPSES
        ================================================= */}

        <Box
          sx={{
            bgcolor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 1.75,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: 1.25,
              py: 0.8,
              bgcolor: "#FFF7ED",
              borderBottom: "1px solid #FED7AA",
            }}
          >
            <Typography
              sx={{
                color: "#B45309",
                fontSize: 11.5,
                fontWeight: 800,
              }}
            >
              Cleanliness / Hygiene Lapses
            </Typography>
          </Box>

          <Box sx={{ p: 1.25 }}>
            <Typography
              sx={{
                color: COLORS.textSecondary,
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedReport.hygieneLapses ||
                "None reported"}
            </Typography>
          </Box>
        </Box>

        {/* =================================================
            MAINTENANCE FOLLOW-UP
        ================================================= */}

        <Box
          sx={{
            bgcolor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 1.75,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: 1.25,
              py: 0.8,
              bgcolor: COLORS.primarySoft,
              borderBottom: "1px solid #DBEAFE",
            }}
          >
            <Typography
              sx={{
                color: COLORS.primary,
                fontSize: 11.5,
                fontWeight: 800,
              }}
            >
              Maintenance Follow-up
            </Typography>
          </Box>

          <Box sx={{ p: 1.25 }}>
            <Typography
              sx={{
                color: COLORS.textSecondary,
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedReport.maintenanceFollowUp ||
                "None reported"}
            </Typography>
          </Box>
        </Box>

        {/* =================================================
            URGENT MATTERS
        ================================================= */}

        <Box
          sx={{
            p: 1.25,
            bgcolor: selectedReport.urgentMatters
              ? COLORS.redSoft
              : COLORS.surfaceSoft,
            border: `1px solid ${
              selectedReport.urgentMatters
                ? "#FECACA"
                : COLORS.border
            }`,
            borderRadius: 1.75,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-start"
          >
            <WarningAmberOutlined
              sx={{
                fontSize: 19,
                color: selectedReport.urgentMatters
                  ? COLORS.red
                  : COLORS.textMuted,
              }}
            />

            <Box>
              <Typography
                sx={{
                  color: selectedReport.urgentMatters
                    ? COLORS.redDark
                    : COLORS.textSecondary,
                  fontSize: 11.5,
                  fontWeight: 800,
                }}
              >
                Urgent Matters
              </Typography>

              <Typography
                sx={{
                  color: COLORS.textSecondary,
                  fontSize: 12,
                  lineHeight: 1.55,
                  mt: 0.25,
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedReport.urgentMatters ||
                  "None reported"}
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* =================================================
            VERIFICATION / SIGNATURE
        ================================================= */}

        <Box>
          <Typography
            sx={{
              color: COLORS.primary,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".5px",
              mb: 0.75,
            }}
          >
            VERIFICATION
          </Typography>

          <Grid container spacing={1.25}>
            <Grid item xs={12} sm={6}>
              <Box
                sx={{
                  bgcolor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 1.75,
                  p: 1.35,
                  minHeight: 80,
                }}
              >
                <Typography
                  sx={{
                    color: COLORS.textMuted,
                    fontSize: 9.5,
                    fontWeight: 800,
                    letterSpacing: ".45px",
                  }}
                >
                  SIGNATURE
                </Typography>

                {selectedReport.signature ? (
                  typeof selectedReport.signature === "string" &&
                  selectedReport.signature.startsWith("data:image") ? (
                    <Box
                      component="img"
                      src={selectedReport.signature}
                      alt="Duty Officer Signature"
                      sx={{
                        display: "block",
                        maxWidth: "100%",
                        maxHeight: 55,
                        mt: 0.75,
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <Typography
                      sx={{
                        color: COLORS.textMain,
                        fontSize: 12,
                        fontWeight: 700,
                        mt: 0.6,
                        wordBreak: "break-word",
                      }}
                    >
                      {selectedReport.signature}
                    </Typography>
                  )
                ) : (
                  <Typography
                    sx={{
                      color: COLORS.textMuted,
                      fontSize: 12,
                      mt: 0.6,
                      fontStyle: "italic",
                    }}
                  >
                    No signature provided
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box
                sx={{
                  bgcolor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 1.75,
                  p: 1.35,
                  minHeight: 80,
                }}
              >
                <Typography
                  sx={{
                    color: COLORS.textMuted,
                    fontSize: 9.5,
                    fontWeight: 800,
                    letterSpacing: ".45px",
                  }}
                >
                  COUNTERSIGNED BY
                </Typography>

                <Typography
                  sx={{
                    color: COLORS.textMain,
                    fontSize: 13,
                    fontWeight: 700,
                    mt: 0.55,
                    wordBreak: "break-word",
                  }}
                >
                  {selectedReport.countersignedBy ||
                    "Not countersigned"}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Stack>
    )}
  </DialogContent>

  {/* =================================================
      FOOTER
  ================================================= */}

  <DialogActions
    sx={{
      p: 1.5,
      bgcolor: COLORS.surface,
      borderTop: `1px solid ${COLORS.border}`,
    }}
  >
    <Button
      onClick={() => setSelectedReport(null)}
      variant="contained"
      sx={{
        minWidth: 82,
        height: 38,
        bgcolor: COLORS.primary,
        borderRadius: 1.75,
        px: 2,
        textTransform: "none",
        fontSize: 12.5,
        fontWeight: 700,
        boxShadow: "none",

        "&:hover": {
          bgcolor: COLORS.primaryDark,
          boxShadow: "none",
        },
      }}
    >
      Close
    </Button>
  </DialogActions>
</Dialog>


    </Box>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminDashboardInner />
    </ProtectedRoute>
  );
}
