import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, Download, Save, Leaf, PlusCircle, Trash2, Upload, QrCode, Camera, X, Map as MapIcon, WifiOff, Settings } from "lucide-react";

function Button({ children, onClick, className = "", variant = "default", ...props }) {
  const base = "inline-flex items-center justify-center px-3 py-2 text-sm font-medium transition disabled:opacity-50";
  const style = variant === "outline" ? "border border-slate-200 bg-white hover:bg-slate-50" : "text-white";
  return <button onClick={onClick} className={`${base} ${style} ${className}`} {...props}>{children}</button>;
}
function Card({ children, className = "" }) { return <div className={`bg-white ${className}`}>{children}</div>; }
function CardContent({ children, className = "" }) { return <div className={className}>{children}</div>; }

const DEFAULT_SETTINGS = {
  crop: "Cantaloupe",
  trial: "FieldTrial1",
  autoNext: true,
  defaultTraitKey: "fruit_weight_kg",
};

const DEFAULT_TRAITS = [
  { key: "fruit_weight_kg", label: "Fruit weight (kg)", type: "number" },
  { key: "brix", label: "Brix", type: "number" },
  { key: "fruit_number", label: "Fruit number", type: "number" },
  { key: "vine_vigor_1_5", label: "Vine vigor 1–5", type: "number" },
  { key: "disease_1_9", label: "Disease score 1–9", type: "number" },
];

// Default example layout from your R-generated cantaloupe map: 7 rows × 12 hills/lines.
const DEFAULT_LAYOUT = [
  ["RIL206", "CP-111", "CP-89", "MR-1", "CP-33", "RIL206", "Athena", "CP-62", "CP-107", "Athena", "CP-82", "TopMark"],
  ["CP-1", "CP-41", "CP-107", "Charentais", "CP-107", "CP-42", "TP-2", "CP-21", "CP-4", "CP-42", "CP-38", "CP-41"],
  ["CP-63", "Athena", "CP-82", "CP-62", "CP-55", "TopMark", "Edisto47", "CP-111", "Atlantis", "CP-50", "RIL206", "CP-33"],
  ["Mamut", "TP-2", "CP-42", "CP-4", "Accolade", "TP-1", "CP-4", "CP-1", "CP-55", "Accolade", "CP-62", "Mamut"],
  ["CP-33", "CP-50", "Edisto47", "CP-38", "CP-41", "Atlantis", "CP-89", "CP-50", "MR-1", "CP-111", "TP-2", "CP-89"],
  ["Atlantis", "Accolade", "TopMark", "BORDER", "Mamut", "CP-63", "MR-1", "BORDER", "Edisto47", "CP-63", "TP-1", "BORDER"],
  ["CP-55", "TP-1", "CP-21", "BORDER", "CP-82", "Charentais", "CP-38", "BORDER", "CP-21", "CP-1", "Charentais", "BORDER"],
];

const DEFAULT_CHECKS = new Set(["RIL206", "MR-1", "Athena", "TopMark", "Mamut", "Charentais", "Edisto47", "Atlantis", "Accolade"]);

function entryClass(genotype, classValue = "") {
  if (classValue) return classValue;
  if (genotype === "BORDER") return "BORDER";
  if (DEFAULT_CHECKS.has(genotype)) return "CHECK";
  return "ENTRY";
}
function safeKey(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function csvEscape(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function toCSV(rows, headers) { return [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n"); }
function pick(row, names, fallback = "") { for (const n of names) if (row[n] !== undefined && row[n] !== "") return row[n]; return fallback; }
function repFromHill(hillNumber) {
  if (hillNumber <= 4) return 1;
  if (hillNumber <= 8) return 2;
  return 3;
}

function baseRecord({ settings = DEFAULT_SETTINGS, trial, block = "Rep1", row = 1, hill = 1, hill_id = "H001", genotype = "Entry-1", rep = 1, entry_class = "" }) {
  return {
    HillID: hill_id,
    record_id: hill_id,
    barcode: hill_id,
    Trial: trial || settings.trial,
    Environment: trial || settings.trial,
    Block: block,
    Row: row,
    Hill: hill,
    Line: hill,
    Rep: rep,
    Genotype: genotype,
    EntryClass: entryClass(genotype, entry_class),
    crop: settings.crop,
    fruit_weight_kg: "",
    brix: "",
    fruit_number: "",
    vine_vigor_1_5: "",
    disease_1_9: "",
    notes: "",
    timestamp: "",
  };
}

function makeRecordsFromDefaultLayout(settings = DEFAULT_SETTINGS) {
  const records = [];
  let hillCount = 1;
  DEFAULT_LAYOUT.forEach((rowData, rowIndex) => {
    rowData.forEach((genotype, colIndex) => {
      const hill = colIndex + 1;
      const rep = repFromHill(hill);
      const hill_id = `H${String(hillCount).padStart(3, "0")}`;
      records.push(baseRecord({ settings, trial: settings.trial, block: `Rep${rep}`, row: rowIndex + 1, hill, hill_id, genotype, rep }));
      hillCount++;
    });
  });
  return records;
}

function parseCSV(text, traits, settings) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line, i) => {
    const values = line.split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
    const row = {};
    headers.forEach((h, idx) => (row[h] = values[idx] ?? ""));

    const rowNo = Number(pick(row, ["Row", "ROW", "row", "field_row"], Math.floor(i / 12) + 1));
    const hill = Number(pick(row, ["Hill", "hill", "Line", "line", "Plot", "plot", "PlotNumber", "plot_number"], (i % 12) + 1));
    const rep = Number(pick(row, ["Rep", "REP", "rep", "Replication", "replication", "Block", "block"], repFromHill(hill)));
    const genotype = pick(row, ["Genotype", "GENOTYPE", "genotype", "Entry", "entry", "Accession", "accession", "Cultivar", "cultivar"], `Entry-${i + 1}`);
    const hillID = pick(row, ["HillID", "hill_id", "HillId", "PlotID", "plot_id", "LineID", "line_id", "record_id", "barcode", "Barcode"], `H${String(i + 1).padStart(3, "0")}`);
    const trial = pick(row, ["Trial", "TRIAL", "trial", "Environment", "ENV", "env"], settings.trial);
    const block = pick(row, ["Block", "BLOCK", "block"], `Rep${rep}`);
    const crop = pick(row, ["crop", "Crop", "CROP"], settings.crop);
    const entryCls = pick(row, ["EntryClass", "entry_class", "Class", "class"], entryClass(genotype));

    const rec = baseRecord({ settings: { ...settings, crop, trial }, trial, block, row: rowNo, hill, hill_id: hillID, genotype, rep, entry_class: entryCls });
    traits.forEach((t) => { if (row[t.key] !== undefined) rec[t.key] = row[t.key]; });
    return {
      ...rec,
      ...row,
      HillID: hillID,
      record_id: hillID,
      barcode: pick(row, ["barcode", "Barcode", "BARCODE"], hillID),
      Trial: trial,
      Environment: pick(row, ["Environment", "ENV", "env"], trial),
      Block: block,
      Row: rowNo,
      Hill: hill,
      Line: pick(row, ["Line", "line"], hill),
      Rep: rep,
      Genotype: genotype,
      EntryClass: entryCls,
      crop,
    };
  });
}

export default function FieldBookOfflineApp() {
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem("fieldbook-settings")) || {}) }; }
    catch { return DEFAULT_SETTINGS; }
  });
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fieldbook-hill-records")) || makeRecordsFromDefaultLayout(DEFAULT_SETTINGS); }
    catch { return makeRecordsFromDefaultLayout(DEFAULT_SETTINGS); }
  });
  const [traits, setTraits] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fieldbook-traits")) || DEFAULT_TRAITS; }
    catch { return DEFAULT_TRAITS; }
  });
  const [selectedId, setSelectedId] = useState(records[0]?.HillID || "");
  const [query, setQuery] = useState("");
  const [repFilter, setRepFilter] = useState("All");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [newTrait, setNewTrait] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [showLayout, setShowLayout] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [mapFileUrl, setMapFileUrl] = useState(() => localStorage.getItem("fieldbook-map-file-url") || "");
  const [mapFileType, setMapFileType] = useState(() => localStorage.getItem("fieldbook-map-file-type") || "");
  const fileRef = useRef(null);
  const firstTraitRef = useRef(null);
  const traitRefs = useRef({});
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  useEffect(() => { localStorage.setItem("fieldbook-hill-records", JSON.stringify(records)); }, [records]);
  useEffect(() => { localStorage.setItem("fieldbook-traits", JSON.stringify(traits)); }, [traits]);
  useEffect(() => { localStorage.setItem("fieldbook-settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    if (mapFileUrl) localStorage.setItem("fieldbook-map-file-url", mapFileUrl);
    if (mapFileType) localStorage.setItem("fieldbook-map-file-type", mapFileType);
  }, [mapFileUrl, mapFileType]);
  useEffect(() => { setTimeout(() => firstTraitRef.current?.focus(), 80); }, [selectedId]);

  const reps = useMemo(() => ["All", ...Array.from(new Set(records.map((p) => String(p.Rep)))).filter(Boolean)], [records]);
  const selected = records.find((p) => p.HillID === selectedId) || records[0];
  const selectedIndex = records.findIndex((p) => p.HillID === selectedId);
  const completed = records.filter((p) => traits.some((t) => p[t.key] !== "" && p[t.key] != null)).length;
  const uniqueHills = records.length;

  const filteredRecords = useMemo(() => {
    const q = query.toLowerCase().trim();
    return records.filter((p) => {
      const repOK = repFilter === "All" || String(p.Rep) === repFilter;
      const textOK = !q || [p.HillID, p.record_id, p.barcode, p.Genotype, p.EntryClass, p.Block, p.Trial, p.crop].some((x) => String(x).toLowerCase().includes(q));
      return repOK && textOK;
    });
  }, [records, query, repFilter]);

  function selectRecord(id) { setSelectedId(id); }
  function goNext() {
    if (!records.length) return;
    const next = records[(selectedIndex + 1) % records.length];
    setSelectedId(next.HillID);
  }
  function goPrev() {
    if (!records.length) return;
    const prev = records[(selectedIndex - 1 + records.length) % records.length];
    setSelectedId(prev.HillID);
  }
  function updateSelected(field, value) {
    const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    setRecords((prev) => prev.map((p) => (p.HillID === selected.HillID ? { ...p, [field]: value, timestamp: now } : p)));
  }
  function handleTraitKeyDown(e, traitKey) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (settings.autoNext) goNext();
      else {
        const idx = traits.findIndex((t) => t.key === traitKey);
        const nextTrait = traits[idx + 1]?.key;
        if (nextTrait) traitRefs.current[nextTrait]?.focus();
      }
    }
  }
  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  }
  function addTrait() {
    const label = newTrait.trim();
    if (!label) return;
    const key = safeKey(label);
    if (traits.some((t) => t.key === key)) return alert("Trait already exists.");
    setTraits((prev) => [...prev, { key, label, type: "number" }]);
    setRecords((prev) => prev.map((p) => ({ ...p, [key]: "" })));
    setSettings((s) => ({ ...s, defaultTraitKey: s.defaultTraitKey || key }));
    setNewTrait("");
  }
  function removeTrait(key) {
    setTraits((prev) => prev.filter((t) => t.key !== key));
    if (settings.defaultTraitKey === key) setSettings((s) => ({ ...s, defaultTraitKey: traits[0]?.key || "" }));
  }
  function saveNow() {
    localStorage.setItem("fieldbook-hill-records", JSON.stringify(records));
    localStorage.setItem("fieldbook-traits", JSON.stringify(traits));
    localStorage.setItem("fieldbook-settings", JSON.stringify(settings));
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200);
  }
  function resetFromExampleMap() {
    if (!confirm("Replace current data with the example hill/line layout?")) return;
    const fresh = makeRecordsFromDefaultLayout(settings);
    setRecords(fresh); setSelectedId(fresh[0].HillID);
  }
  function clearDataForNewTrial() {
    if (!confirm("Clear all current field data and start a new blank trial? Export CSV first if you need a backup.")) return;
    localStorage.removeItem("fieldbook-hill-records");
    const fresh = makeRecordsFromDefaultLayout(settings).map((r) => {
      const cleared = { ...r, notes: "", timestamp: "" };
      traits.forEach((t) => { cleared[t.key] = ""; });
      return cleared;
    });
    setRecords(fresh);
    setSelectedId(fresh[0].HillID);
    setQuery("");
    setRepFilter("All");
  }
  function addRecord() {
    const hillID = `H${String(records.length + 1).padStart(3, "0")}`;
    const newRecord = baseRecord({ settings, hill_id: hillID, hill: records.length + 1, genotype: `Entry-${records.length + 1}` });
    traits.forEach((t) => { newRecord[t.key] = ""; });
    setRecords((prev) => [...prev, newRecord]); setSelectedId(newRecord.HillID);
  }
  function deleteSelected() {
    if (records.length <= 1) return;
    const remaining = records.filter((p) => p.HillID !== selected.HillID);
    setRecords(remaining); setSelectedId(remaining[0].HillID);
  }
  async function importFieldMap(e) {
    const file = e.target.files?.[0]; if (!file) return;

    if (file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")) {
      const text = await file.text();
      const imported = parseCSV(text, traits, settings);
      if (imported.length) {
        const crop = imported[0].crop || settings.crop;
        const trial = imported[0].Trial || settings.trial;
        setSettings((s) => ({ ...s, crop, trial }));
        setRecords(imported); setSelectedId(imported[0].HillID);
      }
    } else if (file.type.startsWith("image/") || file.type === "application/pdf") {
      const url = URL.createObjectURL(file);
      setMapFileUrl(url);
      setMapFileType(file.type);
      alert("Map image/PDF added as a reference. To automatically create hill/line records, import a CSV field map.");
    } else {
      alert("Unsupported file type. Please import CSV, PDF, PNG, or JPG.");
    }
    e.target.value = "";
  }
  function downloadCSV(filename, text) { const blob = new Blob([text], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
  function exportRawCSV() {
    const headers = ["HillID", "record_id", "barcode", "crop", "Trial", "Environment", "Block", "Row", "Hill", "Line", "Rep", "Genotype", "EntryClass", ...traits.map((t) => t.key), "notes", "timestamp"];
    downloadCSV(`${safeKey(settings.crop)}_hill_line_raw_data.csv`, toCSV(records, headers));
  }
  function exportBLUPCSV() {
    const headers = ["Genotype", "EntryClass", "crop", "Environment", "Trial", "Rep", "Block", "Row", "Hill", "Line", "HillID", ...traits.map((t) => t.key), "notes"];
    downloadCSV(`${safeKey(settings.crop)}_HILL_LINE_BLUP_READY.csv`, toCSV(records.map((p) => ({ ...p, Environment: p.Environment || p.Trial })), headers));
  }
  function exportTemplate() {
    const sample = makeRecordsFromDefaultLayout(settings);
    const headers = ["HillID", "barcode", "crop", "Trial", "Environment", "Block", "Row", "Hill", "Line", "Rep", "Genotype", "EntryClass"];
    downloadCSV(`${safeKey(settings.crop)}_hill_line_field_map_template.csv`, toCSV(sample, headers));
  }
  function findBarcode(code) {
    const hit = records.find((p) => String(p.barcode).toLowerCase() === code.toLowerCase() || String(p.HillID).toLowerCase() === code.toLowerCase() || String(p.record_id).toLowerCase() === code.toLowerCase());
    if (hit) { setSelectedId(hit.HillID); setQuery(code); setScannerOpen(false); } else alert("No matching hill/line barcode found.");
  }

  const layoutRows = useMemo(() => Array.from(new Set(records.map((p) => String(p.Row)))).sort((a, b) => Number(a) - Number(b)), [records]);
  const layoutHills = useMemo(() => Array.from(new Set(records.map((p) => String(p.Hill)))).sort((a, b) => Number(a) - Number(b)), [records]);
  const hillCells = useMemo(() => {
    const seen = new globalThis.Map();
    records.forEach((r) => {
      const key = `${r.Row}-${r.Hill}`;
      if (!seen.has(key)) seen.set(key, r);
    });
    return seen;
  }, [records]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-950 rounded-[2.5rem] p-3 shadow-2xl">
        <div className="bg-slate-50 rounded-[2rem] overflow-hidden min-h-[850px] relative">
          <div className="bg-emerald-700 text-white px-5 pt-8 pb-5">
            <div className="flex items-center justify-between">
              <div><p className="text-xs opacity-80">Offline hill/line data · {settings.crop}</p><h1 className="text-2xl font-bold flex items-center gap-2"><Leaf size={24} /> FieldBook</h1></div>
              <WifiOff size={28} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Stat value={uniqueHills} label="Hills/Lines" /><Stat value={traits.length} label="Traits" /><Stat value={completed} label="Scored" /></div>
          </div>

          <div className="p-4 space-y-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <div className="grid grid-cols-2 gap-2">
              <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} className="rounded-2xl border border-slate-200 p-2.5 text-sm bg-white outline-none">{reps.map((r) => <option key={r} value={r}>{r === "All" ? "All reps" : `Rep ${r}`}</option>)}</select>
              <Button onClick={() => setScannerOpen(true)} className="rounded-2xl bg-slate-900 hover:bg-slate-800"><QrCode className="mr-2" size={16} /> Barcode</Button>
            </div>
            <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search hill, line, genotype, crop..." className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500" /></div>

            <div className="bg-white rounded-3xl border border-slate-200 p-3 space-y-2">
              <p className="text-xs font-bold text-slate-600 flex items-center gap-1"><Settings size={14} /> Crop + field map + traits</p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setShowSettings(!showSettings)} variant="outline" className="rounded-2xl"><Settings className="mr-2" size={15} /> Settings</Button>
                <Button onClick={exportTemplate} variant="outline" className="rounded-2xl"><Download className="mr-2" size={15} /> Template</Button>
                <Button onClick={() => fileRef.current?.click()} variant="outline" className="rounded-2xl"><Upload className="mr-2" size={15} /> Import CSV/PDF/Image</Button>
                <Button onClick={resetFromExampleMap} variant="outline" className="rounded-2xl">Example map</Button>
                <Button onClick={clearDataForNewTrial} variant="outline" className="rounded-2xl text-red-600">Clear Data</Button>
                <Button onClick={addRecord} variant="outline" className="rounded-2xl"><PlusCircle className="mr-2" size={15} /> Hill/Line</Button>
                <Button onClick={() => setShowLayout(!showLayout)} variant="outline" className="rounded-2xl"><MapIcon className="mr-2" size={15} /> Layout</Button>
              </div>
              {showSettings && <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-2xl"><Field label="Crop" value={settings.crop} onChange={(v) => setSettings((s) => ({ ...s, crop: v }))} /><Field label="Trial" value={settings.trial} onChange={(v) => setSettings((s) => ({ ...s, trial: v }))} /><label className="text-xs font-semibold text-slate-600 flex items-center gap-2 mt-6"><input type="checkbox" checked={settings.autoNext} onChange={(e) => setSettings((s) => ({ ...s, autoNext: e.target.checked }))} /> Auto-next</label></div>}
              <div className="flex gap-2"><input value={newTrait} onChange={(e) => setNewTrait(e.target.value)} placeholder="Add trait e.g. rind thickness" className="flex-1 rounded-2xl border border-slate-200 p-2 text-sm" /><Button onClick={addTrait} className="rounded-2xl bg-emerald-700">Add</Button></div>
              <div className="flex gap-1 overflow-x-auto pb-1">{traits.map((t) => <button key={t.key} onClick={() => removeTrait(t.key)} className="text-[10px] bg-slate-100 rounded-full px-2 py-1 whitespace-nowrap">{t.label} ×</button>)}</div>
            </div>

            {mapFileUrl && <div className="bg-white rounded-3xl border border-slate-200 p-3 space-y-2"><div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-600">Uploaded map reference</p><button onClick={() => { setMapFileUrl(""); setMapFileType(""); localStorage.removeItem("fieldbook-map-file-url"); localStorage.removeItem("fieldbook-map-file-type"); }} className="text-xs text-red-600">Remove</button></div>{mapFileType === "application/pdf" ? <iframe src={mapFileUrl} title="Field map PDF" className="w-full h-72 rounded-2xl border" /> : <img src={mapFileUrl} alt="Uploaded field map" className="w-full max-h-72 object-contain rounded-2xl border" />}<p className="text-[10px] text-slate-500">PDF/image maps are shown as reference only. Use CSV import to automatically create hill/line records.</p></div>}

            {showLayout && <div className="bg-white rounded-3xl border border-slate-200 p-3 space-y-2"><p className="text-xs font-bold text-slate-600">Layout: Row × Hill/Line</p><div className="overflow-auto max-h-64 border rounded-2xl p-2 bg-slate-50"><div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${layoutHills.length}, minmax(56px, 1fr))` }}>{layoutRows.flatMap((r) => layoutHills.map((hill) => { const cell = hillCells.get(`${r}-${hill}`); if (!cell) return <div key={`${r}-${hill}`} className="h-14 rounded-xl bg-slate-200" />; const active = selected?.HillID === cell.HillID; const cls = cell.EntryClass === "BORDER" ? "bg-stone-300" : cell.EntryClass === "CHECK" ? "bg-orange-100" : "bg-white"; return <button key={`${r}-${hill}`} onClick={() => setSelectedId(cell.HillID)} className={`h-14 rounded-xl text-[9px] px-1 border ${active ? "bg-emerald-700 text-white border-emerald-700" : `${cls} border-slate-200`}`}><div className="font-bold truncate">{cell.HillID}</div><div className="truncate">{cell.Genotype}</div><div className="truncate">R{cell.Row} H{cell.Hill}</div></button>; }))}</div></div><p className="text-[10px] text-slate-500">Each hill/line is one record. No individual plant records are used.</p></div>}

            <div className="flex gap-2 overflow-x-auto pb-1">{filteredRecords.map((p) => <button key={p.HillID} onClick={() => selectRecord(p.HillID)} className={`min-w-[116px] rounded-2xl px-3 py-2 text-left border transition ${selected?.HillID === p.HillID ? "bg-emerald-700 text-white border-emerald-700" : "bg-white border-slate-200"}`}><p className="text-xs font-bold truncate">{p.HillID}</p><p className="text-[11px] opacity-75 truncate">{p.Genotype}</p><p className="text-[10px] opacity-70 truncate">Row {p.Row} · Hill {p.Hill}</p></button>)}</div>

            {selected && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={selected.HillID}><Card className="rounded-3xl shadow-sm border border-slate-200"><CardContent className="p-4 space-y-3"><div className="flex justify-between items-start gap-2"><div className="min-w-0"><p className="text-xs text-slate-500">Current hill/line record</p><h2 className="text-lg font-bold text-slate-900 truncate">{selected.HillID}</h2><p className="text-xs text-slate-500 truncate">Barcode: {selected.barcode}</p></div><span className="text-xs px-3 py-1 rounded-full shrink-0 bg-emerald-100 text-emerald-800">Rep {selected.Rep}</span></div><div className="grid grid-cols-2 gap-3"><Field label="Crop" value={selected.crop} onChange={(v) => updateSelected("crop", v)} /><Field label="Trial" value={selected.Trial} onChange={(v) => updateSelected("Trial", v)} /><Field label="Genotype" value={selected.Genotype} onChange={(v) => updateSelected("Genotype", v)} /><Field label="EntryClass" value={selected.EntryClass} onChange={(v) => updateSelected("EntryClass", v)} /><Field label="HillID" value={selected.HillID} onChange={(v) => updateSelected("HillID", v)} /><Field label="Rep" value={selected.Rep} onChange={(v) => updateSelected("Rep", v)} /><Field label="Row" value={selected.Row} onChange={(v) => updateSelected("Row", v)} /><Field label="Hill/Line" value={selected.Hill} onChange={(v) => updateSelected("Hill", v)} /><Field label="Block" value={selected.Block} onChange={(v) => updateSelected("Block", v)} /></div><div className="grid grid-cols-2 gap-3">{traits.map((trait, idx) => <Field key={trait.key} label={trait.label} type={trait.type} inputMode="decimal" value={selected[trait.key] ?? ""} onChange={(v) => updateSelected(trait.key, v)} onKeyDown={(e) => handleTraitKeyDown(e, trait.key)} inputRef={(settings.defaultTraitKey === trait.key || (!settings.defaultTraitKey && idx === 0)) ? firstTraitRef : (el) => { traitRefs.current[trait.key] = el; }} />)}</div><label className="block text-xs font-semibold text-slate-600">Field notes</label><textarea value={selected.notes || ""} onChange={(e) => updateSelected("notes", e.target.value)} placeholder="Missing hill, disease, harvest notes, fruit quality..." className="w-full min-h-[82px] rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" /></CardContent></Card></motion.div>}

            <input ref={fileRef} type="file" accept=".csv,.pdf,image/png,image/jpeg,image/jpg" className="hidden" onChange={importFieldMap} />
            <div className="grid grid-cols-2 gap-2"><Button onClick={saveNow} className="rounded-2xl bg-emerald-700 hover:bg-emerald-800"><Save className="mr-2" size={16} /> {savedFlash ? "Saved" : "Save"}</Button><Button onClick={exportRawCSV} variant="outline" className="rounded-2xl"><Download className="mr-2" size={16} /> Raw CSV</Button><Button onClick={exportBLUPCSV} variant="outline" className="rounded-2xl"><Download className="mr-2" size={16} /> BLUP CSV</Button><Button onClick={deleteSelected} variant="outline" className="rounded-2xl text-red-600"><Trash2 className="mr-2" size={16} /> Delete</Button></div>
            <div className="sticky bottom-0 z-40 bg-slate-50/95 backdrop-blur border-t border-slate-200 pt-3 pb-2 flex gap-2"><Button onClick={goPrev} variant="outline" className="rounded-2xl flex-1 py-3 text-base">Previous</Button><Button onClick={goNext} className="rounded-2xl bg-emerald-700 hover:bg-emerald-800 flex-1 py-3 text-base">Next hill/line</Button></div>
            <p className="text-center text-[11px] text-slate-400">Fast entry: hill/line-level data only. Use bottom buttons or swipe left/right to move between records.</p>
          </div>
          {scannerOpen && <ScannerModal onClose={() => setScannerOpen(false)} manualBarcode={manualBarcode} setManualBarcode={setManualBarcode} onFind={findBarcode} />}
        </div>
      </div>
    </div>
  );
}

function ScannerModal({ onClose, manualBarcode, setManualBarcode, onFind }) { return <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-5 z-50"><div className="bg-white rounded-3xl p-5 w-full max-w-xs space-y-4 shadow-xl"><div className="flex items-center justify-between"><h3 className="font-bold text-lg flex items-center gap-2"><Camera size={20} /> Barcode lookup</h3><button onClick={onClose}><X size={22} /></button></div><div className="bg-slate-100 rounded-2xl p-4 text-sm text-slate-600">Type or paste a hill/line barcode. Example: H001.</div><input value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value)} placeholder="H001..." className="w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" /><Button onClick={() => onFind(manualBarcode)} className="w-full rounded-2xl bg-emerald-700 hover:bg-emerald-800">Find</Button></div></div>; }
function Stat({ value, label }) { return <div className="bg-white/15 rounded-2xl p-2"><p className="text-lg font-bold">{value}</p><p className="text-[10px] opacity-80">{label}</p></div>; }
function Field({ label, value, onChange, onKeyDown, type = "text", inputMode, inputRef }) { return <div><label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label><input ref={inputRef} type={type} inputMode={inputMode || (type === "number" ? "decimal" : undefined)} pattern={type === "number" ? "[0-9]*[.]?[0-9]*" : undefined} value={value ?? ""} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} className="w-full rounded-2xl border border-slate-200 p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>; }
