#!/usr/bin/env python3
"""Phase 3: Rename all extract-* variables to semantic names.

Safe replacement: only match exact variable names (with \b word boundary
equivalent in CSS: --var-name followed by : or space or - or whitespace).
"""
import re, os, glob

# Use a regex-based replacer that only matches exact variable names
def build_exact_replacer(var_map):
    """Build a regex that matches exact CSS variable references only."""
    # Sort longest first to avoid partial matches
    old_names = sorted(var_map.keys(), key=len, reverse=True)
    # Escape special regex chars in variable names
    pattern = r'(?:' + '|'.join(re.escape(n) for n in old_names) + r')'
    def replacer(m):
        matched = m.group(0)
        return var_map.get(matched, matched)
    return pattern, replacer


def replace_refs(content, var_map):
    pattern, replacer_fn = build_exact_replacer(var_map)
    return re.sub(pattern, replacer_fn, content)

# Shadow: 15 renamed (same count, more meaningful names)
shadow_map = {
    "--shadow-extract-1":     "--shadow-glow-blue",
    "--shadow-extract-2":     "--shadow-heavy",
    "--shadow-extract-3":     "--shadow-outline-w",
    "--shadow-extract-4":     "--shadow-overlay",
    "--shadow-extract-5":     "--shadow-overlay-dark",
    "--shadow-extract-6":     "--shadow-outline-bg",
    "--shadow-extract-7":     "--shadow-drag",
    "--shadow-extract-8":     "--shadow-line",
    "--shadow-extract-9":     "--shadow-card",
    "--shadow-extract-10":    "--shadow-line-border",
    "--shadow-extract-11":    "--shadow-glow-blue-lg",
    "--shadow-extract-12":    "--shadow-outline-bg-md",
    "--shadow-extract-13":    "--shadow-amber",
    "--shadow-extract-14":    "--shadow-glow-blue-sm",
    "--shadow-extract-18":    "--shadow-heavy-sm",
}

# Gradient: 7 renamed
gradient_map = {
    "--gradient-extract-1":   "--gradient-red-card",
    "--gradient-extract-2":   "--gradient-white-card",
    "--gradient-extract-3":   "--gradient-radial-card",
    "--gradient-extract-4":   "--gradient-red-card-sm",
    "--gradient-extract-7":   "--gradient-radial-page",
    "--gradient-extract-25":  "--gradient-brand",
    "--gradient-extract-26":  "--gradient-brand-alt",
}

# Drop shadow: 1 renamed
drop_shadow_map = {
    "--drop-shadow-extract-1": "--drop-shadow-icon",
}

all_map = {}
all_map.update(shadow_map)
all_map.update(gradient_map)
all_map.update(drop_shadow_map)

css_path = "ui/src/index.css"
with open(css_path, "r") as f:
    content = f.read()
content = replace_refs(content, all_map)
with open(css_path, "w") as f:
    f.write(content)
print(f"✅ Renamed {len(all_map)} variables in {css_path}")

# Update styles.ts references
styles_path = "ui/src/lib/styles.ts"
with open(styles_path, "r") as f:
    content = f.read()
content = content.replace(
    "Maps to --shadow-extract-* groupings.",
    "Maps to --shadow-* semantic names."
)
content = content.replace(
    "Maps to --gradient-extract-* groupings.",
    "Maps to --gradient-* semantic names."
)
with open(styles_path, "w") as f:
    f.write(content)
print(f"✅ Updated styles.ts")

print(f"\nShadow map (15 vars):")
for old, new in shadow_map.items():
    print(f"  {old:30s} → {new}")
print(f"\nGradient map (7 vars):")
for old, new in gradient_map.items():
    print(f"  {old:30s} → {new}")
