import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const nodeWinPath = "/tmp/node-win-x64.exe";

console.log("=== Building Aethelgard Standalone Windows Executable (.exe) ===");

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 1. Bundle standalone server with esbuild
console.log("1. Bundling standalone-server.ts into standalone-bundle.cjs...");
execSync(
  `npx esbuild standalone-server.ts --bundle --platform=node --format=cjs --target=node20 --outfile=dist/standalone-bundle.cjs`,
  { stdio: "inherit" }
);

// 2. Prepare SEA config
console.log("2. Generating SEA preparation blob...");
const seaConfig = {
  main: "dist/standalone-bundle.cjs",
  output: "dist/sea-prep.blob",
  disableExperimentalSEAWarning: true
};
fs.writeFileSync("dist/sea-config.json", JSON.stringify(seaConfig, null, 2), "utf-8");

execSync(`node --experimental-sea-config dist/sea-config.json`, { stdio: "inherit" });

// 3. Ensure base node-win-x64.exe is available
if (!fs.existsSync(nodeWinPath)) {
  console.log("Downloading Windows Node binary for executable base...");
  execSync(`curl -Lo /tmp/node-win-x64.exe https://nodejs.org/dist/v20.18.0/win-x64/node.exe`, { stdio: "inherit" });
}

// 4. Copy to target exe
const targetExe = path.join(distDir, "Aethelgard-Campaign.exe");
console.log("3. Copying Windows binary to " + targetExe);
fs.copyFileSync(nodeWinPath, targetExe);

// 5. Inject SEA blob into the exe using postject
console.log("4. Injecting Single Executable Application blob with postject...");
execSync(
  `npx postject dist/Aethelgard-Campaign.exe NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
  { stdio: "inherit" }
);

// 6. Generate Batch launcher Start-Aethelgard.bat
const batContent = `@echo off
title Aethelgard Campaign Console
echo =======================================================
echo  Launching Aethelgard: D&D Campaign Console
echo  Game progress is saved directly in campaign-data.json
echo =======================================================
if exist Aethelgard-Campaign.exe (
  start "" Aethelgard-Campaign.exe
) else (
  echo Error: Aethelgard-Campaign.exe not found in this directory.
  pause
)
`;
fs.writeFileSync(path.join(distDir, "Start-Aethelgard.bat"), batContent, "utf-8");

// 7. Generate README.txt & HOW-TO-RUN.txt
const readmeContent = `===============================================================
 🏰 AETHELGARD: D&D CAMPAIGN ROOM CONSOLE - STANDALONE EDITION
===============================================================

HOW TO RUN ON WINDOWS:
1. Double-click "Start-Aethelgard.bat" (or "Aethelgard-Campaign.exe").
2. Your default web browser will automatically open to http://localhost:3000.
3. If Windows SmartScreen shows a prompt:
   Click "More info" -> "Run anyway" (this is your private offline server).
4. Enjoy your local tabletop campaign!

HOW TO RUN ON MACOS / LINUX:
1. Make sure Node.js is installed (https://nodejs.org).
2. Run "./run.sh" or "node dist/standalone-bundle.cjs".
3. Open http://localhost:3000 in your browser.

HOW PROGRESS & SAVING WORKS:
- All game progress is automatically saved to "campaign-data.json"
  in the same folder as the executable.
- Your custom locations, boss slain status, party tokens, map images,
  initiative order, character health, and journal notes are 100% saved locally!
- To back up your game, simply copy "campaign-data.json" or use the
  "Export Save File" button inside the app.

TROUBLESHOOTING:
- If port 3000 is occupied, set PORT=3001 in your terminal or launch options.
- The game runs 100% offline without needing internet access.

Happy adventuring in the Realms of Faerûn!
`;
fs.writeFileSync(path.join(distDir, "README.txt"), readmeContent, "utf-8");
fs.writeFileSync(path.join(distDir, "HOW-TO-RUN.txt"), readmeContent, "utf-8");

// Generate run.sh for Mac/Linux
const shContent = `#!/bin/bash
echo "======================================================="
echo " Launching Aethelgard: D&D Campaign Console (Offline)"
echo "======================================================="
if command -v node >/dev/null 2>&1; then
  node dist/standalone-bundle.cjs
else
  echo "Error: Node.js is required to run on Mac/Linux."
  echo "Please install Node.js from https://nodejs.org and re-run."
fi
`;
fs.writeFileSync(path.join(distDir, "run.sh"), shContent, { encoding: "utf-8", mode: 0o755 });

// 8. Bundle into complete standalone distribution ZIP
console.log("5. Creating Aethelgard-Standalone-Windows.zip with portable files...");
try {
  execSync(`python3 -c "
import zipfile, os
zip_path = 'dist/Aethelgard-Standalone-Windows.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    if os.path.exists('dist/Aethelgard-Campaign.exe'):
        z.write('dist/Aethelgard-Campaign.exe', 'Aethelgard-Campaign.exe')
    if os.path.exists('dist/Start-Aethelgard.bat'):
        z.write('dist/Start-Aethelgard.bat', 'Start-Aethelgard.bat')
    if os.path.exists('dist/run.sh'):
        z.write('dist/run.sh', 'run.sh')
    if os.path.exists('dist/README.txt'):
        z.write('dist/README.txt', 'README.txt')
    if os.path.exists('dist/HOW-TO-RUN.txt'):
        z.write('dist/HOW-TO-RUN.txt', 'HOW-TO-RUN.txt')
    if os.path.exists('campaign-data.json'):
        z.write('campaign-data.json', 'campaign-data.json')
    for root, dirs, files in os.walk('dist'):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, 'dist')
            if not rel.endswith('.zip') and not rel.endswith('.exe') and not rel.endswith('.blob'):
                z.write(full, os.path.join('dist', rel))
print('Zip archive created successfully: ' + zip_path)
"`, { stdio: "inherit" });
} catch (e) {
  console.error("ZIP creation error:", e);
}

console.log("\n===============================================================");
console.log(" SUCCESS! Standalone Windows Executable Ready:");
console.log(" - dist/Aethelgard-Campaign.exe");
console.log(" - dist/Aethelgard-Standalone-Windows.zip");
console.log(" - dist/Start-Aethelgard.bat");
console.log("===============================================================\n");
