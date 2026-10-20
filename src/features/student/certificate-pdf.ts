export type CertificatePdfInput = {
  studentName: string;
  courseTitle: string;
  completedOn: string;
  certificateId: string;
};

const pageWidth = 792;

export function buildCertificatePdf(input: CertificatePdfInput) {
  const courseLines = wrap(input.courseTitle.trim(), 42);
  const name = input.studentName.trim();
  let content = "";
  content += "0.12 0.22 0.38 RG\n2.2 w\n36 36 720 540 re S\n";
  content += "0.69 0.54 0.24 RG\n1.1 w\n48 48 696 516 re S\n";
  content += centered("EduHub", 520, 22, "F2");
  content += centered("Certificate of Completion", 478, 26, "F2");
  content += centered("This certifies that", 430, 14, "F1");
  content += centered(name, 390, 28, "F2");
  content += centered("has successfully completed", 344, 14, "F1");
  courseLines.forEach((line, index) => {
    content += centered(line, 304 - index * 26, 20, "F2");
  });
  content += centered(`Completed on ${input.completedOn}`, 210, 13, "F1");
  content += centered(`Certificate ID ${input.certificateId}`, 184, 11, "F1");
  content += "0.69 0.54 0.24 RG\n1.4 w\n688 118 m\n688 118 34 0 360 arc S\n";
  content += "0.12 0.22 0.38 RG\n0.8 w\n688 118 m\n688 118 26 0 360 arc S\n";
  content += centeredAt("SEAL", 676, 114, 9, "F2");
  return pdfDocument(content);
}

function centered(text: string, y: number, size: number, font: "F1" | "F2") {
  return centeredAt(text, (pageWidth - text.length * size * 0.5) / 2, y, size, font);
}

function centeredAt(text: string, x: number, y: number, size: number, font: "F1" | "F2") {
  const left = Math.max(56, x);
  return `BT /${font} ${size} Tf 1 0 0 1 ${left.toFixed(1)} ${y} Tm (${pdfText(text)}) Tj ET\n`;
}

function wrap(value: string, max: number) {
  if (!value) return [""];
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function pdfText(value: string) {
  let encoded = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 32;
    if (code === 92 || code === 40 || code === 41) {
      encoded += `\\${char}`;
      continue;
    }
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
      encoded += code <= 126 ? char : `\\${code.toString(8).padStart(3, "0")}`;
      continue;
    }
    encoded += " ";
  }
  return encoded;
}

function pdfDocument(content: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(body.length);
  for (let index = 0; index < body.length; index += 1) bytes[index] = body.charCodeAt(index);
  return bytes;
}
