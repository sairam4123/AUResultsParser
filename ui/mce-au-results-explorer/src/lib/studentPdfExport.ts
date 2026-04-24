import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { CgpaBreakdownResponse, StudentResponse } from "./api";

type ChartCaptureTarget = {
  title: string;
  element: HTMLElement | null;
};

type CapturedChart = {
  title: string;
  imageDataUrl: string | null;
  pixelWidth: number;
  pixelHeight: number;
};

export type ExportStudentPdfParams = {
  student: StudentResponse["student"];
  cgpaBreakdown: CgpaBreakdownResponse;
  selectedSemesters: number[];
  department: string;
  batch: string | null;
  chartTargets: ChartCaptureTarget[];
};

const PAGE_MARGIN_X = 14;
const PAGE_MARGIN_Y = 12;
const PAGE_FOOTER_Y_OFFSET = 8;
const SEMESTER_BLOCK_SPACING = 18;
const CHART_CAPTURE_WIDTH_PX = 1400;

const normalizeSemesters = (semesters: number[]): number[] =>
  [...new Set(semesters)]
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b);

const sanitizeToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "na";

const fmt = (value: number | null | undefined, digits = 2): string => {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(digits);
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = src;
  });

const captureChartCanvasFromSvg = async (
  element: HTMLElement,
): Promise<HTMLCanvasElement | null> => {
  const svg = element.querySelector<SVGSVGElement>("svg.recharts-surface");
  if (!svg) {
    return null;
  }

  const sourceWidth =
    Number(svg.getAttribute("width")) || svg.clientWidth || element.clientWidth || 600;
  const sourceHeight =
    Number(svg.getAttribute("height")) || svg.clientHeight || 250;

  const targetWidth = Math.max(CHART_CAPTURE_WIDTH_PX, sourceWidth);
  const targetHeight = Math.max(
    Math.round((sourceHeight / Math.max(sourceWidth, 1)) * targetWidth),
    sourceHeight,
  );

  const svgClone = svg.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // Set the internal width/height to the target resolution for crisp rendering
  svgClone.setAttribute("width", String(targetWidth));
  svgClone.setAttribute("height", String(targetHeight));
  if (!svgClone.getAttribute("viewBox")) {
    svgClone.setAttribute("viewBox", `0 0 ${sourceWidth} ${sourceHeight}`);
  }

  const serialized = new XMLSerializer().serializeToString(svgClone);
  const blob = new Blob([serialized], {
    type: "image/svg+xml;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const captureChart = async (
  target: ChartCaptureTarget,
): Promise<CapturedChart> => {
  if (!target.element) {
    return {
      title: target.title,
      imageDataUrl: null,
      pixelWidth: 0,
      pixelHeight: 0,
    };
  }

  try {
    const svgCanvas = await captureChartCanvasFromSvg(target.element);
    const canvas =
      svgCanvas ??
      (await html2canvas(target.element, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      }));

    return {
      title: target.title,
      imageDataUrl: canvas.toDataURL("image/png"),
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
    };
  } catch {
    return {
      title: target.title,
      imageDataUrl: null,
      pixelWidth: 0,
      pixelHeight: 0,
    };
  }
};

const drawPageFooter = (doc: jsPDF) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setDrawColor(220, 226, 240);
  doc.setLineWidth(0.25);
  doc.line(
    PAGE_MARGIN_X,
    pageHeight - PAGE_FOOTER_Y_OFFSET - 4,
    pageWidth - PAGE_MARGIN_X,
    pageHeight - PAGE_FOOTER_Y_OFFSET - 4,
  );

  doc.setFont("helvetica", "normal");
  doc.setTextColor(92, 101, 124);
  doc.setFontSize(8.5);
  doc.text(
    "Generated from AU Results Explorer. Values are provisional.",
    PAGE_MARGIN_X,
    pageHeight - PAGE_FOOTER_Y_OFFSET,
  );
};

const drawFirstPage = (
  doc: jsPDF,
  params: {
    student: StudentResponse["student"];
    cgpaBreakdown: CgpaBreakdownResponse;
    semesters: number[];
    department: string;
    batch: string | null;
    charts: CapturedChart[];
  },
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN_X * 2;

  const semesterLabel =
    params.semesters.length > 0
      ? params.semesters.map((item) => `S${item}`).join(", ")
      : "-";

  let y = PAGE_MARGIN_Y;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 36, 72);
  doc.setFontSize(16);
  doc.text("Student Academic Profile", PAGE_MARGIN_X, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(78, 95, 128);
  doc.setFontSize(10);
  doc.text(
    `Department ${params.department}${params.batch ? ` | Batch ${params.batch}` : ""}`,
    PAGE_MARGIN_X,
    y + 10,
  );
  doc.text(`Selected semesters: ${semesterLabel}`, PAGE_MARGIN_X, y + 15);

  y += 20;

  doc.setFillColor(248, 250, 255);
  doc.setDrawColor(221, 228, 244);
  doc.roundedRect(PAGE_MARGIN_X, y, contentWidth, 23, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(24, 39, 77);
  doc.text(params.student.name, PAGE_MARGIN_X + 3, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(64, 79, 111);
  doc.text(`Register No: ${params.student.regno}`, PAGE_MARGIN_X + 3, y + 14);
  doc.text(
    `Current SGPA: ${fmt(params.student.sgpa)}   Rank: ${params.student.rank ?? "-"}`,
    PAGE_MARGIN_X + 3,
    y + 19,
  );

  y += 28;

  const metricBoxWidth = (contentWidth - 4) / 2;

  doc.setFillColor(35, 56, 133);
  doc.roundedRect(PAGE_MARGIN_X, y, metricBoxWidth, 20, 2, 2, "F");
  doc.setTextColor(241, 246, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Final CGPA", PAGE_MARGIN_X + 3, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(
    fmt(params.cgpaBreakdown.overall.cgpa),
    PAGE_MARGIN_X + 3,
    y + 16,
  );

  doc.setFillColor(149, 31, 67);
  doc.roundedRect(PAGE_MARGIN_X + metricBoxWidth + 4, y, metricBoxWidth, 20, 2, 2, "F");
  doc.setTextColor(255, 241, 245);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Total Arrears", PAGE_MARGIN_X + metricBoxWidth + 7, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(
    String(params.cgpaBreakdown.overall.arrears),
    PAGE_MARGIN_X + metricBoxWidth + 7,
    y + 16,
  );

  y += 24;

  const chartCount = Math.max(params.charts.length, 1);
  const reservedFooterSpace = PAGE_FOOTER_Y_OFFSET + 8;
  const availableChartSpace =
    pageHeight - reservedFooterSpace - y - chartCount * 6 - (chartCount - 1) * 8;
  const maxChartHeight = Math.max(
    30,
    Math.min(90, availableChartSpace / chartCount),
  );

  params.charts.forEach((chart) => {
    doc.setTextColor(39, 52, 82);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(chart.title, PAGE_MARGIN_X, y + 4);

    const chartY = y + 6;

    if (chart.imageDataUrl && chart.pixelWidth > 0 && chart.pixelHeight > 0) {
      const chartRatio = chart.pixelHeight / chart.pixelWidth;
      const naturalHeight = contentWidth * chartRatio;
      
      const finalDrawHeight = Math.min(naturalHeight, maxChartHeight);
      const finalDrawWidth = finalDrawHeight / chartRatio;
      const xOffset = PAGE_MARGIN_X + (contentWidth - finalDrawWidth) / 2;

      doc.addImage(
        chart.imageDataUrl,
        "PNG",
        xOffset,
        chartY,
        finalDrawWidth,
        finalDrawHeight,
      );
    } else {
      doc.setDrawColor(210, 218, 236);
      doc.roundedRect(PAGE_MARGIN_X, chartY, contentWidth, maxChartHeight, 2, 2, "S");
      doc.setFont("helvetica", "italic");
      doc.setTextColor(122, 132, 156);
      doc.setFontSize(9);
      doc.text("Chart capture unavailable for this section.", PAGE_MARGIN_X + 3, chartY + 7);
    }

    const drawHeightUsed = Math.min(
      chart.imageDataUrl ? contentWidth * (chart.pixelHeight / Math.max(chart.pixelWidth, 1)) : maxChartHeight,
      maxChartHeight
    );

    y += drawHeightUsed + 12;
  });

  drawPageFooter(doc);
};

const drawSecondPage = (
  doc: jsPDF,
  params: {
    cgpaBreakdown: CgpaBreakdownResponse;
    semesters: number[];
  },
) => {
  const semestersToExport = [...params.cgpaBreakdown.semesters]
    .filter((item) => params.semesters.includes(item.semester))
    .sort((a, b) => a.semester - b.semester);

  if (semestersToExport.length === 0) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 36, 72);
    doc.setFontSize(15);
    doc.text("Semester-wise Grades and SGPA", PAGE_MARGIN_X, PAGE_MARGIN_Y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(78, 95, 128);
    doc.setFontSize(10);
    doc.text("No semester records found for the current selection.", PAGE_MARGIN_X, PAGE_MARGIN_Y + 12);
    drawPageFooter(doc);
    return;
  }

  const drawSemesterSummaryAtEnd = () => {
    doc.addPage();

    let y = PAGE_MARGIN_Y;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 36, 72);
    doc.setFontSize(15);
    doc.text("Semester SGPA Summary", PAGE_MARGIN_X, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(78, 95, 128);
    doc.setFontSize(10);
    doc.text(
      `Included semesters: ${params.semesters.map((item) => `S${item}`).join(", ")}`,
      PAGE_MARGIN_X,
      y + 10,
    );

    y += 14;

    autoTable(doc, {
      startY: y,
      head: [["Semester", "Credits", "Grade Points", "SGPA", "Arrears"]],
      body: semestersToExport.map((item) => [
        `S${item.semester}`,
        item.totals.credits.toFixed(1),
        item.totals.grade_points.toFixed(2),
        fmt(item.totals.sgpa),
        String(item.totals.arrears),
      ]),
      margin: {
        left: PAGE_MARGIN_X,
        right: PAGE_MARGIN_X,
        bottom: PAGE_FOOTER_Y_OFFSET + 10,
      },
      styles: {
        fontSize: 9,
        cellPadding: 2,
        textColor: [39, 52, 82],
        lineColor: [223, 228, 241],
        lineWidth: 0.18,
      },
      headStyles: {
        fillColor: [37, 96, 185],
        textColor: [247, 251, 255],
        fontStyle: "bold",
        lineWidth: 0,
      },
      alternateRowStyles: {
        fillColor: [247, 249, 253],
      },
      didDrawPage: () => {
        drawPageFooter(doc);
      },
    });

    drawPageFooter(doc);
  };

  const semesterChunks: Array<typeof semestersToExport> = [];
  for (let index = 0; index < semestersToExport.length; index += 2) {
    semesterChunks.push(semestersToExport.slice(index, index + 2));
  }

  semesterChunks.forEach((chunk) => {
    doc.addPage();

    let y = PAGE_MARGIN_Y;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 36, 72);
    doc.setFontSize(15);
    doc.text("Semester-wise Grades and SGPA", PAGE_MARGIN_X, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(78, 95, 128);
    doc.setFontSize(10);
    doc.text(
      `Included semesters: ${params.semesters.map((item) => `S${item}`).join(", ")}`,
      PAGE_MARGIN_X,
      y + 10,
    );

    y += 24;

    chunk.forEach((semesterPayload, semesterIndexInChunk) => {
      if (semesterIndexInChunk > 0) {
        y += 4;
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 39, 77);
      doc.setFontSize(11);
      doc.text(`Semester ${semesterPayload.semester}`, PAGE_MARGIN_X, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(78, 95, 128);
      doc.setFontSize(9.5);
      doc.text(
        `SGPA ${fmt(semesterPayload.totals.sgpa)} | Credits ${semesterPayload.totals.credits.toFixed(1)} | Grade points ${semesterPayload.totals.grade_points.toFixed(2)} | Arrears ${semesterPayload.totals.arrears}`,
        PAGE_MARGIN_X,
        y + 6,
      );

      autoTable(doc, {
        startY: y + 10,
        head: [["Code", "Subject", "Grade", "Credit", "GP", "Credit x GP", "Included"]],
        body: semesterPayload.subjects.map((item) => [
          item.code,
          item.name,
          item.grade,
          item.credit.toFixed(1),
          item.gp == null ? "-" : String(item.gp),
          item.credit_x_gp.toFixed(2),
          item.included ? "Yes" : "No",
        ]),
        margin: {
          left: PAGE_MARGIN_X,
          right: PAGE_MARGIN_X,
          bottom: PAGE_FOOTER_Y_OFFSET + 10,
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 1.9,
          textColor: [39, 52, 82],
          lineColor: [223, 228, 241],
          lineWidth: 0.18,
        },
        headStyles: {
          fillColor: [48, 64, 160],
          textColor: [247, 251, 255],
          fontStyle: "bold",
          lineWidth: 0,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 255],
        },
        didDrawPage: () => {
          drawPageFooter(doc);
        },
      });

      y =
        ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? y) + SEMESTER_BLOCK_SPACING;
    });

    drawPageFooter(doc);
  });

  drawSemesterSummaryAtEnd();
};

const buildFileName = (
  regno: string,
  semesters: number[],
  department: string,
  batch: string | null,
): string => {
  const semesterToken = semesters.map((item) => `s${item}`).join("-");
  const departmentToken = sanitizeToken(department);
  const batchToken = batch?.trim() ? sanitizeToken(batch) : "all-batches";
  return `student-profile-${sanitizeToken(regno)}-${departmentToken}-${batchToken}-${semesterToken}.pdf`;
};

export const exportStudentProfilePdf = async (
  params: ExportStudentPdfParams,
): Promise<{ fileName: string }> => {
  const semesters = normalizeSemesters(params.selectedSemesters);
  if (semesters.length === 0) {
    throw new Error("Select at least one semester before exporting.");
  }

  const charts = await Promise.all(params.chartTargets.map(captureChart));

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  drawFirstPage(doc, {
    student: params.student,
    cgpaBreakdown: params.cgpaBreakdown,
    semesters,
    department: params.department,
    batch: params.batch,
    charts,
  });

  drawSecondPage(doc, {
    cgpaBreakdown: params.cgpaBreakdown,
    semesters,
  });

  const fileName = buildFileName(
    params.student.regno,
    semesters,
    params.department,
    params.batch,
  );
  doc.save(fileName);
  return { fileName };
};
