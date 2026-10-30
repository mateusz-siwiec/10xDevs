# Design tokens

Values live in `frontend/src/index.css`.

## Raw values

| Token | Light | Dark |
| --- | --- | --- |
| `--text` | #6b6375 | #9ca3af |
| `--text-h` | #08060d | #f3f4f6 |
| `--bg` | #fff | #16171d |
| `--border` | #e5e4e7 | #2e303a |
| `--accent` | #9d2ff5 | #c084fc |
| `--on-accent` | #fff | #16171d |
| `--accent-bg` | rgba(157,47,245,0.1) | rgba(192,132,252,0.15) |
| `--accent-border` | rgba(157,47,245,0.5) | rgba(192,132,252,0.5) |
| `--ring` | #9d2ff5 | #c084fc |
| `--radius` | 8px | 8px |
| `--radius-card` | 12px | 12px |

Chart aliases (in `:root`, resolve per theme): `--chart-tick` = `var(--text)`, `--chart-grid` = `var(--border)`, `--chart-tooltip-bg` = `var(--bg)`, `--chart-tooltip-border` = `var(--border)`, `--chart-bar` = `var(--accent)`.

## Contrast (WCAG, computed)

| Pair | Light | Dark | Min |
| --- | --- | --- | --- |
| `--on-accent` on `--accent` | 5.05:1 | 6.77:1 | 4.5 |
| `--accent` on `--bg` | 5.05:1 | 6.77:1 | 4.5 |
| `--text` on `--bg` | 5.73:1 | 7.04:1 | 4.5 |
| `--text-h` on `--bg` | 20.15:1 | n/a | 4.5 |
