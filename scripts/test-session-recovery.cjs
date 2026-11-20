const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

const source = fs.readFileSync("src/lib/relink-audio-files.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function("module", "exports", "require", js)(loaded, loaded.exports, require);
const { relinkAudioFiles } = loaded.exports;

function item(id, name, size, modified, transcription) {
  return {
    id, name, size, originalFileName: name, originalLastModified: modified,
    originalFileAvailable: false, status: transcription ? "done" : "error", transcription,
    file: new File([], name), progress: transcription ? 100 : 0,
  };
}
const audio = new File(["1234"], "audio.ogg", { lastModified: 100 });
const done = new File(["5678"], "pronto.ogg", { lastModified: 200 });
const fresh = new File(["x"], "novo.ogg", { lastModified: 300 });
const result = relinkAudioFiles([item("a", audio.name, audio.size, 100), item("b", done.name, done.size, 200, "texto")], [audio, done, fresh]);
assert.deepEqual(result.reattached, ["a", "b"]);
assert.equal(result.items[0].status, "idle");
assert.equal(result.items[1].status, "done");
assert.equal(result.items[1].transcription, "texto");
assert.deepEqual(result.unmatched, [fresh]);
const repeated = relinkAudioFiles(result.items, [audio, done]);
assert.deepEqual(repeated.alreadyPresent, [audio, done]);
assert.equal(repeated.unmatched.length, 0);
const duplicatedSelection = relinkAudioFiles([], [fresh, fresh]);
assert.equal(duplicatedSelection.unmatched.length, 1);
assert.deepEqual(duplicatedSelection.alreadyPresent, [fresh]);
const sameMetadataDifferentBytes = new File(["abcd"], audio.name, { lastModified: 100 });
const collision = relinkAudioFiles(result.items, [sameMetadataDifferentBytes]);
assert.deepEqual(collision.alreadyPresent, [sameMetadataDifferentBytes]);
const ambiguous = relinkAudioFiles([item("a", audio.name, audio.size, 100), item("b", audio.name, audio.size, 100)], [audio]);
assert.deepEqual(ambiguous.ambiguous, [audio.name]);
assert.equal(ambiguous.unmatched.length, 0);
const changed = relinkAudioFiles([item("a", audio.name, audio.size, 101)], [audio]);
assert.deepEqual(changed.ambiguous, [audio.name]);
const narrativeSource = fs.readFileSync("src/lib/narrative-export.ts", "utf8");
const narrativeJs = ts.transpileModule(narrativeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const narrativeModule = { exports: {} };
new Function("module", "exports", "require", narrativeJs)(narrativeModule, narrativeModule.exports, require);
assert.equal(
  narrativeModule.exports.cleanNarrativeReferences("Relato [Fonte: áudio 1].\nTrecho [inaudível]. (Fonte: áudio 2)"),
  "Relato.\nTrecho [inaudível].",
);
console.log("Retomada: reanexo de pendente e concluído, novo arquivo e ambiguidades verificados.");
