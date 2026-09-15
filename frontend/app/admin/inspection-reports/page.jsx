"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  DeleteOutline,
  Download,
  ReportProblemOutlined,
  Visibility,
} from "@mui/icons-material";

import ProtectedRoute from "../../../components/ProtectedRoute";
import Navbar from "../../../components/Navbar";
import api, { downloadInspectionReportPdf, downloadInspectionReportsBulkPdf } from "../../../lib/api";

const ROWS_PER_PAGE = 15;

function AdminInspectionReportsInner() {
  const router = useRouter();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [deleting, setDeleting] = useState(null);

  // ---- Selection + PDF download state ----
  const [selectedIds, setSelectedIds] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  /* =====================================================
     LOAD REPORTS
  ===================================================== */

  const load = (nextPage = 1) => {
    setLoading(true);
    setError("");

    api
      .get("/inspection-reports", {
        params: {
          page: nextPage,
          limit: ROWS_PER_PAGE,
        },
      })
      .then((res) => {
        setReports(res.data?.reports || []);

        setTotalPages(
          res.data?.pagination?.totalPages || 1
        );

        setTotal(
          res.data?.pagination?.total || 0
        );

        setPage(
          res.data?.pagination?.page || nextPage
        );

        setSelectedIds([]);
      })
      .catch((err) => {
        setError(
          err?.response?.data?.message ||
            "Could not load inspection reports."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    load(1);
  }, []);

  /* =====================================================
     SELECTION
  ===================================================== */

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === reports.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(reports.map((r) => r._id));
    }
  };

  /* =====================================================
     DOWNLOAD
  ===================================================== */

  const handleDownloadOne = async (report) => {
    setDownloadingId(report._id);
    setError("");
    try {
      await downloadInspectionReportPdf(report._id, report.reportedBy?.name || "report");
    } catch (err) {
      setError(err.message || "Could not download PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadSelected = async () => {
    if (!selectedIds.length) return;
    setBulkDownloading(true);
    setError("");
    try {
      await downloadInspectionReportsBulkPdf(selectedIds);
    } catch (err) {
      setError(err.message || "Could not download combined PDF.");
    } finally {
      setBulkDownloading(false);
    }
  };

  /* =====================================================
     DELETE REPORT
  ===================================================== */

  const handleDelete = async (reportId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this inspection report?\n\nThis action cannot be undone."
    );

    if (!confirmed) return;

    setDeleting(reportId);
    setError("");

    try {
      await api.delete(
        `/inspection-reports/${reportId}`
      );

      /*
       * If deleting the last item of the current page,
       * move back one page where required.
       */
      if (
        reports.length === 1 &&
        page > 1
      ) {
        load(page - 1);
      } else {
        load(page);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not delete inspection report."
      );
    } finally {
      setDeleting(null);
    }
  };

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <Box
      sx={{
        bgcolor: "#faf9fb",
        minHeight: "100vh",
      }}
    >
      <Navbar />

      <Container
        maxWidth="lg"
        sx={{
          py: {
            xs: 2,
            sm: 3,
          },
          px: {
            xs: 1.5,
            sm: 2,
          },
        }}
      >
        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={1.5}
          sx={{
            mb: {
              xs: 1.75,
              sm: 2.5,
            },
          }}
        >
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box
              sx={{
                width: {
                  xs: 36,
                  sm: 40,
                },

                height: {
                  xs: 36,
                  sm: 40,
                },

                borderRadius: 2,

                bgcolor: "#1c28ce",

                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                flexShrink: 0,
              }}
            >
              <ReportProblemOutlined
                sx={{
                  color: "white",
                  fontSize: {
                    xs: 20,
                    sm: 22,
                  },
                }}
              />
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: {
                    xs: 18,
                    sm: 22,
                  },

                  fontWeight: 800,

                  lineHeight: 1.25,
                }}
              >
                Inspection Reports
              </Typography>

              <Typography
                sx={{
                  fontSize: {
                    xs: 11,
                    sm: 13,
                  },

                  color: "text.secondary",

                  mt: 0.25,
                }}
              >
                {total} submitted report
                {total === 1 ? "" : "s"}
              </Typography>
            </Box>
          </Stack>

          <Button
            variant="contained"
            startIcon={bulkDownloading ? <CircularProgress size={16} color="inherit" /> : <Download />}
            onClick={handleDownloadSelected}
            disabled={selectedIds.length === 0 || bulkDownloading}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              alignSelf: { xs: "stretch", sm: "auto" },
            }}
          >
            {bulkDownloading
              ? "Preparing PDF..."
              : `Download Selected (${selectedIds.length}) as PDF`}
          </Button>
        </Stack>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 2,
              borderRadius: 1.5,
            }}
            onClose={() => setError("")}
          >
            {error}
          </Alert>
        )}

        {/* =================================================
            TABLE CARD
        ================================================= */}

        <Paper
          elevation={0}
          sx={{
            p: {
              xs: 1,
              sm: 1.5,
            },

            border:
              "1px solid #e2e8f0",

            borderRadius: 2.5,

            backgroundColor: "#fff",

            overflow: "hidden",
          }}
        >
          {/* =================================================
              LOADING
          ================================================= */}

          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                py: 6,
              }}
            >
              <CircularProgress
                size={26}
                sx={{
                  color: "#1c28ce",
                }}
              />
            </Box>
          ) : reports.length === 0 ? (
            /* =================================================
               EMPTY
            ================================================= */

            <Box
              sx={{
                py: 5,
                textAlign: "center",
              }}
            >
              <ReportProblemOutlined
                sx={{
                  fontSize: 40,
                  color: "#cbd5e1",
                  mb: 1,
                }}
              />

              <Typography
                sx={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "text.secondary",
                }}
              >
                No inspection reports
                submitted yet.
              </Typography>
            </Box>
          ) : (
            /* =================================================
               TABLE
            ================================================= */

            <TableContainer
              sx={{
                overflowX: "auto",
              }}
            >
              <Table
                size="small"
                sx={{
                  minWidth: 760,

                  "& .MuiTableCell-root": {
                    borderColor: "#eef2f6",
                  },
                }}
              >
                {/* =================================================
                    TABLE HEAD
                ================================================= */}

                <TableHead>
                  <TableRow
                    sx={{
                      "& th": {
                        bgcolor: "#eef4ff",

                        fontWeight: 800,

                        color: "#1e3a5f",

                        fontSize: 12,

                        whiteSpace: "nowrap",

                        py: 1.25,
                      },
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={reports.length > 0 && selectedIds.length === reports.length}
                        indeterminate={selectedIds.length > 0 && selectedIds.length < reports.length}
                        onChange={toggleSelectAll}
                      />
                    </TableCell>

                    <TableCell>
                      Submitted By
                    </TableCell>

                    <TableCell>
                      Submitted On
                    </TableCell>

                    <TableCell align="center">
                      Issues
                    </TableCell>

                    <TableCell align="center">
                      Open
                    </TableCell>

                    <TableCell align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>

                {/* =================================================
                    TABLE BODY
                ================================================= */}

                <TableBody>
                  {reports.map((r) => {
                    const openCount = (
                      r.issues || []
                    ).filter(
                      (i) =>
                        i.status !==
                        "resolved"
                    ).length;

                    const issueCount =
                      r.issues?.length || 0;

                    return (
                      <TableRow
                        key={r._id}
                        hover
                        selected={selectedIds.includes(r._id)}
                        sx={{
                          "&:last-child td": {
                            borderBottom: 0,
                          },

                          "& td": {
                            py: 1.2,
                            fontSize: 13,
                          },
                        }}
                      >
                        {/* =================================================
                            SELECT
                        ================================================= */}

                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={selectedIds.includes(r._id)}
                            onChange={() => toggleSelect(r._id)}
                          />
                        </TableCell>

                        {/* =================================================
                            SUBMITTED BY
                        ================================================= */}

                        <TableCell>
                          <Typography
                            sx={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#1f2937",
                            }}
                          >
                            {r.reportedBy
                              ?.name ||
                              "Unknown"}
                          </Typography>

                          <Typography
                            sx={{
                              fontSize: 11,
                              color:
                                "text.secondary",

                              mt: 0.2,
                            }}
                          >
                            {r.reportedBy
                              ?.email ||
                              "-"}
                          </Typography>
                        </TableCell>

                        {/* =================================================
                            DATE
                        ================================================= */}

                        <TableCell
                          sx={{
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {r.submittedAt
                            ? new Date(
                                r.submittedAt
                              ).toLocaleString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "-"}
                        </TableCell>

                        {/* =================================================
                            ISSUES
                        ================================================= */}

                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={issueCount}
                            sx={{
                              height: 24,

                              minWidth: 32,

                              fontSize: 11,

                              fontWeight: 700,

                              bgcolor:
                                "#f1f5f9",

                              color:
                                "#334155",
                            }}
                          />
                        </TableCell>

                        {/* =================================================
                            OPEN ISSUES
                        ================================================= */}

                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={openCount}
                            color={
                              openCount
                                ? "error"
                                : "success"
                            }
                            variant="outlined"
                            sx={{
                              height: 24,

                              minWidth: 32,

                              fontSize: 11,

                              fontWeight: 700,
                            }}
                          />
                        </TableCell>

                        {/* =================================================
                            ACTIONS
                        ================================================= */}

                        <TableCell align="right">
                          <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="flex-end"
                            alignItems="center"
                          >
                            {/* DOWNLOAD PDF */}

                            <Tooltip title="Download PDF">
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={downloadingId === r._id}
                                  onClick={() => handleDownloadOne(r)}
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    color: "#7e22ce",
                                    borderRadius: 1.5,
                                    "&:hover": { bgcolor: "#f5f3ff" },
                                  }}
                                >
                                  {downloadingId === r._id ? (
                                    <CircularProgress size={16} color="inherit" />
                                  ) : (
                                    <Download fontSize="small" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>

                            {/* VIEW */}

                            <Tooltip title="View report">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  router.push(
                                    `/admin/inspection-reports/${r._id}`
                                  )
                                }
                                sx={{
                                  width: 32,
                                  height: 32,

                                  color:
                                    "#1e3a5f",

                                  borderRadius:
                                    1.5,

                                  "&:hover": {
                                    bgcolor:
                                      "#eef4ff",
                                  },
                                }}
                              >
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* DELETE */}

                            <Tooltip title="Delete report">
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={
                                    deleting ===
                                    r._id
                                  }
                                  onClick={() =>
                                    handleDelete(
                                      r._id
                                    )
                                  }
                                  sx={{
                                    width: 32,
                                    height: 32,

                                    color:
                                      "#dc2626",

                                    borderRadius:
                                      1.5,

                                    "&:hover": {
                                      bgcolor:
                                        "#fef2f2",
                                    },

                                    "&.Mui-disabled":
                                      {
                                        color:
                                          "#fca5a5",
                                      },
                                  }}
                                >
                                  {deleting ===
                                  r._id ? (
                                    <CircularProgress
                                      size={16}
                                      color="inherit"
                                    />
                                  ) : (
                                    <DeleteOutline fontSize="small" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* =================================================
              PAGINATION
          ================================================= */}

          {!loading &&
            totalPages > 1 && (
              <Stack
                direction={{
                  xs: "column",
                  sm: "row",
                }}
                justifyContent="flex-end"
                alignItems={{
                  xs: "center",
                  sm: "center",
                }}
                sx={{
                  mt: 1.5,
                  pt: 1.5,

                  borderTop:
                    "1px solid #e2e8f0",
                }}
              >
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(
                    _event,
                    value
                  ) => {
                    load(value);
                  }}
                  size="small"
                  shape="rounded"
                  color="primary"
                />
              </Stack>
            )}
        </Paper>
      </Container>
    </Box>
  );
}

/* =========================================================
   PROTECTED PAGE
========================================================= */

export default function AdminInspectionReportsPage() {
  return (
    <ProtectedRoute role="superadmin">
      <AdminInspectionReportsInner />
    </ProtectedRoute>
  );
}