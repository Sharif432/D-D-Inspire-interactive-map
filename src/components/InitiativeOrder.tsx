import React, { useState, useEffect } from "react";
import { Character, InitiativeCombatant, DiceRollResult } from "../types";
import { 
  Swords, 
  ArrowDown10, 
  RotateCcw, 
  SkipForward, 
  UserPlus, 
  Users, 
  Trash2, 
  Dices, 
  ShieldAlert, 
  Heart, 
  Check, 
  Flame, 
  Sparkles,
  ArrowUpDown,
  Plus,
  Minus,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface InitiativeOrderProps {
  characters: Character[];
  selectedCharacterId: string;
  onSelectCharacter: (id: string) => void;
  onAddRollResult: (roll: DiceRollResult) => Promise<void>;
  savedInitiativeOrder?: InitiativeCombatant[];
  savedRound?: number;
  savedTurnIndex?: number;
  onSaveInitiative?: (order: InitiativeCombatant[], round: number, turnIndex: number) => void;
  isDmMode?: boolean;
}

export default function InitiativeOrder({
  characters,
  selectedCharacterId,
  onSelectCharacter,
  onAddRollResult,
  savedInitiativeOrder,
  savedRound,
  savedTurnIndex,
  onSaveInitiative,
  isDmMode = true
}: InitiativeOrderProps) {
  // Combatants list in initiative
  const [combatants, setCombatants] = useState<InitiativeCombatant[]>(() => {
    if (savedInitiativeOrder && savedInitiativeOrder.length > 0) {
      return savedInitiativeOrder;
    }
    // Check localStorage
    try {
      const stored = localStorage.getItem("aethelgard_initiative");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Could not read local initiative cache", e);
    }
    return [];
  });

  // Combat Turn and Round tracking
  const [round, setRound] = useState<number>(savedRound || 1);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(savedTurnIndex || 0);

  // Auto-sort mode toggle (when enabled, editing a score automatically keeps list sorted)
  const [autoSortEnabled, setAutoSortEnabled] = useState<boolean>(true);
  const [justSorted, setJustSorted] = useState<boolean>(false);

  // Custom combatant (monster / adversary) drawer
  const [isAddingCustom, setIsAddingCustom] = useState<boolean>(false);
  const [customName, setCustomName] = useState("");
  const [customScore, setCustomScore] = useState<number>(12);
  const [customHp, setCustomHp] = useState<number>(20);
  const [customDex, setCustomDex] = useState<number>(0);
  const [customIsHpHidden, setCustomIsHpHidden] = useState<boolean>(true);

  // Quick Party selector drawer
  const [isPartyPickerOpen, setIsPartyPickerOpen] = useState<boolean>(false);

  // Inline confirmation state for Clear All (replaces disallowed window.confirm)
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  // Sync incoming server/WebSocket initiative updates when another browser updates encounter state
  useEffect(() => {
    if (savedInitiativeOrder !== undefined) {
      setCombatants(savedInitiativeOrder);
      try {
        localStorage.setItem("aethelgard_initiative", JSON.stringify(savedInitiativeOrder));
      } catch {
        // ignore
      }
      if (savedInitiativeOrder.length === 0) {
        setConfirmClearAll(false);
      }
    }
  }, [savedInitiativeOrder]);

  useEffect(() => {
    if (typeof savedRound === "number") {
      setRound(savedRound);
    }
  }, [savedRound]);

  useEffect(() => {
    if (typeof savedTurnIndex === "number") {
      setCurrentTurnIndex(savedTurnIndex);
    }
  }, [savedTurnIndex]);

  // Calculate DEX modifier helper
  const getDexModifier = (char: Character): number => {
    const dex = char.stats?.dexterity ?? 10;
    return Math.floor((dex - 10) / 2);
  };

  // Sync state upward when combatants, round, or turn change
  const syncInitiative = (newCombatants: InitiativeCombatant[], newRound: number, newTurn: number) => {
    try {
      localStorage.setItem("aethelgard_initiative", JSON.stringify(newCombatants));
    } catch (e) {
      // ignore
    }
    if (onSaveInitiative) {
      onSaveInitiative(newCombatants, newRound, newTurn);
    }
  };

  // Core Sorting function: Descending initiative score (Tie-breaking by DEX mod, then name)
  const sortCombatantsDescending = (list: InitiativeCombatant[]): InitiativeCombatant[] => {
    return [...list].sort((a, b) => {
      // 1. Primary: Initiative score descending
      if (b.initiativeScore !== a.initiativeScore) {
        return b.initiativeScore - a.initiativeScore;
      }
      // 2. Secondary: Higher DEX modifier wins tie
      if (b.dexModifier !== a.dexModifier) {
        return b.dexModifier - a.dexModifier;
      }
      // 3. Tertiary: Alphabetical
      return a.name.localeCompare(b.name);
    });
  };

  // Manual Trigger: Auto-Sort button
  const handleSortDescending = () => {
    const sorted = sortCombatantsDescending(combatants);
    setCombatants(sorted);
    setJustSorted(true);
    setTimeout(() => setJustSorted(false), 1200);
    syncInitiative(sorted, round, currentTurnIndex);
  };

  // Add a specific party character to the initiative
  const handleAddPartyCharacter = (char: Character) => {
    // Prevent duplicate if already added
    if (combatants.some(c => c.characterId === char.id)) {
      return;
    }

    const dexMod = getDexModifier(char);
    // Default initial manual score: 10 + dex modifier
    const defaultScore = 10 + dexMod;

    const newCombatant: InitiativeCombatant = {
      id: "init_" + char.id + "_" + Date.now(),
      characterId: char.id,
      name: char.name,
      race: char.race,
      className: char.className,
      avatarUrl: char.avatarUrl,
      initiativeScore: defaultScore,
      dexModifier: dexMod,
      hp: char.hp ? { current: char.hp.current, max: char.hp.max } : undefined,
      isHpHidden: char.isHpHidden,
      isCustom: false
    };

    let updated = [...combatants, newCombatant];
    if (autoSortEnabled) {
      updated = sortCombatantsDescending(updated);
    }
    setCombatants(updated);
    syncInitiative(updated, round, currentTurnIndex);
  };

  // "Add All Party Members" at once
  const handleAddAllParty = () => {
    const existingCharIds = new Set(combatants.map(c => c.characterId).filter(Boolean));
    const newItems: InitiativeCombatant[] = [];

    characters.forEach(char => {
      // Skip DM storyteller entity unless specifically wanted, or include all adventurers
      if (char.id === "dm" && characters.length > 1) return;
      if (!existingCharIds.has(char.id)) {
        const dexMod = getDexModifier(char);
        newItems.push({
          id: "init_" + char.id + "_" + Date.now(),
          characterId: char.id,
          name: char.name,
          race: char.race,
          className: char.className,
          avatarUrl: char.avatarUrl,
          initiativeScore: 10 + dexMod,
          dexModifier: dexMod,
          hp: char.hp ? { current: char.hp.current, max: char.hp.max } : undefined,
          isHpHidden: char.isHpHidden,
          isCustom: false
        });
      }
    });

    let updated = [...combatants, ...newItems];
    if (autoSortEnabled) {
      updated = sortCombatantsDescending(updated);
    }
    setCombatants(updated);
    setIsPartyPickerOpen(false);
    syncInitiative(updated, round, currentTurnIndex);
  };

  // Add custom enemy/monster
  const handleAddCustomCombatant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const newCombatant: InitiativeCombatant = {
      id: "custom_" + Date.now(),
      name: customName.trim(),
      className: "Adversary",
      initiativeScore: Number(customScore) || 10,
      dexModifier: Number(customDex) || 0,
      hp: { current: Number(customHp) || 20, max: Number(customHp) || 20 },
      isHpHidden: customIsHpHidden,
      isCustom: true
    };

    let updated = [...combatants, newCombatant];
    if (autoSortEnabled) {
      updated = sortCombatantsDescending(updated);
    }
    setCombatants(updated);
    setCustomName("");
    setCustomScore(12);
    setCustomHp(20);
    setCustomDex(0);
    setCustomIsHpHidden(true);
    setIsAddingCustom(false);
    syncInitiative(updated, round, currentTurnIndex);
  };

  // Manual Initiative Score Update for a combatant
  const handleScoreChange = (id: string, newScore: number) => {
    const val = isNaN(newScore) ? 0 : newScore;
    const updated = combatants.map(c => {
      if (c.id === id) {
        return { ...c, initiativeScore: val };
      }
      return c;
    });

    if (autoSortEnabled) {
      const sorted = sortCombatantsDescending(updated);
      setCombatants(sorted);
      syncInitiative(sorted, round, currentTurnIndex);
    } else {
      setCombatants(updated);
      syncInitiative(updated, round, currentTurnIndex);
    }
  };

  // Adjust score by delta (+1 / -1)
  const handleScoreDelta = (id: string, delta: number) => {
    const combatant = combatants.find(c => c.id === id);
    if (!combatant) return;
    handleScoreChange(id, combatant.initiativeScore + delta);
  };

  // Roll Initiative (d20 + DEX modifier) directly for a combatant
  const handleRollInitiativeForCombatant = async (combatant: InitiativeCombatant) => {
    const d20Roll = Math.floor(Math.random() * 20) + 1;
    const finalScore = d20Roll + combatant.dexModifier;

    // Log the roll into recent rolls chronicle
    const rollLog: DiceRollResult = {
      id: "roll_init_" + Date.now(),
      characterId: combatant.characterId,
      characterName: combatant.name,
      diceNotation: `1d20${combatant.dexModifier >= 0 ? "+" : ""}${combatant.dexModifier} (Initiative)`,
      rolls: [d20Roll],
      modifier: combatant.dexModifier,
      statName: "Initiative (DEX)",
      total: finalScore,
      timestamp: new Date().toISOString()
    };
    await onAddRollResult(rollLog);

    // Update their score
    handleScoreChange(combatant.id, finalScore);
  };

  // Remove single combatant
  const handleRemoveCombatant = (id: string) => {
    const updated = combatants.filter(c => c.id !== id);
    let nextTurn = currentTurnIndex;
    if (nextTurn >= updated.length && updated.length > 0) {
      nextTurn = 0;
    }
    setCombatants(updated);
    setCurrentTurnIndex(nextTurn);
    syncInitiative(updated, round, nextTurn);
  };

  // Clear entire encounter (confirmed via inline toolbar controls)
  const handleClearAll = () => {
    if (combatants.length === 0) return;
    setCombatants([]);
    setRound(1);
    setCurrentTurnIndex(0);
    setConfirmClearAll(false);
    syncInitiative([], 1, 0);
  };

  // Advance turn
  const handleNextTurn = () => {
    if (combatants.length === 0) return;
    if (currentTurnIndex + 1 >= combatants.length) {
      // Loop back to start, advance round!
      setCurrentTurnIndex(0);
      const nextRound = round + 1;
      setRound(nextRound);
      syncInitiative(combatants, nextRound, 0);
    } else {
      const nextTurn = currentTurnIndex + 1;
      setCurrentTurnIndex(nextTurn);
      syncInitiative(combatants, round, nextTurn);
    }
  };

  // Previous turn
  const handlePrevTurn = () => {
    if (combatants.length === 0) return;
    if (currentTurnIndex <= 0) {
      if (round > 1) {
        const prevRound = round - 1;
        const lastIdx = combatants.length - 1;
        setRound(prevRound);
        setCurrentTurnIndex(lastIdx);
        syncInitiative(combatants, prevRound, lastIdx);
      }
    } else {
      const prevTurn = currentTurnIndex - 1;
      setCurrentTurnIndex(prevTurn);
      syncInitiative(combatants, round, prevTurn);
    }
  };

  // Reset turns to Round 1, Turn 0
  const handleResetTurns = () => {
    setRound(1);
    setCurrentTurnIndex(0);
    syncInitiative(combatants, 1, 0);
  };

  // HP Adjuster
  const handleHpChange = (id: string, delta: number) => {
    const target = combatants.find((c) => c.id === id);
    const linked = target?.characterId ? characters.find((ch) => ch.id === target.characterId) : undefined;
    const isHidden = target?.isHpHidden ?? linked?.isHpHidden ?? false;
    if (!isDmMode && isHidden) return;

    const updated = combatants.map(c => {
      if (c.id === id && c.hp) {
        const nextHp = Math.max(0, Math.min(c.hp.max, c.hp.current + delta));
        return {
          ...c,
          hp: { ...c.hp, current: nextHp }
        };
      }
      return c;
    });
    setCombatants(updated);
    syncInitiative(updated, round, currentTurnIndex);
  };

  // DM Individual HP Hide/Show toggle
  const handleToggleCombatantHpHidden = (id: string) => {
    if (!isDmMode) return;
    const updated = combatants.map((c) => {
      if (c.id !== id) return c;
      const linked = c.characterId ? characters.find((ch) => ch.id === c.characterId) : undefined;
      const currentHidden = c.isHpHidden ?? linked?.isHpHidden ?? false;
      return { ...c, isHpHidden: !currentHidden };
    });
    setCombatants(updated);
    syncInitiative(updated, round, currentTurnIndex);
  };

  // Check if character is already added
  const isCharacterAdded = (charId: string) => {
    return combatants.some(c => c.characterId === charId);
  };

  return (
    <div className="bg-[#0f1117] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col h-full font-sans">
      
      {/* Top Banner Toolbar */}
      <div className="p-4 bg-[#14161e] border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500">
            <Swords className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500 font-mono">
                Initiative Order
              </h2>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
                {combatants.length} Combatant{combatants.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Encounter Turn Management & Combat Tracking
            </p>
          </div>
        </div>

        {/* Turn Progression Controls */}
        <div className="flex items-center space-x-2 bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
          <div className="flex items-center space-x-1.5 pr-2 border-r border-white/10">
            <span className="text-[9px] font-mono uppercase text-slate-400">Round</span>
            <span className="text-xs font-serif font-bold italic text-amber-400 px-1 bg-amber-500/10 rounded border border-amber-500/20">
              {round}
            </span>
          </div>

          <button
            onClick={handlePrevTurn}
            disabled={combatants.length === 0 || (round === 1 && currentTurnIndex === 0)}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded cursor-pointer transition-colors"
            title="Previous Combatant Turn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleNextTurn}
            disabled={combatants.length === 0}
            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded text-[10px] font-mono font-bold uppercase flex items-center space-x-1 cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Advance to Next Turn"
          >
            <span>Next Turn</span>
            <SkipForward className="w-3 h-3 text-amber-400" />
          </button>

          <button
            onClick={handleResetTurns}
            className="p-1 text-slate-500 hover:text-slate-300 rounded cursor-pointer text-[10px] font-mono"
            title="Reset Round Counter"
          >
            Rst
          </button>
        </div>
      </div>

      {/* Action Commands Toolbar (Add Party, Custom, Auto-Sort) */}
      <div className="p-3 bg-[#11131b] border-b border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
        
        {/* Left: Adding Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Party member dropdown/picker trigger */}
          <button
            onClick={() => setIsPartyPickerOpen(!isPartyPickerOpen)}
            className={`px-2.5 py-1.5 rounded text-2xs uppercase font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              isPartyPickerOpen
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-[#181a24] text-slate-300 border-white/10 hover:border-amber-500/40 hover:text-white"
            }`}
          >
            <Users className="w-3 h-3 text-amber-500" />
            <span>Add from Party</span>
          </button>

          {/* Quick 1-click Add All Party */}
          <button
            onClick={handleAddAllParty}
            className="px-2.5 py-1.5 bg-[#181a24] hover:bg-amber-500/10 text-slate-300 hover:text-amber-400 border border-white/10 hover:border-amber-500/30 rounded text-2xs uppercase font-mono transition-all flex items-center gap-1 cursor-pointer"
            title="Add all active characters from the party list"
          >
            <UserPlus className="w-3 h-3 text-amber-500" />
            <span>Add All Party</span>
          </button>

          {/* Add custom monster/enemy */}
          <button
            onClick={() => setIsAddingCustom(!isAddingCustom)}
            className={`px-2.5 py-1.5 rounded text-2xs uppercase font-mono transition-all flex items-center gap-1 cursor-pointer border ${
              isAddingCustom
                ? "bg-red-950/60 text-red-300 border-red-500/50"
                : "bg-[#181a24] text-slate-400 border-white/10 hover:text-slate-200"
            }`}
          >
            <ShieldAlert className="w-3 h-3 text-red-400" />
            <span>+ Enemy / NPC</span>
          </button>
        </div>

        {/* Right: Auto-Sort Features */}
        <div className="flex items-center space-x-2">
          {/* Auto-sort on edit toggle */}
          <label className="flex items-center space-x-1.5 text-3xs font-mono text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSortEnabled}
              onChange={(e) => setAutoSortEnabled(e.target.checked)}
              className="rounded bg-[#1a1c25] border-white/10 text-amber-500 focus:ring-0 w-3 h-3"
            />
            <span>Auto-sort on edit</span>
          </label>

          {/* Prominent Auto-Sort Descending Button */}
          <button
            onClick={handleSortDescending}
            disabled={combatants.length < 2}
            className={`px-3 py-1.5 rounded font-mono font-bold uppercase text-2xs flex items-center space-x-1.5 transition-all cursor-pointer border ${
              justSorted
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 scale-105"
                : "bg-amber-500 hover:bg-amber-400 text-black border-amber-400 shadow-md"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title="Sort combatants by descending initiative score (highest first)"
          >
            <ArrowDown10 className="w-3.5 h-3.5" />
            <span>{justSorted ? "Sorted! (High → Low)" : "Auto-Sort Descending"}</span>
          </button>

          {combatants.length > 0 && (
            confirmClearAll ? (
              <div className="flex items-center space-x-1 bg-red-950/60 border border-red-500/40 rounded px-1.5 py-0.5">
                <button
                  onClick={handleClearAll}
                  className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-3xs font-mono font-bold uppercase cursor-pointer transition-colors"
                  title="Confirm clearing all combatants"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setConfirmClearAll(false)}
                  className="px-1.5 py-0.5 text-slate-300 hover:text-white text-3xs font-mono uppercase cursor-pointer"
                  title="Cancel"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClearAll(true)}
                className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-red-950/20 transition-all cursor-pointer"
                title="Clear entire encounter"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      {/* PARTY PICKER EXPANDABLE DRAWER */}
      <AnimatePresence>
        {isPartyPickerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-[#13151f] border-b border-white/10 p-3 space-y-2.5 font-mono text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
                Select Character from Party Alliance:
              </span>
              <button
                onClick={() => setIsPartyPickerOpen(false)}
                className="text-[10px] text-slate-500 hover:text-white"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {characters.map(char => {
                const added = isCharacterAdded(char.id);
                const dexMod = getDexModifier(char);

                return (
                  <div
                    key={char.id}
                    className={`p-2 rounded-lg border flex items-center justify-between transition-all ${
                      added
                        ? "bg-[#181a24]/60 border-white/5 opacity-60"
                        : "bg-[#181a24] border-white/10 hover:border-amber-500/40"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-800 shrink-0 border border-white/10 flex items-center justify-center font-bold text-amber-400 text-xs">
                        {char.avatarUrl ? (
                          <img src={char.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          char.name[0]
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          {char.name}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">
                          {char.className} • <span className="text-amber-400">{dexMod >= 0 ? `+${dexMod}` : dexMod} DEX</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddPartyCharacter(char)}
                      disabled={added}
                      className={`ml-2 px-2 py-1 rounded text-3xs font-mono uppercase font-bold transition-all shrink-0 ${
                        added
                          ? "bg-white/5 text-slate-500 cursor-default"
                          : "bg-amber-500 hover:bg-amber-400 text-black cursor-pointer"
                      }`}
                    >
                      {added ? "Added ✓" : "+ Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CUSTOM ADVERSARY / ENEMY CREATOR DRAWER */}
      <AnimatePresence>
        {isAddingCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-[#181416] border-b border-red-900/30 p-3 space-y-2.5 font-mono text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Add Encounter Monster or NPC:
              </span>
              <button
                onClick={() => setIsAddingCustom(false)}
                className="text-[10px] text-slate-500 hover:text-white"
              >
                Cancel ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomCombatant} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <div className="sm:col-span-2">
                <label className="block text-4xs uppercase text-slate-400 mb-0.5">Creature Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bugbear Chief, Goblin"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-[#10121a] border border-white/10 text-slate-200 px-2 py-1.5 rounded text-xs focus:outline-none focus:border-red-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-4xs uppercase text-slate-400 mb-0.5">Initiative Score</label>
                <input
                  type="number"
                  value={customScore}
                  onChange={(e) => setCustomScore(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#10121a] border border-white/10 text-amber-400 px-2 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-4xs uppercase text-slate-400 mb-0.5">Hit Points</label>
                <input
                  type="number"
                  value={customHp}
                  onChange={(e) => setCustomHp(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#10121a] border border-white/10 text-red-400 px-2 py-1.5 rounded text-xs focus:outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white font-mono font-bold uppercase text-2xs rounded cursor-pointer transition-colors"
                >
                  Spawn to Turn
                </button>
              </div>

              {isDmMode && (
                <label className="sm:col-span-5 flex items-center gap-2 text-[10px] font-mono text-amber-300 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={customIsHpHidden}
                    onChange={(e) => setCustomIsHpHidden(e.target.checked)}
                    className="rounded bg-[#10121a] border-white/20 text-amber-500 focus:ring-0"
                  />
                  <EyeOff className="w-3 h-3 text-amber-400" />
                  <span>Hide Health Points (HP) from Players (DM Only)</span>
                </label>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMBATANTS INITIATIVE ROSTER */}
      <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
        {combatants.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white/2 border border-white/5 rounded-xl flex flex-col items-center justify-center space-y-4">
            <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Swords className="w-8 h-8 opacity-80" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
                No Combatants In Initiative
              </h3>
              <p className="text-xs text-slate-500 font-editorial">
                Add party members or monsters to assign manual initiative scores and auto-sort the combat order.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={handleAddAllParty}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold uppercase text-xs rounded transition-all flex items-center space-x-1.5 cursor-pointer shadow-lg"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Add All Party Members</span>
              </button>

              <button
                onClick={() => setIsPartyPickerOpen(true)}
                className="px-3 py-2 bg-[#1a1c25] hover:bg-white/10 text-slate-200 border border-white/10 font-mono text-xs rounded transition-all cursor-pointer"
              >
                Pick Individual Hero
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {combatants.map((combatant, index) => {
              const isCurrentTurn = index === currentTurnIndex;
              const isOnDeck = (currentTurnIndex + 1) % combatants.length === index && combatants.length > 1;
              const isSelectedForRoll = combatant.characterId === selectedCharacterId;
              
              // Tie indicator: does any other combatant share this exact score?
              const isTied = combatants.filter(c => c.initiativeScore === combatant.initiativeScore).length > 1;

              return (
                <motion.div
                  key={combatant.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`relative p-3 rounded-xl border transition-all ${
                    isCurrentTurn
                      ? "bg-[#181a25] border-amber-500 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/5"
                      : isOnDeck
                      ? "bg-[#13151e] border-slate-700/80"
                      : "bg-[#10121a]/90 border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    
                    {/* Left: Position Rank & Character Info */}
                    <div className="flex items-center space-x-3 min-w-0">
                      
                      {/* Numeric Order Badge (1st, 2nd, 3rd...) */}
                      <div className="flex flex-col items-center justify-center w-7 h-7 rounded-lg bg-black/40 border border-white/10 shrink-0 font-mono">
                        <span className={`text-xs font-bold ${isCurrentTurn ? "text-amber-400" : "text-slate-400"}`}>
                          #{index + 1}
                        </span>
                      </div>

                      {/* Avatar */}
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 shrink-0 border border-white/10 flex items-center justify-center font-serif text-sm font-bold text-amber-500">
                          {combatant.avatarUrl ? (
                            <img src={combatant.avatarUrl} alt={combatant.name} className="w-full h-full object-cover" />
                          ) : (
                            combatant.name[0]
                          )}
                        </div>
                        {isCurrentTurn && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-ping" />
                        )}
                      </div>

                      {/* Name & Details */}
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span 
                            onClick={() => {
                              if (combatant.characterId) {
                                onSelectCharacter(combatant.characterId);
                              }
                            }}
                            className={`font-serif italic font-semibold text-base truncate transition-colors ${
                              combatant.characterId ? "cursor-pointer hover:text-amber-400" : ""
                            } ${isCurrentTurn ? "text-amber-300" : "text-white"}`}
                            title={combatant.characterId ? "Click to select in Dice Roller" : ""}
                          >
                            {combatant.name}
                          </span>

                          {/* Turn state badges */}
                          {isCurrentTurn && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-3xs font-mono font-bold uppercase tracking-wider animate-pulse shrink-0">
                              ACTIVE TURN
                            </span>
                          )}
                          {isOnDeck && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-4xs font-mono uppercase shrink-0">
                              ON DECK
                            </span>
                          )}
                          {combatant.isCustom && (
                            <span className="px-1.5 py-0.5 rounded bg-red-950/60 border border-red-500/30 text-red-400 text-4xs font-mono uppercase shrink-0">
                              Adversary
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>{combatant.className || "Adventurer"}</span>
                          <span>•</span>
                          <span>DEX {combatant.dexModifier >= 0 ? `+${combatant.dexModifier}` : combatant.dexModifier}</span>
                          {isTied && (
                            <span className="text-amber-500/80 bg-amber-500/10 px-1 rounded text-4xs" title="Tied score, sorted by DEX modifier">
                              Tied
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Manual Initiative Score Editor & Action buttons */}
                    <div className="flex items-center space-x-3 ml-auto">
                      
                      {/* HP Tracker mini-bar with DM individual Show/Hide toggle */}
                      {combatant.hp && (() => {
                        const linkedChar = combatant.characterId
                          ? characters.find((ch) => ch.id === combatant.characterId)
                          : undefined;
                        const isHidden = combatant.isHpHidden ?? linkedChar?.isHpHidden ?? false;
                        const canViewHp = isDmMode || !isHidden;

                        return (
                          <div className="flex flex-col items-end pr-2 border-r border-white/5 space-y-1">
                            <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400">
                              <Heart className="w-2.5 h-2.5 text-red-400" />
                              {canViewHp ? (
                                <span className="font-bold text-slate-200">
                                  {combatant.hp.current}/{combatant.hp.max}
                                </span>
                              ) : (
                                <span className="text-amber-400/90 font-bold flex items-center gap-1">
                                  <EyeOff className="w-2.5 h-2.5" />
                                  Hidden
                                </span>
                              )}

                              {isDmMode && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleCombatantHpHidden(combatant.id)}
                                  className={`px-1 py-0.5 rounded border text-[8px] uppercase inline-flex items-center gap-0.5 cursor-pointer transition-all ${
                                    isHidden
                                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold"
                                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                                  }`}
                                  title={isHidden ? "HP hidden from players — click to show" : "HP visible to players — click to hide"}
                                >
                                  {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                                </button>
                              )}
                            </div>

                            {canViewHp && (
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleHpChange(combatant.id, -5)}
                                  className="px-1 py-0.5 bg-[#1a1c25] hover:bg-red-950 text-slate-400 hover:text-red-300 rounded text-[9px] font-mono cursor-pointer border border-white/5"
                                  title="-5 HP (Damage)"
                                >
                                  -5
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleHpChange(combatant.id, -1)}
                                  className="px-1.5 py-0.5 bg-[#1a1c25] hover:bg-red-950 text-slate-400 hover:text-red-300 rounded text-[9px] font-mono cursor-pointer border border-white/5"
                                  title="-1 HP"
                                >
                                  -1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleHpChange(combatant.id, 1)}
                                  className="px-1.5 py-0.5 bg-[#1a1c25] hover:bg-emerald-950 text-slate-400 hover:text-emerald-300 rounded text-[9px] font-mono cursor-pointer border border-white/5"
                                  title="+1 HP (Heal)"
                                >
                                  +1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleHpChange(combatant.id, 5)}
                                  className="px-1 py-0.5 bg-[#1a1c25] hover:bg-emerald-950 text-slate-400 hover:text-emerald-300 rounded text-[9px] font-mono cursor-pointer border border-white/5"
                                  title="+5 HP (Heal)"
                                >
                                  +5
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Quick Roll Initiative (d20+DEX) */}
                      <button
                        onClick={() => handleRollInitiativeForCombatant(combatant)}
                        className="px-2 py-1.5 bg-[#181a24] hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 border border-white/10 hover:border-amber-500/40 rounded text-3xs font-mono uppercase transition-all flex items-center space-x-1 cursor-pointer"
                        title="Roll 1d20 + DEX to set this combatant's initiative"
                      >
                        <Dices className="w-3 h-3 text-amber-500" />
                        <span className="hidden md:inline">Roll d20</span>
                      </button>

                      {/* MANUAL INITIATIVE SCORE ASSIGNMENT */}
                      <div className="flex items-center space-x-1 bg-black/40 p-1 rounded-lg border border-white/10">
                        <span className="text-[9px] font-mono uppercase text-slate-500 pl-1 hidden sm:inline">
                          INIT:
                        </span>
                        
                        <button
                          onClick={() => handleScoreDelta(combatant.id, -1)}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 cursor-pointer"
                          title="Decrease initiative score by 1"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <input
                          type="number"
                          value={combatant.initiativeScore}
                          onChange={(e) => handleScoreChange(combatant.id, parseInt(e.target.value))}
                          className="w-12 bg-[#161822] border border-white/10 text-center font-mono font-bold text-sm text-amber-400 rounded py-0.5 focus:outline-none focus:border-amber-500"
                          title="Enter manual initiative score"
                        />

                        <button
                          onClick={() => handleScoreDelta(combatant.id, 1)}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 cursor-pointer"
                          title="Increase initiative score by 1"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Remove from roster */}
                      <button
                        onClick={() => handleRemoveCombatant(combatant.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-red-950/20 transition-all cursor-pointer"
                        title="Remove combatant from initiative"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER BAR: SUMMARY & AUTO-SORT CONTEXT */}
      <div className="p-3 bg-[#14161e] border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
        <div className="flex items-center space-x-3">
          <span>Descending: Highest score acts first</span>
          <span>•</span>
          <span>Ties broken by higher DEX modifier</span>
        </div>

        <div className="flex items-center space-x-2">
          {combatants.length > 1 && (
            <button
              onClick={handleSortDescending}
              className="text-amber-500 hover:text-amber-400 underline cursor-pointer uppercase font-bold"
            >
              Re-sort list descending ↓
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
