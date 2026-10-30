// Guard for the dashboard and workout UI contracts: no literal colours or arbitrary values outside the tokens.
// Token source frontend/src/index.css is intentionally never scanned.
// Run: npm run check:tokens (from frontend/). Exits 1 and prints file:line for every hit.
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const FILES = [
  'src/pages/DashboardPage.tsx',
  'src/components/ConsistencyCard.tsx',
  'src/components/RecentRecords.tsx',
  'src/components/WeeklyVolumeChart.tsx',
  'src/components/chartTheme.ts',
  'src/styles/dashboard.css',
  'src/styles/page.css',
  'src/pages/WorkoutPage.tsx',
  'src/components/SetLogger.tsx',
  'src/components/SessionSetList.tsx',
  'src/components/RestTimer.tsx',
  'src/components/PlanWalkthrough.tsx',
  'src/components/PreviousWorkoutHint.tsx',
  'src/components/ProgressionRecommendation.tsx',
  'src/components/SubstituteSuggestions.tsx',
  'src/components/ExercisePicker.tsx',
  'src/styles/workout.css',
]

const PALETTES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

const PATTERNS = [
  { name: 'hex colour', re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'colour function', re: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/i },
  { name: 'arbitrary value', re: /\[-?\d*\.?\d+(?:px|rem|em|%|vh|vw|svh)\]/ },
  { name: 'palette class', re: new RegExp(String.raw`\b[a-z-]+-(?:${PALETTES})-(?:50|[1-9]00|950)\b`) },
]

let hits = 0
for (const file of FILES) {
  const lines = readFileSync(join(root, file), 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) {
        console.error(`${relative(root, join(root, file))}:${index + 1}: ${name}: ${line.trim()}`)
        hits++
      }
    }
  })
}

if (hits > 0) {
  console.error(`\ncheck:tokens failed: ${hits} hard-coded value(s). Use tokens from src/index.css.`)
  process.exit(1)
}
console.log(`check:tokens ok: ${FILES.length} files, no hard-coded values.`)
