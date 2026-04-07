export function getBrand(modelStr) {
  const m = (modelStr || "").toLowerCase();
  if (
    [
      "airmini",
      "airsense",
      "aircurve",
      "lumis",
      "s9",
      "s10",
      "astral",
      "stellar",
      "apnealink",
    ].some((k) => m.includes(k))
  )
    return "ResMed";
  if (
    [
      "inx500",
      "inx700",
      "inx900",
      "inx1030",
      "twg",
      "euxhcp",
      "in56",
      "ds",
      "ht15",
      "trilogy",
      "in2100",
      "in2200",
      "v60",
      "a30",
      "a40",
      "1054096",
      "1040000",
      "alice",
      "sleepware",
      "m5525",
      "p5514",
      "p5512",
      "1078758",
      "everflo",
      "care orchestrator",
      "encore",
    ].some((k) => m.includes(k))
  )
    return "Philips";
  if (["inap"].some((k) => m.includes(k))) return "萊鎂";
  if (["oc505"].some((k) => m.includes(k))) return "怡氧";
  if (m.includes("安心氧")) return "永悅";
  return "Other";
}

export function getDeviceType(modelStr) {
  const m = (modelStr || "").toLowerCase();
  // CPAP
  if (
    [
      "airmini",
      "airsense",
      "aircurve",
      "lumis",
      "s9",
      "s10",
      "inx500",
      "inx700",
      "inx900",
      "inx1030",
      "twg",
      "euxhcp",
      "in56",
      "ds",
      "ht15",
      "inap",
    ].some((k) => m.includes(k))
  )
    return "CPAP";

  // BiPAP
  if (
    [
      "astral",
      "stellar",
      "trilogy",
      "in2100",
      "in2200",
      "v60",
      "a30",
      "a40",
      "1054096",
      "1040000",
    ].some((k) => m.includes(k))
  )
    return "BiPAP";

  // PSG
  if (
    [
      "apnealink",
      "alice",
      "sleepware",
      "m5525",
      "p5514",
      "p5512",
      "1078758",
    ].some((k) => m.includes(k))
  )
    return "PSG";

  // 氧氣機
  if (["everflo", "oc505", "安心氧"].some((k) => m.includes(k)))
    return "氧氣機";

  // 軟體
  if (["care orchestrator", "encore"].some((k) => m.includes(k))) return "軟體";

  return "其他設備";
}
