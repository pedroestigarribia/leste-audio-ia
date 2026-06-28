import { normalizePlainText } from "@/lib/plain-text";

type BuildDocxOptions = {
  fileTitle: string;
  generatedAt?: Date;
  sections: Array<{
    title: string;
    content: string;
  }>;
};

export async function buildDocxBlob({
  fileTitle,
  generatedAt = new Date(),
  sections,
}: BuildDocxOptions): Promise<Blob> {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");

  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(fileTitle)],
    }),
    new Paragraph({
      children: [new TextRun(`Data: ${generatedAt.toLocaleString("pt-BR")}`)],
    }),
  ];

  for (const section of sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(section.title)],
      }),
    );

    const normalizedContent = normalizePlainText(section.content) || "(sem conteudo)";
    const paragraphs = normalizedContent.split(/\n{2,}/);

    for (const paragraph of paragraphs) {
      children.push(
        new Paragraph({
          children: [new TextRun(paragraph)],
        }),
      );
    }
  }

  const document = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}
