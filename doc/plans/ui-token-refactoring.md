# Paperclip UI Token & Style Refactoring — Full Plan

## Problem Statement

Paperclip's UI has ~200 business components and a 1959-line `index.css` that has become hard to navigate. The token extraction batches (1-4) produced a sprawling ALLOWLIST (72 lines), verbose per-line "Extracted from X.tsx" comments (244 lines), and 35 extracted variables (shadow/gradient/drop-shadow) with only one-word labels. The system works, but a developer cannot quickly find what a variable does, where it's used, or whether it should be merged.

## Current State

| Metric | Value |
|---|---|
| TSX/TS files (excluding tests) | 697 |
| `index.css` lines | 1936 (after step 1) |
| CSS variables | 570 |
| Extracted shadow tokens | 15 (`--shadow-extract-*`) |
| Extracted gradient tokens | 9 (`--gradient-extract-*`) |
| Extracted drop-shadow tokens | 1 (`--drop-shadow-extract-*`) |
| ALLOWLIST entries | 34 (compressed from 72 lines) |
| Largest file | `IssueDetail.tsx` (5669 lines) |
| Files >3000 lines | 5 (AgentDetail 4286, CompanySkills 5520, IssueChatThread 5315, Pipelines 5288, IssueDetail 5669) |

## Design Principles (from DESIGN.md)

1. **Tokens are the only source of visual values.** No hex, no raw px in components.
2. **One way to say each thing.** One Button, one Card, one Badge.
3. **Machine values use monospace.** IDs, costs, token counts formatted consistently.
4. **Status is systematic.** Running/paused/blocked map to a single token set used identically everywhere.

## Phases

### Phase 1: index.css Documented ✅ (COMPLETED)

**What was done:**
- Added TOKEN INDEX comment block (line 278) with jump targets for all 10 sections
- Compressed ALLOWLIST from 72 lines to 39 lines (same 34 entries, script-compatible)
- Added grouped shadow-extract-* comments (9 groups for 15 tokens)
- Added grouped gradient-extract-* comments (4 groups for 9 tokens)
- Shortened batch 4 MISC token description (18 lines → 5 lines)
- Shortened verbose "Extracted from X.tsx(...)" comments on shadow/gradient/drop-shadow to 3-5 word labels

**Net result:** 1959 → 1936 lines, net -23 lines. check-token-gates.mjs parsing verified.

### Phase 2: `ui/src/lib/styles.ts` Token Export (NEXT)

**Goal:** Create a TypeScript file that exports token references for use in TSX/TS files via import, giving IDE autocomplete and making refactoring a single-line change.

**Actions:**
1. Create `ui/src/lib/styles.ts` with a `TOKEN` object
2. Export semantic color, shadow, gradient, radius, and font-size references as `var(...)` strings
3. Export a `cn()` wrapper function for className composition
4. Add `@type` JSDoc on each value explaining the token's role

**Example output:**
```typescript
// ui/src/lib/styles.ts
export const TOKEN = {
  /** Background color for page body */
  bg: 'var(--background)',
  /** Card/surface background */
  card: 'var(--card)',
  /** Primary brand text */
  fg: 'var(--foreground)',
  // ... 30+ more
  shadow: {
    /** Small card shadow */
    card: '0 1px 0 rgba(15,23,42,0.02)',
    /** Floating card shadow */
    float: '0 18px 42px rgba(15,23,42,0.06)',
    /** Top-only line shadow */
    line: '0 -12px 28px rgba(15,23,42,0.08)',
    /** Blue glow for live elements */
    glow: '0 16px 40px rgba(37,99,235,0.08)',
  },
  // ...
} as const
```

**Risk:** Zero. Pure new file. No existing code changes.

### Phase 3: Merge Shadow/Gradient Variables (MEDIUM RISK)

**Goal:** Consolidate 15 shadow and 9 gradient variables into 3-4 general-purpose variables each.

**Shadow consolidation plan:**

| Current | Merged To | Description |
|---|---|---|
| `--shadow-extract-4,5` | `--shadow-overlay` | ChatComposer popup overlay (light/dark) |
| `--shadow-extract-8,10` | `--shadow-line` | 1px top-only line shadow |
| `--shadow-extract-9` | `--shadow-card` | 18px blur card float |
| `--shadow-extract-1,11,14` | `--shadow-glow-blue` | 37,99,235 blue glow |
| `--shadow-extract-2,18` | `--shadow-heavy` | Dark large-offset deep float |
| `--shadow-extract-3,6,12` | `--shadow-outline` | 0-0-0 1-2px outline |
| `--shadow-extract-7` | `--shadow-drag` | Overlay + primary border (unique) |
| `--shadow-extract-13` | `--shadow-amber` | 3px amber highlight (unique) |

Target: 15 → 8 variables

**Gradient consolidation plan:**

| Current | Merged To | Description |
|---|---|---|
| `--gradient-extract-1,4` | `--gradient-red-card` | Red tint linear 180deg |
| `--gradient-extract-2` | `--gradient-white-card` | White subtle linear 180deg |
| `--gradient-extract-3,7` | `--gradient-radial` | Radial decorative |
| `--gradient-extract-25,26` | `--gradient-brand` | Primary/accent brand gradient |

Target: 9 → 4 variables

**Execution:**
1. Use `sed` to replace `--shadow-extract-4` with `--shadow-overlay` in all .tsx files
2. Do one component at a time to keep diffs reviewable
3. After each batch, run `pnpm typecheck` (build may fail due to esbuild env issue)
4. If typecheck passes and no style lint errors, commit

### Phase 4: Break Large Files (HIGHEST RISK — DO LAST)

**Goal:** Split 5 files >3000 lines into multiple files each, targeting <800 lines per file.

**Plan:**

| File | Lines | Split Into |
|---|---|---|
| `IssueDetail.tsx` | 5669 | `IssuePage.tsx` (skeleton) + `IssueHeader.tsx` + `IssueTabs.tsx` + `IssuePropertiesPanel.tsx` + `IssueActivityFeed.tsx` |
| `CompanySkills.tsx` | 5520 | `CompanySkillsPage.tsx` + `SkillList.tsx` + `SkillCard.tsx` + `SkillFilterBar.tsx` + `SkillForm.tsx` |
| `IssueChatThread.tsx` | 5315 | `ChatThread.tsx` (skeleton) + `MessageList.tsx` + `MessageBubble.tsx` + `ChatInput.tsx` + `FileAttachmentView.tsx` |
| `Pipelines.tsx` | 5288 | `PipelinePage.tsx` + `PipelineList.tsx` + `PipelineDetail.tsx` + `PipelineControls.tsx` |
| `AgentDetail.tsx` | 4286 | `AgentPage.tsx` + `AgentHeader.tsx` + `AgentConfigForm.tsx` + `AgentStatusPanel.tsx` + `AgentActionsPanel.tsx` |

**Execution order (risk: low → high):**
1. `AgentDetail.tsx` (4286) — cleanest separation of concerns
2. `Pipelines.tsx` (5288) — moderate complexity
3. `CompanySkills.tsx` (5520)
4. `IssueChatThread.tsx` (5315) — most complex (live updates, drag-drops)
5. `IssueDetail.tsx` (5669) — most risky (highest traffic page)

**Before each file split:**
- Run `pnpm test` to establish baseline
- Run `pnpm typecheck` to verify types
- Split in < 300 line chunks, commit each chunk
- After all chunks committed, run `pnpm typecheck` again
- If typecheck passes, file is structurally safe

### Phase 5: Unify Business Component Patterns (ONGOING)

**Goal:** Create 3 generic wrapper components that cover 80% of page structure patterns, so new pages don't need to invent layout.

| Component | Purpose | Replaces |
|---|---|---|
| `<Card>` | Card surface with consistent padding, border, radius, shadow | All `<div className="bg-card border border-border rounded-lg ...">` |
| `<Section>` | Content section with title, subtitle, gap, padding | All `<div className="space-y-4 p-4 border rounded-lg">` |
| `<ListRow>` | List row with consistent height, hover, gap | All `<div className="h-12 px-3 py-2 ...">` in list contexts |

**Execution:**
1. Create component in `ui/src/components/ui/`
2. Add Storybook story
3. Migrate one page at a time
4. Verify visual consistency

## Success Criteria (Definition of Done)

1. `index.css` < 800 lines (all extracted vars merged, index compressed)
2. ALLOWLIST = 0 (all hex/px sources either tokenized or no longer needed)
3. Largest file < 1000 lines
4. All files > 500 lines reviewed and potentially split
5. `check-token-gates.mjs` passes with 0 violations
6. Storybook visual baseline matches (zero visual change)
7. No hardcoded hex in business components (only ALLOWLIST exceptions)

## Risks

| Risk | Mitigation |
|---|---|
| Merge shadow vars changes visual | Each group verified visually; batch merge + commit |
| Breaking build during refactoring | Typecheck only (no build env); commit per component |
| Splitting files breaks imports | TypeScript compiler catches all import errors |
| ALLOWLIST compression breaks check-token-gates | Verified regex parsing (34 entries load correctly) |
| esbuild broken in this env | typecheck + dev mode are sufficient validation |

## What NOT to Do

- Do NOT switch to TDesign (200+ business components are self-built anyway)
- Do NOT redesign the visual appearance (zero visual change is the constraint)
- Do NOT touch `DESIGN.md` (documented principles are correct)
- Do NOT refactor all 244 "Extracted from" comments at once (Phase 4+ batch by batch)
- Do NOT split all 5 big files in one commit (split 1 at a time)
