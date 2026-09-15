const path = require("path");
const fs = require("fs");
const axios = require("axios");

// ============================================================
// SLEEPWELL PDF BRANDING
// ============================================================

const SLEEPWELL_LOGO = path.join(
  "C:",
  "Workspace",
  "sms",
  "frontend",
  "public",
  "login-bg.png"
);

// ============================================================
// CLOUDINARY IMAGE
// ============================================================

const optimizeCloudinaryUrl = (
  url,
  { width = 500, quality = "auto:low" } = {}
) => {
  if (!url || !url.includes("/upload/")) {
    return url;
  }

  return url.replace(
    "/upload/",
    `/upload/w_${width},q_${quality},f_auto/`
  );
};

const fetchImageBuffer = async (url) => {
  try {
    const res = await axios.get(
      optimizeCloudinaryUrl(url),
      {
        responseType: "arraybuffer",
        timeout: 15000,
      }
    );

    return Buffer.from(res.data);
  } catch (err) {
    console.error(
      "PDF image fetch failed:",
      url,
      err.message
    );

    return null;
  }
};

// ============================================================
// SPACE CHECK
// ============================================================

const ensureSpace = (doc, needed) => {
  const bottom =
    doc.page.height -
    doc.page.margins.bottom;

  if (doc.y + needed > bottom) {
    doc.addPage();
  }
};

// ============================================================
// DIMENSIONS
// ============================================================

const dimensionsLabel = (issue) => {
  if (!issue.length && !issue.height) {
    return null;
  }

  const parts = [];

  if (issue.length) {
    parts.push(
      `L: ${issue.length}${issue.unit || ""}`
    );
  }

  if (issue.height) {
    parts.push(
      `H: ${issue.height}${issue.unit || ""}`
    );
  }

  return parts.join("  x  ");
};

// ============================================================
// PREFETCH IMAGES
// ============================================================

const prefetchReportImages = async (report) => {
  const allUrls = (
    report.issues || []
  ).flatMap((issue) =>
    (issue.photos || [])
      .map((photo) => photo.url)
      .filter(Boolean)
  );

  const uniqueUrls = [
    ...new Set(allUrls),
  ];

  const buffers = await Promise.all(
    uniqueUrls.map((url) =>
      fetchImageBuffer(url)
    )
  );

  const map = new Map();

  uniqueUrls.forEach((url, index) => {
    map.set(url, buffers[index]);
  });

  return map;
};

// ============================================================
// BULK PDF HEADER
// IMPORTANT:
// THIS HEADER WILL BE CALLED ONLY ONCE
// ============================================================

const drawBulkPdfHeader = (doc) => {
  const left = doc.page.margins.left;

  const right =
    doc.page.width -
    doc.page.margins.right;

  const top = 35;

  const headerHeight = 105;

  // ----------------------------------------------------------
  // Header background
  // ----------------------------------------------------------

  doc
    .roundedRect(
      left,
      top,
      right - left,
      headerHeight,
      8
    )
    .fillColor("#f8fafc")
    .fill();

  // ----------------------------------------------------------
  // LEFT CONTENT
  // ----------------------------------------------------------

  const contentX = left + 18;

  doc
    .font("Helvetica-Bold")
    .fontSize(19)
    .fillColor("#123b66")
    .text(
      "Inspection and Maintenance Report",
      contentX,
      top + 18,
      {
        width: 330,
      }
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#c62828")
    .text(
      "Sleepwell Foundation",
      contentX,
      top + 48
    );

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#64748b")
    .text(
      "Mirpur, Khurja",
      contentX,
      top + 68
    );

  // ----------------------------------------------------------
  // RIGHT IMAGE
  // ----------------------------------------------------------

  if (fs.existsSync(SLEEPWELL_LOGO)) {
    try {
      doc.image(
        SLEEPWELL_LOGO,
        right - 135,
        top + 10,
        {
          fit: [120, 82],
          align: "center",
          valign: "center",
        }
      );
    } catch (error) {
      console.error(
        "PDF header image error:",
        error.message
      );
    }
  }

  // ----------------------------------------------------------
  // RED LINE
  // ----------------------------------------------------------

  doc
    .moveTo(
      left,
      top + headerHeight + 10
    )
    .lineTo(
      right,
      top + headerHeight + 10
    )
    .lineWidth(2)
    .strokeColor("#c62828")
    .stroke();

  doc.y =
    top +
    headerHeight +
    25;
};

// ============================================================
// DRAW FIELD
// ============================================================

const drawField = (
  doc,
  x,
  y,
  width,
  label,
  value,
  valueColor = "#334155"
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return y;
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor("#475569")
    .text(
      `${label}:`,
      x,
      y,
      {
        width: 78,
        continued: true,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(valueColor)
    .text(
      ` ${value}`,
      {
        width:
          width - 78,
      }
    );

  return doc.y + 3;
};

// ============================================================
// RENDER ONE ISSUE
// PHOTO LEFT + CONTENT RIGHT
// ============================================================

const renderIssue = (
  doc,
  issue,
  index,
  imageMap
) => {
  const left =
    doc.page.margins.left;

  const right =
    doc.page.width -
    doc.page.margins.right;

  const availableWidth =
    right - left;

  // ----------------------------------------------------------
  // COLUMNS
  // ----------------------------------------------------------

  const photoWidth = 145;
  const gap = 18;

  const contentX =
    left +
    photoWidth +
    gap;

  const contentWidth =
    availableWidth -
    photoWidth -
    gap;

  const startY = doc.y;

  // ----------------------------------------------------------
  // TITLE
  // ----------------------------------------------------------

  const title =
    issue.problemName ||
    "Inspection Issue";

  // ----------------------------------------------------------
  // PHOTOS
  // ----------------------------------------------------------

  const validBuffers =
    (issue.photos || [])
      .map((photo) =>
        imageMap.get(photo.url)
      )
      .filter(Boolean);

  const photoHeight = 100;
  const photoGap = 8;

  let photoBottom = startY;

  if (validBuffers.length) {
    validBuffers.forEach(
      (buffer, photoIndex) => {
        const y =
          startY +
          photoIndex *
            (photoHeight + photoGap);

        if (
          y + photoHeight >
          doc.page.height -
            doc.page.margins.bottom
        ) {
          return;
        }

        try {
          doc.image(
            buffer,
            left,
            y,
            {
              fit: [
                photoWidth,
                photoHeight,
              ],
              align: "center",
              valign: "center",
            }
          );

          doc
            .rect(
              left,
              y,
              photoWidth,
              photoHeight
            )
            .lineWidth(0.5)
            .strokeColor("#cbd5e1")
            .stroke();

          photoBottom =
            y + photoHeight;
        } catch (error) {
          console.error(
            "PDF image embed failed:",
            error.message
          );
        }
      }
    );
  } else {
    doc
      .roundedRect(
        left,
        startY,
        photoWidth,
        75,
        5
      )
      .fillColor("#f8fafc")
      .fill();

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#94a3b8")
      .text(
        "No photo available",
        left,
        startY + 30,
        {
          width: photoWidth,
          align: "center",
        }
      );

    photoBottom =
      startY + 75;
  }

  // ----------------------------------------------------------
  // RIGHT CONTENT
  // ----------------------------------------------------------

  let currentY = startY;

  // Issue name

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#123b66")
    .text(
      `${index + 1}. ${title}`,
      contentX,
      currentY,
      {
        width: contentWidth,
      }
    );

  currentY =
    doc.y + 8;

  // ----------------------------------------------------------
  // LOCATION
  // ----------------------------------------------------------

  currentY = drawField(
    doc,
    contentX,
    currentY,
    contentWidth,
    "Location",
    issue.location
  );

  // ----------------------------------------------------------
  // DIRECTION
  // ----------------------------------------------------------

  currentY = drawField(
    doc,
    contentX,
    currentY,
    contentWidth,
    "Direction",
    issue.direction
  );

  // ----------------------------------------------------------
  // BROKEN SINCE
  // ----------------------------------------------------------

  currentY = drawField(
    doc,
    contentX,
    currentY,
    contentWidth,
    "Since",
    issue.brokenSince
  );

  // ----------------------------------------------------------
  // QUANTITY
  // ----------------------------------------------------------

  if (
    issue.quantity !== undefined &&
    issue.quantity !== null
  ) {
    currentY = drawField(
      doc,
      contentX,
      currentY,
      contentWidth,
      "Quantity",
      issue.quantity
    );
  }

  // ----------------------------------------------------------
  // DIMENSIONS
  // ----------------------------------------------------------

  const dimensions =
    dimensionsLabel(issue);

  if (dimensions) {
    currentY = drawField(
      doc,
      contentX,
      currentY,
      contentWidth,
      "Dimensions",
      dimensions
    );
  }

  // ----------------------------------------------------------
  // ISSUE STATUS
  // ----------------------------------------------------------

  currentY = drawField(
    doc,
    contentX,
    currentY,
    contentWidth,
    "Status",
    issue.status === "resolved"
      ? "Resolved"
      : "Open",
    issue.status === "resolved"
      ? "#15803d"
      : "#dc2626"
  );

  // ----------------------------------------------------------
  // DESCRIPTION
  // ----------------------------------------------------------

  if (issue.description) {
    currentY += 5;

    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor("#475569")
      .text(
        "Description:",
        contentX,
        currentY
      );

    currentY =
      doc.y + 3;

    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#1e293b")
      .text(
        issue.description,
        contentX,
        currentY,
        {
          width: contentWidth,
          lineGap: 2,
        }
      );

    currentY =
      doc.y + 5;
  }

  // ----------------------------------------------------------
  // VOICE NOTE
  // ----------------------------------------------------------

  if (issue.voiceNote?.url) {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#2563eb")
      .text(
        "Voice Note:",
        contentX,
        currentY,
        {
          continued: true,
        }
      );

    doc
      .font("Helvetica")
      .fillColor("#2563eb")
      .text(
        ` ${
          issue.voiceNote
            .durationSeconds || 0
        }s`,
        {
          link:
            issue.voiceNote.url,
          underline: true,
        }
      );

    currentY =
      doc.y + 5;
  }

  // ----------------------------------------------------------
  // ADMIN REMARK
  // ----------------------------------------------------------

  if (issue.adminRemark) {
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor("#166534")
      .text(
        "Admin Remark:",
        contentX,
        currentY
      );

    currentY =
      doc.y + 3;

    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#166534")
      .text(
        issue.adminRemark,
        contentX,
        currentY,
        {
          width: contentWidth,
        }
      );

    currentY =
      doc.y + 5;
  }

  // ----------------------------------------------------------
  // MOVE BELOW BOTH COLUMNS
  // ----------------------------------------------------------

  doc.y =
    Math.max(
      photoBottom,
      currentY
    ) + 15;

  // ----------------------------------------------------------
  // SEPARATOR
  // ----------------------------------------------------------

  doc
    .moveTo(
      left,
      doc.y
    )
    .lineTo(
      right,
      doc.y
    )
    .lineWidth(0.5)
    .strokeColor("#e2e8f0")
    .stroke();

  doc.y += 12;
};

// ============================================================
// APPEND REPORT
//
// IMPORTANT:
// NO HEADER HERE
// NO REPORTED BY
// NO EMAIL
// NO SUBMITTED ON
// NO REPORT STATUS
// NO ISSUE COUNT
// ============================================================

const appendReportToPdf = async (
  doc,
  report,
  imageMap = null
) => {
  const images =
    imageMap ||
    (await prefetchReportImages(report));

  const issues =
    report.issues || [];

  if (!issues.length) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#64748b")
      .text(
        "No inspection issues found."
      );

    return;
  }

  // ----------------------------------------------------------
  // ONLY ACTUAL ISSUES
  // ----------------------------------------------------------

  for (
    let i = 0;
    i < issues.length;
    i++
  ) {
    const issue =
      issues[i];

    try {
      // Keep issue together as much as possible
      ensureSpace(doc, 130);

      renderIssue(
        doc,
        issue,
        i,
        images
      );
    } catch (error) {
      console.error(
        `PDF issue render failed ${i + 1}:`,
        error.message
      );

      doc
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor("#dc2626")
        .text(
          `Could not render issue ${
            issue?.problemName ||
            i + 1
          }.`
        );

      doc.y += 10;
    }
  }
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  appendReportToPdf,
  prefetchReportImages,
  drawBulkPdfHeader,
};