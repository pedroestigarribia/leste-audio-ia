export function cleanNarrativeReferences(text: string) {
  return text
    .replace(/\[(?:fonte|fontes):[^\]\n]*\]|\((?:fonte|fontes):[^)\n]*\)/gi, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
