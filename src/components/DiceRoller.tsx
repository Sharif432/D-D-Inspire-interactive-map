import { useState } from "react";
import { Character, DiceRollResult } from "../types";
import { Dices, Hash, Sparkles, Trophy, Swords } from "lucide-react";

interface DiceRollerProps {
  characters: Character[];
  selectedCharacterId: string;
  onSelectCharacter: (id: string) => void;
  recentRolls: DiceRollResult[];
  onAddRollResult: (roll: DiceRollResult) => Promise<void>;
  onOpenInitiative?: () => void;
}

export default function DiceRoller({
  characters,
  selectedCharacterId,
  onSelectCharacter,
  recentRolls,
  onAddRollResult,
  onOpenInitiative
}: DiceRollerProps) {
  const [selectedDiceType, setSelectedDiceType] = useState<number>(20); // d20, d12, d10, d8, d6, d4
  const [numberOfDice, setNumberOfDice] = useState<number>(1);
  const [customModifier, setCustomModifier] = useState<number>(0);
  const [selectedStat, setSelectedStat] = useState<string>("none");
  const [isRolling, setIsRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<DiceRollResult | null>(null);

  const selectedChar = characters.find((c) => c.id === selectedCharacterId) || characters[0];

  const getStatBonus = (char: Character, stat: string) => {
    if (stat === "none") return 0;
    const value = char.stats[stat as keyof typeof char.stats];
    // D&D Rule: (stat - 10) / 2 floored
    return Math.floor((value - 10) / 2);
  };

  const handleRoll = async () => {
    setIsRolling(true);
    
    // Simulate short roll delay for suspense
    setTimeout(async () => {
      const rolls: number[] = [];
      for (let i = 0; i < numberOfDice; i++) {
        rolls.push(Math.floor(Math.random() * selectedDiceType) + 1);
      }

      const statModifier = getStatBonus(selectedChar, selectedStat);
      const finalModifier = statModifier + customModifier;
      const total = rolls.reduce((sum, r) => sum + r, 0) + finalModifier;

      const newRoll: DiceRollResult = {
        id: "roll_" + Date.now(),
        characterId: selectedChar.id,
        characterName: selectedChar.name,
        diceNotation: `${numberOfDice}d${selectedDiceType}${finalModifier >= 0 ? "+" : ""}${finalModifier}`,
        rolls,
        modifier: finalModifier,
        statName: selectedStat !== "none" ? selectedStat : undefined,
        total,
        timestamp: new Date().toISOString()
      };

      setLastRoll(newRoll);
      setIsRolling(false);
      await onAddRollResult(newRoll);
    }, 450);
  };

  const currentBonus = getStatBonus(selectedChar, selectedStat) + customModifier;

  return (
    <div className="bg-[#0f1117] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col h-full font-sans">
      <div className="p-4 bg-[#14161e] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Dices className="w-4 h-4 text-amber-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500">Aethelgard Rolling Chamber</h2>
        </div>
        <div className="flex items-center space-x-2">
          {onOpenInitiative && (
            <button
              onClick={onOpenInitiative}
              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-3xs font-mono uppercase font-bold flex items-center gap-1 cursor-pointer transition-all"
              title="Open Initiative Order Combat Tracker"
            >
              <Swords className="w-3 h-3 text-amber-500" />
              <span>Initiative Order</span>
            </button>
          )}
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">Integrated Stats v5e</span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-5">
        <div className="space-y-4">
          {/* Character Selector */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1.5 font-bold">
              Select Roller
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => {
                    onSelectCharacter(char.id);
                    // Reset selected stat if it doesn't fit
                    setSelectedStat("none");
                  }}
                  className={`px-2.5 py-1.5 rounded text-xs font-mono transition-all text-left truncate cursor-pointer uppercase ${
                    selectedCharacterId === char.id
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/40 font-bold"
                      : "bg-[#13151c] text-slate-400 border border-white/5 hover:text-slate-200"
                  }`}
                >
                  {char.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Dice Selector Grid */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-2 font-bold">
              Dice Type
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[20, 12, 10, 8, 6, 4].map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDiceType(d)}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all border cursor-pointer ${
                    selectedDiceType === d
                      ? "bg-amber-500/15 border-amber-500 text-white font-bold"
                      : "bg-[#1a1c23] border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10"
                  }`}
                >
                  <span className="text-[10px] opacity-40 font-mono">D{d}</span>
                  <span className="text-sm font-serif italic mt-0.5">d{d}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity and Stat Injection Link */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1.5 font-bold">
                Count
              </label>
              <div className="flex items-center space-x-1.5">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    onClick={() => setNumberOfDice(num)}
                    className={`flex-1 py-1 rounded text-xs font-mono border cursor-pointer ${
                      numberOfDice === num
                        ? "bg-amber-500/10 border-amber-500/50 text-amber-500"
                        : "bg-[#1a1c23] border-white/5 text-slate-400"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1.5 font-bold">
                Stat Modifier
              </label>
              <select
                value={selectedStat}
                onChange={(e) => setSelectedStat(e.target.value)}
                className="w-full bg-[#1a1c23] border border-white/5 text-[11px] text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-amber-500 font-mono uppercase"
              >
                <option value="none">Flat Roll (+0)</option>
                <option value="dexterity">Initiative (DEX +{getStatBonus(selectedChar, "dexterity")})</option>
                <option value="strength">STR +{getStatBonus(selectedChar, "strength")}</option>
                <option value="dexterity">DEX +{getStatBonus(selectedChar, "dexterity")}</option>
                <option value="constitution">CON +{getStatBonus(selectedChar, "constitution")}</option>
                <option value="intelligence">INT +{getStatBonus(selectedChar, "intelligence")}</option>
                <option value="wisdom">WIS +{getStatBonus(selectedChar, "wisdom")}</option>
                <option value="charisma">CHA +{getStatBonus(selectedChar, "charisma")}</option>
              </select>
            </div>
          </div>

          {/* Custom Bonus slider or increment */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Additional Modifiers
              </label>
              <span className="text-[11px] font-mono text-amber-400">
                {customModifier >= 0 ? `+${customModifier}` : customModifier}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCustomModifier((m) => Math.max(-10, m - 1))}
                className="px-2 py-1 bg-[#1a1c23] text-slate-300 border border-white/5 rounded text-xs font-mono cursor-pointer"
              >
                -1
              </button>
              <input
                type="range"
                min="-10"
                max="15"
                value={customModifier}
                onChange={(e) => setCustomModifier(parseInt(e.target.value))}
                className="flex-1 accent-amber-500 h-1 bg-[#1a1c23] rounded-lg cursor-pointer"
              />
              <button
                onClick={() => setCustomModifier((m) => Math.min(15, m + 1))}
                className="px-2 py-1 bg-[#1a1c23] text-slate-300 border border-white/5 rounded text-xs font-mono cursor-pointer"
              >
                +1
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Preview and roll outcomes */}
        <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex items-center justify-between min-h-[90px] relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 block font-mono">
              Roll Blueprint
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-serif italic text-white font-bold">
                {numberOfDice}d{selectedDiceType}
              </span>
              {currentBonus !== 0 && (
                <span className="text-xs font-mono text-amber-400">
                  {currentBonus >= 0 ? `+${currentBonus}` : currentBonus}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 block font-sans">
              For <span className="text-slate-200">{selectedChar.name}</span>
            </span>
          </div>

          <div className="text-right z-10">
            {isRolling ? (
              <div className="flex flex-col items-end">
                <div className="relative">
                  <Dices className="w-10 h-10 text-amber-500 animate-spin" />
                  <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <span className="text-[10px] font-mono text-amber-400 mt-1 uppercase animate-pulse">Casting...</span>
              </div>
            ) : lastRoll ? (
              <div className="flex flex-col items-end">
                <span className="text-3s font-mono text-slate-500 uppercase">Outcome</span>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-serif italic text-amber-500 font-bold tracking-tighter">
                    {lastRoll.total}
                  </span>
                  {lastRoll.rolls.length > 1 && (
                    <div className="text-[10px] font-mono text-slate-400 bg-[#161822] border border-white/5 px-1.5 py-0.5 rounded">
                      ({lastRoll.rolls.join(" + ")})
                    </div>
                  )}
                </div>
                <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1 mt-0.5">
                  <Trophy className="w-3 h-3 text-emerald-400 shrink-0" />
                  {lastRoll.rolls.some(r => r === selectedDiceType) && "NATURAL MAX!"}
                  {lastRoll.rolls.some(r => r === 1) && "CRITICAL FUMBLE!"}
                  {!lastRoll.rolls.some(r => r === 1 || r === selectedDiceType) && "SUCCESSFUL TOSS"}
                </span>
              </div>
            ) : (
              <div className="text-right text-slate-500 max-w-[120px]">
                <span className="text-xs italic block font-serif">Awaiting the fates...</span>
              </div>
            )}
          </div>
        </div>

        {/* Main roll trigger */}
        <button
          onClick={handleRoll}
          disabled={isRolling}
          className="w-full py-3.5 bg-amber-500 text-black font-bold uppercase tracking-widest text-xs rounded hover:bg-amber-400 transition-colors cursor-pointer flex items-center justify-center space-x-2"
        >
          <Dices className="w-4 h-4" />
          <span>Cast Dice Matrix</span>
        </button>
      </div>
    </div>
  );
}
