import React, { useState, useRef } from "react";
import { 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Save, 
  Copy, 
  Check, 
  FileJson, 
  FileText, 
  RefreshCw, 
  Database,
  Users,
  MapPin,
  ScrollText,
  Compass
} from "lucide-react";
import { CampaignState } from "../types";
import { extractCampaignImages } from "../utils/imageUtils";

interface StandaloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignState: CampaignState | null;
  persistenceMode?: "file" | "kv" | "tmp";
  onImportCampaign: (importedState: CampaignState) => void;
}

export default function StandaloneModal({
  isOpen,
  onClose,
  campaignState,
  persistenceMode = "file",
  onImportCampaign
}: StandaloneModalProps) {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [pastedJson, setPastedJson] = useState("");
  const [importMode, setImportMode] = useState<"file" | "paste">("file");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // 1. Bulletproof Export via Blob + URL.createObjectURL (fetches fresh state or falls back to prop)
  const handleExportJson = async () => {
    setIsExporting(true);
    setImportStatus(null);
    try {
      let dataToExport = campaignState;
      try {
        const res = await fetch("/api/campaign");
        if (res.ok) {
          const fresh = await res.json();
          if (fresh && (fresh.locations || fresh.characters)) {
            dataToExport = fresh;
          }
        }
      } catch {
        // Fallback to in-memory campaignState prop
      }

      if (!dataToExport) {
        throw new Error("No campaign state is currently loaded to export.");
      }

      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const safeName = (dataToExport.campaignName || "aethelgard")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_");
      const filename = `${safeName}-campaign-save-${timestamp}.json`;

      const downloadAnchor = document.createElement("a");
      downloadAnchor.href = url;
      downloadAnchor.download = filename;
      downloadAnchor.style.display = "none";
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();

      setTimeout(() => {
        if (downloadAnchor.parentNode) {
          downloadAnchor.parentNode.removeChild(downloadAnchor);
        }
        URL.revokeObjectURL(url);
      }, 5000);

      setImportStatus({
        type: "success",
        message: `Successfully exported "${filename}" (${(blob.size / 1024).toFixed(1)} KB)!`
      });
    } catch (err: any) {
      console.error("Local blob export error:", err);
      setImportStatus({
        type: "error",
        message: "Failed to download export file: " + (err.message || String(err))
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Copy JSON directly to clipboard as secondary backup
  const handleCopyToClipboard = async () => {
    if (!campaignState) return;
    try {
      const jsonString = JSON.stringify(campaignState, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2500);
      setImportStatus({
        type: "success",
        message: "Campaign JSON copied to clipboard! You can paste and save it anywhere."
      });
    } catch (err: any) {
      console.error("Clipboard copy error:", err);
      setImportStatus({
        type: "error",
        message: "Could not write to clipboard: " + (err.message || String(err))
      });
    }
  };

  // 2. Process and validate parsed JSON payload
  const processImportPayload = async (rawJsonText: string) => {
    setIsImporting(true);
    setImportStatus(null);

    try {
      const cleaned = rawJsonText.replace(/^\uFEFF/, "").trim();
      if (!cleaned) {
        throw new Error("The selected save file is empty.");
      }

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error("Invalid JSON syntax. Please check that the file or text is valid JSON.");
      }

      // Handle wrapped or unwrapped save format
      const candidate = (parsed && (parsed.campaign || parsed.state)) ? (parsed.campaign || parsed.state) : parsed;

      if (!candidate || typeof candidate !== "object") {
        throw new Error("Invalid save file structure. File contains empty data.");
      }

      if (!Array.isArray(candidate.locations) && !Array.isArray(candidate.characters)) {
        throw new Error("Invalid save file structure. Must contain 'locations' or 'characters'.");
      }

      // Send to server to persist to disk and sync
      const res = await fetch("/api/campaign/import-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(candidate)
      });

      const responseText = await res.text();
      if (res.status === 413) {
        throw new Error(
          "Save file exceeds the 4.5 MB serverless request limit on cloud hosts. Use smaller/linked map images or export without oversized embedded images."
        );
      }
      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`Server returned an unexpected response (${res.status}).`);
      }

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to persist imported save.");
      }

      const restoredImages = extractCampaignImages(result.campaign).length;
      onImportCampaign(result.campaign);
      setImportStatus({
        type: "success",
        message: `Campaign restored successfully! Loaded "${result.campaign.campaignName || "Campaign"}" with ${result.campaign.locations.length} locations, ${result.campaign.characters.length} heroes, and ${restoredImages} saved pictures.`
      });
      setPastedJson("");
    } catch (err: any) {
      console.error("Import processing error:", err);
      setImportStatus({
        type: "error",
        message: err.message || "Failed to process campaign save file."
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // File input change
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await processImportPayload(text);
  };

  // Drag and Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const text = await file.text();
    await processImportPayload(text);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Live campaign statistics for preview
  const locationsCount = campaignState?.locations?.length || 0;
  const discoveredCount = campaignState?.locations?.filter(l => l.isDiscovered)?.length || 0;
  const charactersCount = campaignState?.characters?.length || 0;
  const notesCount = campaignState?.notes?.length || 0;
  const campaignTitle = campaignState?.campaignName || "Aethelgard";
  const partyTitle = campaignState?.partyName || "Campaign Party Alliance";
  const currentRegion = campaignState?.regions?.find(r => r.id === campaignState?.currentRegionId)?.name || "The Sword Coast";
  const allCampaignImages = extractCampaignImages(campaignState);
  const embeddedImagesCount = allCampaignImages.filter(img => img.isEmbedded).length;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0e1017] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="px-5 py-4 bg-[#131622] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif italic text-white flex items-center gap-2 font-bold">
                Campaign Save & Load Manager (.json)
              </h2>
              <p className="text-2xs font-mono text-slate-400">
                Backup your full progress to a JSON file or restore a previous game save
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Export vs Import */}
        <div className="flex border-b border-white/10 bg-[#0b0d14] px-5 pt-2 text-xs font-mono">
          <button
            onClick={() => { setActiveTab("export"); setImportStatus(null); }}
            className={`pb-2.5 px-4 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "export"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Save File</span>
          </button>

          <button
            onClick={() => { setActiveTab("import"); setImportStatus(null); }}
            className={`pb-2.5 px-4 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "import"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Save File</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto font-sans text-slate-200">
          
          {/* Status Alert Banner */}
          {importStatus && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 animate-in fade-in duration-200 ${
              importStatus.type === "success" 
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200" 
                : "bg-red-950/60 border-red-500/40 text-red-200"
            }`}>
              {importStatus.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              )}
              <div className="flex-1 font-mono leading-relaxed">
                {importStatus.message}
              </div>
            </div>
          )}

          {/* Current Campaign Snapshot Preview */}
          <div className="p-4 rounded-xl bg-[#131622] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-2xs font-mono uppercase text-slate-400">
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Database className="w-3.5 h-3.5" />
                Active Session Summary
              </span>
              <span className={persistenceMode === "tmp" ? "text-amber-400" : "text-slate-500"}>
                {persistenceMode === "kv"
                  ? "Synced via Vercel Redis / KV"
                  : persistenceMode === "tmp"
                  ? "Ephemeral cloud cache — Export JSON or link Redis"
                  : "Auto-saved to disk"}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
              <div>
                <h3 className="font-serif italic text-white text-base font-bold truncate max-w-xs">
                  {campaignTitle}
                </h3>
                <p className="text-3xs font-mono text-slate-400">
                  {partyTitle}
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xs font-mono text-slate-400 flex items-center gap-1 justify-end">
                  <Compass className="w-3 h-3 text-amber-400" />
                  {currentRegion}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center font-mono text-2xs">
              <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                <div className="text-slate-400 flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  Locations
                </div>
                <div className="font-bold text-white text-sm mt-0.5">
                  {discoveredCount} / {locationsCount}
                </div>
              </div>

              <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                <div className="text-slate-400 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3 text-emerald-400" />
                  Party Heroes
                </div>
                <div className="font-bold text-white text-sm mt-0.5">
                  {charactersCount}
                </div>
              </div>

              <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                <div className="text-slate-400 flex items-center justify-center gap-1">
                  <ScrollText className="w-3 h-3 text-blue-400" />
                  Journal Notes
                </div>
                <div className="font-bold text-white text-sm mt-0.5">
                  {notesCount}
                </div>
              </div>

              <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                <div className="text-slate-400 flex items-center justify-center gap-1">
                  <Database className="w-3 h-3 text-purple-400" />
                  Pictures
                </div>
                <div className="font-bold text-white text-sm mt-0.5" title={`${embeddedImagesCount} uploaded files embedded inside JSON`}>
                  {allCampaignImages.length}
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: EXPORT */}
          {activeTab === "export" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white uppercase font-mono flex items-center gap-2">
                  <Download className="w-4 h-4 text-amber-400" />
                  Export Campaign Progress to JSON
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Downloads your current campaign state including all custom landmarks, pinned town taverns, battle maps, hero stats, Fog of War, and <strong className="text-amber-300">all {allCampaignImages.length} uploaded/linked pictures ({embeddedImagesCount} embedded)</strong> into a single <code className="text-amber-300 font-mono">.json</code> file—so importing restores every picture automatically without re-uploading.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {/* Primary Export Button */}
                <button
                  onClick={handleExportJson}
                  disabled={isExporting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-lg hover:shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isExporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Download Campaign Save (.json)</span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Copy JSON text button */}
                  <button
                    onClick={handleCopyToClipboard}
                    className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 rounded-lg text-xs font-mono font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    {copiedToClipboard ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy Save JSON to Clipboard</span>
                      </>
                    )}
                  </button>

                  {/* Direct Server URL Download fallback */}
                  <a
                    href="/api/campaign/export-data"
                    download
                    className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 rounded-lg text-xs font-mono font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer text-center"
                    title="Direct server-side download stream"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Direct Server File Stream</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === "import" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-mono flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-400" />
                    Restore Campaign from JSON
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                    Select your previously exported <code className="text-amber-300 font-mono">.json</code> save file to restore your entire campaign.
                  </p>
                </div>
              </div>

              {/* Sub-mode selector: File Upload vs Paste JSON */}
              <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 text-2xs font-mono w-fit">
                <button
                  type="button"
                  onClick={() => setImportMode("file")}
                  className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                    importMode === "file" ? "bg-amber-500 text-black font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Upload File (.json)
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("paste")}
                  className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                    importMode === "paste" ? "bg-amber-500 text-black font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Paste JSON Text
                </button>
              </div>

              {importMode === "file" ? (
                /* Drag & Drop File Zone */
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-3 ${
                    isDragging 
                      ? "border-amber-400 bg-amber-500/10 scale-[1.01]" 
                      : "border-white/20 hover:border-amber-500/50 bg-[#131622]/60 hover:bg-[#131622]"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json,application/json,text/plain"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    {isImporting ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white font-mono block">
                      Click to choose save file, or drag & drop here
                    </span>
                    <span className="text-2xs text-slate-400 font-mono mt-1 block">
                      Accepts .json campaign save files exported from this tool
                    </span>
                  </div>
                </div>
              ) : (
                /* Paste Raw JSON Text */
                <div className="space-y-3">
                  <textarea
                    rows={7}
                    value={pastedJson}
                    onChange={(e) => setPastedJson(e.target.value)}
                    placeholder="Paste the raw JSON content of your campaign save file here..."
                    className="w-full bg-[#131622] border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    disabled={!pastedJson.trim() || isImporting}
                    onClick={() => processImportPayload(pastedJson)}
                    className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-40"
                  >
                    {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>Load Pasted Campaign Save</span>
                  </button>
                </div>
              )}

              <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-lg text-2xs text-amber-300/80 font-mono">
                Note: Importing will replace your current session with the data from the imported save file. Make sure to export a backup if you wish to keep your current progress.
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#131622] border-t border-white/10 flex items-center justify-between text-2xs font-mono text-slate-500">
          <span>Campaign Save Data (.json)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
