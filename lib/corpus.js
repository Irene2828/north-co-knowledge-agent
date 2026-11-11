import fs from "node:fs";
export const docs = fs
  .readdirSync(new URL("../knowledge/", import.meta.url))
  .filter((f) => f.endsWith(".json"))
  .map((f) =>
    JSON.parse(
      fs.readFileSync(new URL("../knowledge/" + f, import.meta.url), "utf8"),
    ),
  );
export const facts = docs.flatMap((d) =>
  d.sections.flatMap((s) =>
    s.facts.map((f) => ({
      ...f,
      docId: d.id,
      title: d.title,
      section: s.title,
      sectionId: s.id,
    })),
  ),
);
const stop = new Set(
  "a an the is are can i we our my me it to of for in on at and or do does what how when with about north co please tell company".split(
    " ",
  ),
);
export const tokens = (text) =>
  [
    ...new Set(
      text
        .toLowerCase()
        .replace(/returns/g, "return")
        .replace(/employees/g, "employee")
        .match(/[a-z0-9]+/g) || [],
    ),
  ].filter((t) => !stop.has(t) && t.length > 1);
export function retrieve(question) {
  const query = tokens(question);
  return docs
    .map((d) => {
      const title = tokens(d.title);
      const body = tokens(JSON.stringify(d));
      const matched = query.filter((t) => body.includes(t));
      const score = matched.reduce(
        (n, t) => n + (title.includes(t) ? 4 : 1),
        0,
      );
      return { id: d.id, title: d.title, score, matched, doc: d };
    })
    .filter((d) => d.score >= 2)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 4);
}
export function allowedFacts(retrieved) {
  const ids = new Set(retrieved.map((d) => d.id));
  return facts.filter((f) => ids.has(f.docId));
}
export const publicRetrieval = (retrieved) =>
  retrieved.map(({ id, title, score, matched, reason }) => ({
    id,
    title,
    score,
    matched,
    ...(reason ? { reason } : {}),
  }));
