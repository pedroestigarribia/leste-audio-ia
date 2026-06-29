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
  const body = bodyBuffer.toString("latin1");
  const parts = body.split(`--${boundary}`);

  for (const rawPart of parts) {
    const part = rawPart.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const headerEndIndex = part.indexOf("\r\n\r\n");

    if (headerEndIndex === -1) {
      continue;
    }

    const rawHeaders = part.slice(0, headerEndIndex);
    const contentDisposition = getHeaderValue(rawHeaders, "content-disposition");
    const disposition = parseContentDisposition(contentDisposition);

    if (disposition.name !== fieldName || !disposition.filename) {
      continue;
    }

    const contentTypeHeader = getHeaderValue(rawHeaders, "content-type");
    const rawContent = part.slice(headerEndIndex + 4).replace(/\r\n--$/, "");
    const fileBuffer = Buffer.from(rawContent, "latin1");
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
