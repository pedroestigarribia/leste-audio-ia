import "server-only";

export type UploadedMultipartFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function parseContentDisposition(value: string) {
  const parsed: Record<string, string> = {};

  value.split(";").forEach((item) => {
    const [rawKey, ...rawValueParts] = item.trim().split("=");
    const key = rawKey.toLowerCase();
    const rawValue = rawValueParts.join("=");

    if (!key || !rawValue) {
      return;
    }

    parsed[key] = rawValue.replace(/^"|"$/g, "");
  });

  return parsed;
}

function getHeaderValue(rawHeaders: string, headerName: string) {
  const normalizedHeaderName = headerName.toLowerCase();
  const line = rawHeaders
    .split("\r\n")
    .find((headerLine) => headerLine.toLowerCase().startsWith(`${normalizedHeaderName}:`));

  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

export async function parseMultipartFile(
  request: Request,
  fieldName = "file",
): Promise<UploadedMultipartFile | null> {
  const contentType = request.headers.get("content-type") ?? "";
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (!boundary) {
    return null;
  }

  const bodyBuffer = Buffer.from(await request.arrayBuffer());
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let boundaryIndex = bodyBuffer.indexOf(boundaryBuffer);

  while (boundaryIndex !== -1) {
    let partStart = boundaryIndex + boundaryBuffer.length;
    if (bodyBuffer.subarray(partStart, partStart + 2).toString() === "--") break;
    if (bodyBuffer.subarray(partStart, partStart + 2).toString() === "\r\n") partStart += 2;

    const nextBoundaryIndex = bodyBuffer.indexOf(boundaryBuffer, partStart);
    if (nextBoundaryIndex === -1) break;
    const partEnd = bodyBuffer.subarray(nextBoundaryIndex - 2, nextBoundaryIndex).toString() === "\r\n"
      ? nextBoundaryIndex - 2
      : nextBoundaryIndex;
    const headerEndIndex = bodyBuffer.indexOf("\r\n\r\n", partStart, "latin1");

    if (headerEndIndex === -1 || headerEndIndex > partEnd) {
      boundaryIndex = nextBoundaryIndex;
      continue;
    }

    const rawHeaders = bodyBuffer.toString("latin1", partStart, headerEndIndex);
    const contentDisposition = getHeaderValue(rawHeaders, "content-disposition");
    const disposition = parseContentDisposition(contentDisposition);

    if (disposition.name !== fieldName || !disposition.filename) {
      boundaryIndex = nextBoundaryIndex;
      continue;
    }

    const contentTypeHeader = getHeaderValue(rawHeaders, "content-type");
    const contentStart = headerEndIndex + 4;
    const fileBuffer = bodyBuffer.subarray(contentStart, partEnd);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    );

    return {
      name: disposition.filename,
      type: contentTypeHeader,
      size: fileBuffer.byteLength,
      arrayBuffer: async () => arrayBuffer,
    };
  }

  return null;
}
