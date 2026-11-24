/**
 * "Read before ordering" guide shown as a popup on a service's checkout page.
 * One shape for every provider (Khmer TopUp, Fox, local services):
 *   { enabled, titleKm, titleEn, subtitleKm, subtitleEn, chips[], stepsKm[], stepsEn[], buttonKm, buttonEn }
 * `**text**` inside a step is highlighted on the storefront.
 */
const strip = (s, n) => String(s ?? "").replace(/[<>]/g, "").trim().slice(0, n);
const list = (a, n, len) =>
  (Array.isArray(a) ? a : String(a || "").split(/\n+/))
    .map((x) => strip(x, len))
    .filter(Boolean)
    .slice(0, n);

export function cleanGuide(sg, { defaultEnabled = false } = {}) {
  sg = sg && typeof sg === "object" ? sg : {};
  const en = sg.enabled;
  const enabled = en === true || en === "true" || (en !== false && en !== "false" && !!defaultEnabled);
  const stepsKm = list(sg.stepsKm?.length ? sg.stepsKm : sg.bodyKm, 8, 260);
  const stepsEn = list(sg.stepsEn?.length ? sg.stepsEn : sg.bodyEn, 8, 260);
  return {
    enabled,
    titleKm: strip(sg.titleKm, 80) || "សូមអានមុនកុម្ម៉ង់",
    titleEn: strip(sg.titleEn, 80) || "Please read before ordering",
    subtitleKm: strip(sg.subtitleKm, 140),
    subtitleEn: strip(sg.subtitleEn, 140),
    chips: list(sg.chips, 5, 22),
    stepsKm,
    stepsEn: stepsEn.length ? stepsEn : stepsKm,
    buttonKm: strip(sg.buttonKm, 30) || "យល់ព្រម",
    buttonEn: strip(sg.buttonEn, 30) || "I understand",
  };
}

/** Only expose a guide to customers when it is on and has at least one step. */
export function publicGuide(sg) {
  const g = cleanGuide(sg);
  return g.enabled && (g.stepsKm.length || g.stepsEn.length) ? g : undefined;
}
