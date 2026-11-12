import React, { useState, useRef } from "react";
import { 
  Download, 
  HardDrive, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Save, 
  Laptop, 
  FolderArchive, 
  RefreshCw, 
  ShieldCheck, 
  Apple, 
  Monitor, 
  Info,
  Play
} from "lucide-react";
import { CampaignState } from "../types";

interface StandaloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignState: CampaignState | null;
  onImportCampaign: (importedState: CampaignState) => void;
}

export default function StandaloneModal({
  isOpen,
  onClose,
  campaignState,
  onImportCampaign
}: StandaloneModalProps) {
  const [activeTab, setActiveTab] = useState<"download" | "instructions" | "saves">("download");
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Export current campaign state as JSON
  const handleExportJson = () => {
    if (!campaignState) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(campaignState, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `aethelgard-campaign-save-${timestamp}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON save file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.characters || !parsed.regions || !parsed.locations) {
        throw new Error("Invalid campaign save file format. Missing core campaign entities.");
      }

      // Send to server to persist
      const res = await fetch("/api/campaign/import-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to persist imported save.");
      }

      onImportCampaign(result.campaign);
      setImportStatus({
        type: "success",
        message: `Successfully loaded campaign save! (${result.campaign.locations.length} locations, ${result.campaign.characters.length} heroes)`
      });
    } catch (err: any) {
      console.error("Import error:", err);
      setImportStatus({
        type: "error",
        message: err.message || "Failed to parse JSON file."
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0e1017] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="px-5 py-4 bg-[#131622] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif italic text-white flex items-center gap-2 font-bold">
                Run Aethelgard on Your Computer
              </h2>
              <p className="text-2xs font-mono text-slate-400">
                Offline Desktop Application • Automatic Local Progress Saves
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/10 bg-[#0b0d14] px-5 pt-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab("download")}
            className={`pb-2.5 px-4 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "download"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>1. Downloads (.EXE & .ZIP)</span>
          </button>

          <button
            onClick={() => setActiveTab("instructions")}
            className={`pb-2.5 px-4 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "instructions"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>2. How to Run (Step-by-Step)</span>
          </button>

          <button
            onClick={() => setActiveTab("saves")}
            className={`pb-2.5 px-4 font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "saves"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>3. Save Games (.json)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto font-sans text-slate-200">
          
          {/* TAB 1: DOWNLOADS */}
          {activeTab === "download" && (
            <div className="space-y-5">
              {/* Highlight Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-950/20 border border-amber-500/35 flex items-start space-x-3.5">
                <HardDrive className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-bold text-amber-300 font-mono uppercase tracking-wider block">
                    Zero Setup • Automatic Local State Persistence
                  </span>
                  <p className="text-slate-300 leading-relaxed text-xs">
                    Run completely on your computer without internet. When you drag tokens, create custom landmarks, mark slain bosses with red X, or roll dice, every change is instantly auto-saved to <code className="px-1.5 py-0.5 bg-black/50 border border-white/10 rounded font-mono text-amber-300">campaign-data.json</code> next to the app!
                  </p>
                </div>
              </div>

              {/* Download Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Standalone Windows .EXE */}
                <div className="p-4 rounded-xl bg-[#131622] border border-white/10 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        Windows 10/11 Executable
                      </span>
                      <span className="text-3xs font-mono text-slate-500">67.8 MB</span>
                    </div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-amber-400" />
                      Aethelgard-Campaign.exe
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Single binary with embedded Node runtime and local game server. Double-click to play instantly on any Windows PC.
                    </p>
                  </div>

                  <a
                    href="/api/download/standalone-exe"
                    download="Aethelgard-Campaign.exe"
                    className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-lg hover:shadow-amber-500/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download .EXE</span>
                  </a>
                </div>

                {/* 2. Complete Portable ZIP Bundle */}
                <div className="p-4 rounded-xl bg-[#131622] border border-white/10 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                        Recommended Complete Bundle
                      </span>
                      <span className="text-3xs font-mono text-slate-500">27.0 MB (ZIP)</span>
                    </div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <FolderArchive className="w-4 h-4 text-blue-400" />
                      Aethelgard-Standalone-Windows.zip
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Contains <code className="text-slate-300 font-mono">Aethelgard-Campaign.exe</code>, 1-click batch launcher <code className="text-slate-300 font-mono">Start-Aethelgard.bat</code>, initial save file, and offline guide.
                    </p>
                  </div>

                  <a
                    href="/api/download/standalone-zip"
                    download="Aethelgard-Standalone-Windows.zip"
                    className="w-full py-2.5 px-4 rounded-lg bg-[#1a1e2d] hover:bg-[#24293e] border border-white/20 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-blue-400" />
                    <span>Download .ZIP Bundle</span>
                  </a>
                </div>
              </div>

              {/* Mac & Linux Section */}
              <div className="p-4 rounded-xl bg-[#131622] border border-white/10 flex items-start space-x-3.5">
                <Apple className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-bold text-slate-200 font-mono uppercase tracking-wider block">
                    macOS & Linux Instructions
                  </span>
                  <p className="text-slate-400 leading-relaxed text-xs">
                    You can run Aethelgard on Mac or Linux with Node.js installed. Extract the ZIP and run <code className="px-1.5 py-0.5 bg-black/40 border border-white/10 rounded font-mono text-amber-300">node dist/standalone-bundle.cjs</code>. It will open in your browser immediately.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STEP-BY-STEP INSTRUCTIONS */}
          {activeTab === "instructions" && (
            <div className="space-y-4">
              <h3 className="text-sm font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-2">
                <Info className="w-4 h-4" />
                How to Run Aethelgard on Your Computer
              </h3>

              <div className="space-y-3">
                {/* Step 1 */}
                <div className="p-3.5 rounded-xl bg-[#131622] border border-white/10 flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-black font-bold font-mono text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-mono">Download the Files</h4>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      Download either <code className="text-amber-300 font-mono">Aethelgard-Campaign.exe</code> or the complete package <code className="text-amber-300 font-mono">Aethelgard-Standalone-Windows.zip</code> from the Downloads tab.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 rounded-xl bg-[#131622] border border-white/10 flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-black font-bold font-mono text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-mono">Extract to a Folder</h4>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      If you downloaded the ZIP, right-click and choose <strong>"Extract All..."</strong> to any folder (such as your Desktop or Documents).
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 rounded-xl bg-[#131622] border border-white/10 flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-black font-bold font-mono text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-mono">Double-Click to Launch</h4>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      Double-click <code className="text-amber-300 font-mono">Start-Aethelgard.bat</code> or <code className="text-amber-300 font-mono">Aethelgard-Campaign.exe</code>. A console window will appear and your default web browser (Chrome, Edge, Firefox) will automatically open to <code className="text-slate-300 font-mono">http://localhost:3000</code>.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-3.5 rounded-xl bg-[#131622] border border-white/10 flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-black font-bold font-mono text-xs flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-mono">Automatic Local Saves</h4>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      As you play, every change (tokens moved, boss marked slain with red X, hidden locations revealed, battle map chambers edited, notes written) is automatically saved to <code className="text-amber-300 font-mono">campaign-data.json</code> in the same folder.
                    </p>
                  </div>
                </div>
              </div>

              {/* Windows SmartScreen Notice */}
              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs space-y-1">
                <span className="font-bold text-blue-300 font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Windows Protected Your PC (SmartScreen) Notice:
                </span>
                <p className="text-slate-300 leading-relaxed text-2xs">
                  Because this is an independent portable tabletop tool without an enterprise certificate, Windows SmartScreen may show a blue prompt. Simply click <strong>"More info"</strong> and then <strong>"Run anyway"</strong>. It is 100% offline and safe.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: SAVE GAME MANAGER */}
          {activeTab === "saves" && (
            <div className="space-y-4">
              <h3 className="text-sm font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-2">
                <Save className="w-4 h-4" />
                Campaign Save State Manager (.json)
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed">
                You can transfer your campaign between this web app and your offline computer anytime! Export your progress here, or import a save file from your standalone session.
              </p>

              {importStatus && (
                <div className={`p-3 rounded-lg border text-xs flex items-center space-x-2 ${
                  importStatus.type === "success" 
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300" 
                    : "bg-red-950/40 border-red-500/30 text-red-300"
                }`}>
                  {importStatus.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Export */}
                <div className="p-4 rounded-xl bg-[#131622] border border-white/10 space-y-2">
                  <h4 className="text-xs font-bold text-white font-mono uppercase">Export Save File</h4>
                  <p className="text-2xs text-slate-400">
                    Download the entire campaign state as a <code className="text-amber-300 font-mono">.json</code> backup file.
                  </p>
                  <button
                    onClick={handleExportJson}
                    className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Campaign Save (.json)</span>
                  </button>
                </div>

                {/* Import */}
                <div className="p-4 rounded-xl bg-[#131622] border border-white/10 space-y-2">
                  <h4 className="text-xs font-bold text-white font-mono uppercase">Import Save File</h4>
                  <p className="text-2xs text-slate-400">
                    Upload an existing <code className="text-amber-300 font-mono">campaign-data.json</code> file to restore your progress.
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/20 text-slate-200 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                  >
                    {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>Load Save File (.json)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#131622] border-t border-white/10 flex items-center justify-between text-2xs font-mono text-slate-500">
          <span>Aethelgard Portable Tabletop Console • Offline Ready</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
