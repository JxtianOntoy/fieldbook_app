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

const DEFAULT_PLANTS_PER_PLOT = 10;

const DEFAULT_SETTINGS = {
  crop: "Cantaloupe",
  trial: "FieldTrial1",
  plantsPerPlot: DEFAULT_PLANTS_PER_PLOT,
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

// Default example layout from your R-generated cantaloupe map: 7 rows × 12 hills.
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
function repFromPlot(plotNumber) {
  if (plotNumber <= 4) return 1;
  if (plotNumber <= 8) return 2;
  return 3;
}

function baseRecord({ settings = DEFAULT_SETTINGS, trial, block = "Rep1", row = 1, plot = 1, plot_id = "H001", plant_number = 1, genotype = "Entry-1", rep = 1, entry_class = "" }) {
  const plant_id = `${plot_id}_P${String(plant_number).padStart(2, "0")}`;
  return {
    plant_id,
    barcode: plant_id,
    PlotID: plot_id,
    Trial: trial || settings.trial,
    Environment: trial || settings.trial,
    Block: block,
    Row: row,
    Plot: plot,
    PlantNumber: plant_number,
    Rep: rep,
    Genotype: genotype,
    EntryClass: entryClass(genotype, entry_class),
    PlantsPerPlot: settings.plantsPerPlot,
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
  let plotCount = 1;
  DEFAULT_LAYOUT.forEach((rowData, rowIndex) => {
    rowData.forEach((genotype, colIndex) => {
      const plot = colIndex + 1;
      const rep = repFromPlot(plot);
      const plot_id = `H${String(plotCount).padStart(3, "0")}`;
      for (let plant = 1; plant <= Number(settings.plantsPerPlot || 1); plant++) {
        records.push(baseRecord({ settings, trial: settings.trial, block: `Rep${rep}`, row: rowIndex + 1, plot, plot_id, plant_number: plant, genotype, rep }));
      }
      plotCount++;
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

    const plantsPerPlot = Number(pick(row, ["PlantsPerPlot", "plants_per_plot", "PlantsPerHill", "plants_per_hill"], settings.plantsPerPlot || 1));
    const rowNo = Number(pick(row, ["Row", "ROW", "row", "field_row"], Math.floor(i / (12 * plantsPerPlot)) + 1));
    const plot = Number(pick(row, ["Plot", "plot", "Hill", "hill", "PlotNumber", "plot_number", "HillNumber", "hill_number"], (Math.floor(i / plantsPerPlot) % 12) + 1));
    const plantNo = Number(pick(row, ["PlantNumber", "plant_number", "Plant", "plant", "plant_no"], (i % plantsPerPlot) + 1));
    const rep = Number(pick(row, ["Rep", "REP", "rep", "Replication", "replication", "Block", "block"], repFromPlot(plot)));
    const genotype = pick(row, ["Genotype", "GENOTYPE", "genotype", "Entry", "entry", "Accession", "accession", "Cultivar", "cultivar"], `Entry-${i + 1}`);
    const plotID = pick(row, ["PlotID", "plot_id", "PlotId", "HillID", "hill_id", "HillId"], `H${String(Math.floor(i / plantsPerPlot) + 1).padStart(3, "0")}`);
    const plantID = pick(row, ["plant_id", "PlantID", "PlantId", "barcode", "Barcode"], `${plotID}_P${String(plantNo).padStart(2, "0")}`);
    const trial = pick(row, ["Trial", "TRIAL", "trial", "Environment", "ENV", "env"], settings.trial);
    const block = pick(row, ["Block", "BLOCK", "block"], `Rep${rep}`);
    const crop = pick(row, ["crop", "Crop", "CROP"], settings.crop);
    const entryCls = pick(row, ["EntryClass", "entry_class", "Class", "class"], entryClass(genotype));

    const p = baseRecord({ settings: { ...settings, crop, trial, plantsPerPlot }, trial, block, row: rowNo, plot, plot_id: plotID, plant_number: plantNo, genotype, rep, entry_class: entryCls });
    traits.forEach((t) => { if (row[t.key] !== undefined) p[t.key] = row[t.key]; });
    return { ...p, ...row, plant_id: plantID, barcode: pick(row, ["barcode", "Barcode", "BARCODE"], plantID), PlotID: plotID, Trial: trial, Environment: pick(row, ["Environment", "ENV", "env"], trial), Block: block, Row: rowNo, Plot: plot, Hill: plot, PlantNumber: plantNo, Rep: rep, Genotype: genotype, EntryClass: entryCls, PlantsPerPlot: plantsPerPlot, crop };
  });
}

export default function FieldBookOfflineApp() {
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem("fieldbook-settings")) || {}) }; }
    catch { return DEFAULT_SETTINGS; }
  });
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fieldbook-plant-records")) || makeRecordsFromDefaultLayout(DEFAULT_SETTINGS); }
    catch { return makeRecordsFromDefaultLayout(DEFAULT_SETTINGS); }
  });
  const [traits, setTraits] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fieldbook-traits")) || DEFAULT_TRAITS; }
    catch { return DEFAULT_TRAITS; }
  });
  const [selectedId, setSelectedId] = useState(records[0]?.plant_id || "");
  const [query, setQuery] = useState("");
  const [repFilter, setRepFilter] = useState("All");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [newTrait, setNewTrait] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [showLayout, setShowLayout] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef(null);
  const firstTraitRef = useRef(null);
  const traitRefs = useRef({});

  useEffect(() => { localStorage.setItem("fieldbook-plant-records", JSON.stringify(records)); }, [records]);
  useEffect(() => { localStorage.setItem("fieldbook-traits", JSON.stringify(traits)); }, [traits]);
  useEffect(() => { localStorage.setItem("fieldbook-settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => { setTimeout(() => firstTraitRef.current?.focus(), 80); }, [selectedId]);

  const reps = useMemo(() => ["All", ...Array.from(new Set(records.map((p) => String(p.Rep)))).filter(Boolean)], [records]);
  const selected = records.find((p) => p.plant_id === selectedId) || records[0];
  const selectedIndex = records.findIndex((p) => p.plant_id === selectedId);
  const completed = records.filter((p) => traits.some((t) => p[t.key] !== "" && p[t.key] != null)).length;
  const uniquePlots = useMemo(() => Array.from(new Set(records.map((p) => p.PlotID))).length, [records]);

  const filteredRecords = useMemo(() => {
    const q = query.toLowerCase().trim();
    return records.filter((p) => {
      const repOK = repFilter === "All" || String(p.Rep) === repFilter;
      const textOK = !q || [p.plant_id, p.PlotID, p.barcode, p.Genotype, p.EntryClass, p.Block, p.Trial, p.crop].some((x) => String(x).toLowerCase().includes(q));
      return repOK && textOK;
    });
  }, [records, query, repFilter]);

  function selectRecord(id) {
    setSelectedId(id);
  }
  function goNext() {
    if (!records.length) return;
    const next = records[(selectedIndex + 1) % records.length];
    setSelectedId(next.plant_id);
  }
  function goPrev() {
    if (!records.length) return;
    const prev = records[(selectedIndex - 1 + records.length) % records.length];
    setSelectedId(prev.plant_id);
  }
  function updateSelected(field, value) {
    const now = new Date().toISOString();
    setRecords((prev) => prev.map((p) => (p.plant_id === selected.plant_id ? { ...p, [field]: value, timestamp: now } : p)));
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
    localStorage.setItem("fieldbook-plant-records", JSON.stringify(records));
    localStorage.setItem("fieldbook-traits", JSON.stringify(traits));
    localStorage.setItem("fieldbook-settings", JSON.stringify(settings));
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200);
  }
  function resetFromExampleMap() {
    if (!confirm(`Replace current data with example layout using ${settings.plantsPerPlot} plants per plot?`)) return;
    const fresh = makeRecordsFromDefaultLayout(settings);
    setRecords(fresh); setSelectedId(fresh[0].plant_id);
  }
  function addRecord() {
    const plotID = `PLOT${String(uniquePlots + 1).padStart(3, "0")}`;
    const newRecord = baseRecord({ settings, plot_id: plotID, plant_number: 1, plot: 1, genotype: `Entry-${records.length + 1}` });
    traits.forEach((t) => { newRecord[t.key] = ""; });
    setRecords((prev) => [...prev, newRecord]); setSelectedId(newRecord.plant_id);
  }
  function deleteSelected() {
    if (records.length <= 1) return;
    const remaining = records.filter((p) => p.plant_id !== selected.plant_id);
    setRecords(remaining); setSelectedId(remaining[0].plant_id);
  }
  async function importFieldMap(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const imported = parseCSV(text, traits, settings);
    if (imported.length) {
      const crop = imported[0].crop || settings.crop;
      const trial = imported[0].Trial || settings.trial;
      const plantsPerPlot = Number(imported[0].PlantsPerPlot || settings.plantsPerPlot || 1);
      setSettings((s) => ({ ...s, crop, trial, plantsPerPlot }));
      setRecords(imported); setSelectedId(imported[0].plant_id);
    }
    e.target.value = "";
  }
  function downloadCSV(filename, text) { const blob = new Blob([text], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
  function exportRawCSV() { const headers = ["plant_id", "barcode", "PlotID", "crop", "Trial", "Environment", "Block", "Row", "Plot", "Hill", "PlantNumber", "Rep", "Genotype", "EntryClass", "PlantsPerPlot", ...traits.map((t) => t.key), "notes", "timestamp"]; downloadCSV(`${safeKey(settings.crop)}_plant_level_raw_data.csv`, toCSV(records, headers)); }
  function exportBLUPCSV() { const headers = ["Genotype", "EntryClass", "crop", "Environment", "Trial", "Rep", "Block", "Row", "Plot", "PlotID", "PlantNumber", "plant_id", ...traits.map((t) => t.key), "notes"]; downloadCSV(`${safeKey(settings.crop)}_PLANT_LEVEL_BLUP_READY.csv`, toCSV(records.map((p) => ({ ...p, Environment: p.Environment || p.Trial })), headers)); }
  function exportTemplate() {
    const sample = makeRecordsFromDefaultLayout(settings);
    const headers = ["plant_id", "barcode", "PlotID", "crop", "Trial", "Environment", "Block", "Row", "Plot", "PlantNumber", "Rep", "Genotype", "EntryClass", "PlantsPerPlot"];
    downloadCSV(`${safeKey(settings.crop)}_field_map_template.csv`, toCSV(sample, headers));
  }
  function findBarcode(code) {
    const hit = records.find((p) => String(p.barcode).toLowerCase() === code.toLowerCase() || String(p.plant_id).toLowerCase() === code.toLowerCase() || String(p.PlotID).toLowerCase() === code.toLowerCase());
    if (hit) { setSelectedId(hit.plant_id); setQuery(code); setScannerOpen(false); } else alert("No matching plant/plot barcode found.");
  }

  const layoutRows = useMemo(() => Array.from(new Set(records.map((p) => String(p.Row)))).sort((a, b) => Number(a) - Number(b)), [records]);
  const layoutPlots = useMemo(() => Array.from(new Set(records.map((p) => String(p.Plot)))).sort((a, b) => Number(a) - Number(b)), [records]);
  const plotCells = useMemo(() => {
    const seen = new globalThis.Map();
    records.forEach((r) => {
      const key = `${r.Row}-${r.Plot}`;
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
              <div><p className="text-xs opacity-80">Offline field data · {settings.crop}</p><h1 className="text-2xl font-bold flex items-center gap-2"><Leaf size={24} /> FieldBook</h1></div>
              <WifiOff size={28} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Stat value={uniquePlots} label="Plots" /><Stat value={records.length} label="Plants" /><Stat value={completed} label="Scored" /></div>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} className="rounded-2xl border border-slate-200 p-2.5 text-sm bg-white outline-none">{reps.map((r) => <option key={r} value={r}>{r === "All" ? "All reps" : `Rep ${r}`}</option>)}</select>
              <Button onClick={() => setScannerOpen(true)} className="rounded-2xl bg-slate-900 hover:bg-slate-800"><QrCode className="mr-2" size={16} /> Barcode</Button>
            </div>
            <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plant, plot, genotype, crop..." className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500" /></div>

            <div className="bg-white rounded-3xl border border-slate-200 p-3 space-y-2">
              <p className="text-xs font-bold text-slate-600 flex items-center gap-1"><Settings size={14} /> Crop + field map + traits</p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setShowSettings(!showSettings)} variant="outline" className="rounded-2xl"><Settings className="mr-2" size={15} /> Settings</Button>
                <Button onClick={exportTemplate} variant="outline" className="rounded-2xl"><Download className="mr-2" size={15} /> Template</Button>
                <Button onClick={() => fileRef.current?.click()} variant="outline" className="rounded-2xl"><Upload className="mr-2" size={15} /> Import map</Button>
                <Button onClick={resetFromExampleMap} variant="outline" className="rounded-2xl">Example map</Button>
                <Button onClick={addRecord} variant="outline" className="rounded-2xl"><PlusCircle className="mr-2" size={15} /> Plant</Button>
                <Button onClick={() => setShowLayout(!showLayout)} variant="outline" className="rounded-2xl"><MapIcon className="mr-2" size={15} /> Layout</Button>
              </div>
              {showSettings && <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-2xl"><Field label="Crop" value={settings.crop} onChange={(v) => setSettings((s) => ({ ...s, crop: v }))} /><Field label="Trial" value={settings.trial} onChange={(v) => setSettings((s) => ({ ...s, trial: v }))} /><Field label="Plants/plot" type="number" value={settings.plantsPerPlot} onChange={(v) => setSettings((s) => ({ ...s, plantsPerPlot: Number(v) || 1 }))} /><label className="text-xs font-semibold text-slate-600 flex items-center gap-2 mt-6"><input type="checkbox" checked={settings.autoNext} onChange={(e) => setSettings((s) => ({ ...s, autoNext: e.target.checked }))} /> Auto-next</label></div>}
              <div className="flex gap-2"><input value={newTrait} onChange={(e) => setNewTrait(e.target.value)} placeholder="Add trait e.g. rind thickness" className="flex-1 rounded-2xl border border-slate-200 p-2 text-sm" /><Button onClick={addTrait} className="rounded-2xl bg-emerald-700">Add</Button></div>
              <div className="flex gap-1 overflow-x-auto pb-1">{traits.map((t) => <button key={t.key} onClick={() => removeTrait(t.key)} className="text-[10px] bg-slate-100 rounded-full px-2 py-1 whitespace-nowrap">{t.label} ×</button>)}</div>
            </div>

            {showLayout && <div className="bg-white rounded-3xl border border-slate-200 p-3 space-y-2"><p className="text-xs font-bold text-slate-600">Plot layout: Row × Plot. Tap plot to open plant 1.</p><div className="overflow-auto max-h-64 border rounded-2xl p-2 bg-slate-50"><div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${layoutPlots.length}, minmax(56px, 1fr))` }}>{layoutRows.flatMap((r) => layoutPlots.map((plot) => { const cell = plotCells.get(`${r}-${plot}`); if (!cell) return <div key={`${r}-${plot}`} className="h-14 rounded-xl bg-slate-200" />; const active = selected?.PlotID === cell.PlotID; const cls = cell.EntryClass === "BORDER" ? "bg-stone-300" : cell.EntryClass === "CHECK" ? "bg-orange-100" : "bg-white"; return <button key={`${r}-${plot}`} onClick={() => setSelectedId(cell.plant_id)} className={`h-14 rounded-xl text-[9px] px-1 border ${active ? "bg-emerald-700 text-white border-emerald-700" : `${cls} border-slate-200`}`}><div className="font-bold truncate">{cell.PlotID}</div><div className="truncate">{cell.Genotype}</div><div className="truncate">R{cell.Row} P{cell.Plot}</div></button>; }))}</div></div><p className="text-[10px] text-slate-500">Each plot/hill can have multiple independent plant records. Use PlantNumber for within-plot plants.</p></div>}

            <div className="flex justify-between gap-2"><Button onClick={goPrev} variant="outline" className="rounded-2xl flex-1">Previous</Button><Button onClick={goNext} className="rounded-2xl bg-emerald-700 flex-1">Next plant</Button></div>

            <div className="flex gap-2 overflow-x-auto pb-1">{filteredRecords.map((p) => <button key={p.plant_id} onClick={() => selectRecord(p.plant_id)} className={`min-w-[116px] rounded-2xl px-3 py-2 text-left border transition ${selected?.plant_id === p.plant_id ? "bg-emerald-700 text-white border-emerald-700" : "bg-white border-slate-200"}`}><p className="text-xs font-bold truncate">{p.plant_id}</p><p className="text-[11px] opacity-75 truncate">{p.Genotype}</p><p className="text-[10px] opacity-70 truncate">Plot {p.Plot} · Plant {p.PlantNumber}</p></button>)}</div>

            {selected && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={selected.plant_id}><Card className="rounded-3xl shadow-sm border border-slate-200"><CardContent className="p-4 space-y-3"><div className="flex justify-between items-start gap-2"><div className="min-w-0"><p className="text-xs text-slate-500">Current plant record</p><h2 className="text-lg font-bold text-slate-900 truncate">{selected.plant_id}</h2><p className="text-xs text-slate-500 truncate">Plot: {selected.PlotID} · Barcode: {selected.barcode}</p></div><span className="text-xs px-3 py-1 rounded-full shrink-0 bg-emerald-100 text-emerald-800">Rep {selected.Rep}</span></div><div className="grid grid-cols-2 gap-3"><Field label="Crop" value={selected.crop} onChange={(v) => updateSelected("crop", v)} /><Field label="Trial" value={selected.Trial} onChange={(v) => updateSelected("Trial", v)} /><Field label="Genotype" value={selected.Genotype} onChange={(v) => updateSelected("Genotype", v)} /><Field label="EntryClass" value={selected.EntryClass} onChange={(v) => updateSelected("EntryClass", v)} /><Field label="PlotID" value={selected.PlotID} onChange={(v) => updateSelected("PlotID", v)} /><Field label="Rep" value={selected.Rep} onChange={(v) => updateSelected("Rep", v)} /><Field label="Row" value={selected.Row} onChange={(v) => updateSelected("Row", v)} /><Field label="Plot/Hill" value={selected.Plot} onChange={(v) => updateSelected("Plot", v)} /><Field label="PlantNumber" value={selected.PlantNumber} onChange={(v) => updateSelected("PlantNumber", v)} /><Field label="Block" value={selected.Block} onChange={(v) => updateSelected("Block", v)} /></div><div className="grid grid-cols-2 gap-3">{traits.map((trait, idx) => <Field key={trait.key} label={trait.label} type={trait.type} inputMode="decimal" value={selected[trait.key] ?? ""} onChange={(v) => updateSelected(trait.key, v)} onKeyDown={(e) => handleTraitKeyDown(e, trait.key)} inputRef={(settings.defaultTraitKey === trait.key || (!settings.defaultTraitKey && idx === 0)) ? firstTraitRef : (el) => { traitRefs.current[trait.key] = el; }} />)}</div><label className="block text-xs font-semibold text-slate-600">Field notes</label><textarea value={selected.notes || ""} onChange={(e) => updateSelected("notes", e.target.value)} placeholder="Missing plant, disease, harvest notes, fruit quality..." className="w-full min-h-[82px] rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" /></CardContent></Card></motion.div>}

            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importFieldMap} />
            <div className="grid grid-cols-2 gap-2"><Button onClick={saveNow} className="rounded-2xl bg-emerald-700 hover:bg-emerald-800"><Save className="mr-2" size={16} /> {savedFlash ? "Saved" : "Save"}</Button><Button onClick={exportRawCSV} variant="outline" className="rounded-2xl"><Download className="mr-2" size={16} /> Raw CSV</Button><Button onClick={exportBLUPCSV} variant="outline" className="rounded-2xl"><Download className="mr-2" size={16} /> BLUP CSV</Button><Button onClick={deleteSelected} variant="outline" className="rounded-2xl text-red-600"><Trash2 className="mr-2" size={16} /> Delete</Button></div>
            <p className="text-center text-[11px] text-slate-400">Fast entry: type a trait value and press Enter to jump to the next plant. Add to Home Screen after installing PWA files for laptop-free offline use.</p>
          </div>
          {scannerOpen && <ScannerModal onClose={() => setScannerOpen(false)} manualBarcode={manualBarcode} setManualBarcode={setManualBarcode} onFind={findBarcode} />}
        </div>
      </div>
    </div>
  );
}

function ScannerModal({ onClose, manualBarcode, setManualBarcode, onFind }) { return <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-5 z-50"><div className="bg-white rounded-3xl p-5 w-full max-w-xs space-y-4 shadow-xl"><div className="flex items-center justify-between"><h3 className="font-bold text-lg flex items-center gap-2"><Camera size={20} /> Barcode lookup</h3><button onClick={onClose}><X size={22} /></button></div><div className="bg-slate-100 rounded-2xl p-4 text-sm text-slate-600">Type or paste a plant barcode, plant ID, or PlotID. Example: H001_P01 or H001.</div><input value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value)} placeholder="H001_P01, H001..." className="w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" /><Button onClick={() => onFind(manualBarcode)} className="w-full rounded-2xl bg-emerald-700 hover:bg-emerald-800">Find</Button></div></div>; }
function Stat({ value, label }) { return <div className="bg-white/15 rounded-2xl p-2"><p className="text-lg font-bold">{value}</p><p className="text-[10px] opacity-80">{label}</p></div>; }
function Field({ label, value, onChange, onKeyDown, type = "text", inputMode, inputRef }) { return <div><label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label><input ref={inputRef} type={type} inputMode={inputMode || (type === "number" ? "decimal" : undefined)} pattern={type === "number" ? "[0-9]*[.]?[0-9]*" : undefined} value={value ?? ""} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} className="w-full rounded-2xl border border-slate-200 p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500" /></div>; }
