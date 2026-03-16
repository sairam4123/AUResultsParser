import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TableInput = {
  title: string;
  headers: string[];
  rows: string[][];
  subtitle?: string;
};

type PdfExportOptions = {
  highlightDiffs?: boolean;
};

const PAGE_MARGIN_X = 14;
const BRAND_BLUE: [number, number, number] = [37, 96, 185];
const BRAND_BLUE_DARK: [number, number, number] = [18, 56, 126];
const FOOTER_MARGIN_BOTTOM = 8;
const FOOTER_BLOCK_HEIGHT = 14;
const PDF_DISCLAIMER_LINES = [
  "NOTE: Results, SGPA, and all derived values are provisional and may be revised.",
  "This website only displays uploaded result PDFs and is not an official source of record.",
];

const logoCache = new Map<string, Promise<string | null>>();

const loadImageDataUrl = (path: string): Promise<string | null> => {
  const cached = logoCache.get(path);
  if (cached) {
    return cached;
  }

  const promise = fetch(path)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load image: ${path}`);
      }
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => null);

  logoCache.set(path, promise);
  return promise;
};

const drawHeader = async (doc: jsPDF, title: string, subtitle?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  const [leftLogo, rightLogo] = await Promise.all([
    loadImageDataUrl("/mce-logo-2-og.png"),
    loadImageDataUrl("/iqac-logo-og.png"),
  ]);

  doc.setFillColor(249, 251, 255);
  doc.roundedRect(
    PAGE_MARGIN_X - 2,
    8,
    pageWidth - PAGE_MARGIN_X * 2 + 4,
    43,
    2,
    2,
    "F",
  );

  const logoBoxY = 10;
  const logoBoxSize = 16;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(216, 223, 238);
  doc.roundedRect(
    PAGE_MARGIN_X,
    logoBoxY,
    logoBoxSize,
    logoBoxSize,
    2,
    2,
    "FD",
  );
  doc.roundedRect(
    pageWidth - PAGE_MARGIN_X - logoBoxSize,
    logoBoxY,
    logoBoxSize,
    logoBoxSize,
    2,
    2,
    "FD",
  );

  if (leftLogo) {
    doc.addImage(
      leftLogo,
      "PNG",
      PAGE_MARGIN_X + 1.5,
      logoBoxY + 1.5,
      logoBoxSize - 3,
      logoBoxSize - 3,
    );
  }

  if (rightLogo) {
    doc.addImage(
      rightLogo,
      "PNG",
      pageWidth - PAGE_MARGIN_X - logoBoxSize + 1.5,
      logoBoxY + 1.5,
      logoBoxSize - 3,
      logoBoxSize - 3,
    );
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_BLUE_DARK);
  doc.setFontSize(15);
  doc.text("MOOKAMBIGAI COLLEGE OF ENGINEERING", centerX, 15, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(68, 83, 113);
  doc.setFontSize(10.5);
  doc.text("Srinivasa Nagar, Kalamavur - 622502", centerX, 20, {
    align: "center",
  });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(33, 47, 74);
  doc.setFontSize(11.3);
  doc.text("DEPARTMENT OF INFORMATION TECHNOLOGY", centerX, 26, {
    align: "center",
  });
  doc.text(
    "DEPARTMENT OF ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING",
    centerX,
    31,
    {
      align: "center",
    },
  );

  doc.setDrawColor(...BRAND_BLUE);
  doc.setLineWidth(0.4);
  doc.line(PAGE_MARGIN_X, 35, pageWidth - PAGE_MARGIN_X, 35);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(24, 34, 61);
  doc.setFontSize(13.2);

  const titleLines = doc.splitTextToSize(title, pageWidth - PAGE_MARGIN_X * 2);
  doc.text(titleLines, PAGE_MARGIN_X, 40);

  const titleHeight = titleLines.length * 5;
  let subtitleY = 40 + titleHeight;

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 84, 115);
    doc.setFontSize(10.3);
    const subtitleLines = doc.splitTextToSize(
      subtitle,
      pageWidth - PAGE_MARGIN_X * 2,
    );
    doc.text(subtitleLines, PAGE_MARGIN_X, subtitleY);
    subtitleY += subtitleLines.length * 4.5;
  }

  return subtitle ? subtitleY + 4 : subtitleY + 2;
};

const drawPdfDisclaimer = (doc: jsPDF) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const separatorY = pageHeight - FOOTER_BLOCK_HEIGHT - FOOTER_MARGIN_BOTTOM;
  const textY = separatorY + 4;

  doc.setDrawColor(220, 226, 240);
  doc.setLineWidth(0.25);
  doc.line(PAGE_MARGIN_X, separatorY, pageWidth - PAGE_MARGIN_X, separatorY);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(92, 101, 124);
  doc.setFontSize(8.5);
  doc.text(PDF_DISCLAIMER_LINES[0], PAGE_MARGIN_X, textY);
  doc.text(PDF_DISCLAIMER_LINES[1], PAGE_MARGIN_X, textY + 4.2);
};

export const exportSingleTablePdf = async (
  fileName: string,
  table: TableInput,
  footerLines: string[] = [],
  options: PdfExportOptions = {},
) => {
  const doc = new jsPDF({ orientation: "landscape" });
  const startY = await drawHeader(doc, table.title, table.subtitle);

  autoTable(doc, {
    startY,
    head: [table.headers],
    body: table.rows,
    margin: {
      left: PAGE_MARGIN_X,
      right: PAGE_MARGIN_X,
      bottom: FOOTER_BLOCK_HEIGHT + FOOTER_MARGIN_BOTTOM + 2,
    },
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 2.2,
      lineColor: [223, 228, 241],
      lineWidth: 0.18,
      textColor: [39, 52, 82],
      valign: "middle",
    },
    headStyles: {
      fillColor: BRAND_BLUE,
      textColor: [248, 251, 255],
      fontStyle: "bold",
      halign: "left",
      minCellHeight: 7,
      lineColor: BRAND_BLUE,
      lineWidth: 0,
    },
    alternateRowStyles: {
      fillColor: [247, 249, 253],
    },
    didParseCell: (hook) => {
      if (!options.highlightDiffs || hook.section !== "body") {
        return;
      }

      const text = hook.cell.text.join(" ").trim();
      if (/\(\+\d+\)$/.test(text)) {
        hook.cell.styles.textColor = [16, 109, 63];
      }

      const isSpreadColumn = hook.column.index === table.headers.length - 1;
      if (isSpreadColumn && /^\+\d+$/.test(text)) {
        hook.cell.styles.textColor = [148, 82, 11];
        hook.cell.styles.fillColor = [255, 245, 226];
        hook.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: () => {
      drawPdfDisclaimer(doc);
    },
  });

  if (footerLines.length > 0) {
    const y = (doc as jsPDF & { lastAutoTable?: { finalY: number } })
      .lastAutoTable?.finalY;
    let cursorY = (y ?? 30) + 8;

    doc.setDrawColor(220, 226, 240);
    doc.line(
      PAGE_MARGIN_X,
      cursorY - 4,
      doc.internal.pageSize.getWidth() - PAGE_MARGIN_X,
      cursorY - 4,
    );

    doc.setFont("helvetica", "normal");
    doc.setTextColor(42, 55, 85);
    doc.setFontSize(10.3);

    footerLines.forEach((line) => {
      doc.text(line, PAGE_MARGIN_X, cursorY);
      cursorY += 6;
    });
  }

  doc.save(fileName);
};

export const exportMultiPageTablesPdf = async (
  fileName: string,
  tables: TableInput[],
) => {
  if (tables.length === 0) {
    return;
  }

  const doc = new jsPDF({ orientation: "landscape" });

  for (const [index, table] of tables.entries()) {
    if (index > 0) {
      doc.addPage();
    }

    const startY = await drawHeader(doc, table.title, table.subtitle);
    autoTable(doc, {
      startY,
      head: [table.headers],
      body: table.rows,
      margin: {
        left: PAGE_MARGIN_X,
        right: PAGE_MARGIN_X,
        bottom: FOOTER_BLOCK_HEIGHT + FOOTER_MARGIN_BOTTOM + 2,
      },
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2.2,
        lineColor: [223, 228, 241],
        lineWidth: 0.18,
        textColor: [39, 52, 82],
      },
      headStyles: {
        fillColor: BRAND_BLUE,
        textColor: [248, 251, 255],
        fontStyle: "bold",
        halign: "left",
        minCellHeight: 7,
        lineColor: BRAND_BLUE,
        lineWidth: 0,
      },
      alternateRowStyles: {
        fillColor: [247, 249, 253],
      },
      didDrawPage: () => {
        drawPdfDisclaimer(doc);
      },
    });
  }

  doc.save(fileName);
};
