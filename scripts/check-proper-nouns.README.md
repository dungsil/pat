# Proper Noun Translation Checker

A tool to detect and fix improperly translated proper nouns in Paradox game mod localization files.

## Purpose

This script checks Korean translation files to find cases where English proper nouns (names of people, dynasties, cultures) have been incorrectly translated to their Korean meanings instead of being transliterated as names.

### Example Issues Detected

- ❌ "Sun" (name) → "태양" (meaning: sun)
- ✅ "Sun" (name) → "선" (correct transliteration)

- ❌ "Gold" (in name) → "금" (meaning: gold/money)  
- ✅ "Gold" (in name) → "골드" (correct transliteration)

## Usage

### Run the checker

```bash
pnpm check-proper-nouns
```

or

```bash
pnpm jiti scripts/check-proper-nouns.ts
```

### Output

The script will:
1. Scan all Korean translation files in `ck3/ETC/More Character Names/`
2. Print a summary to console
3. Generate a detailed JSON report at `/tmp/proper-noun-issues.json`

## Files Checked

1. **Character Names** (~62K entries)
   - `ck3/ETC/mod/localization/korean/More Character Names/names/___character_names_l_korean.yml`
   - Compared against: `ck3/ETC/upstream/More Character Names/names/character_names_l_english.yml`

2. **Dynasty Names** (~12K entries)
   - `ck3/ETC/mod/localization/korean/More Character Names/dynasties/___dynasty_names_l_korean.yml`
   - Compared against: `ck3/ETC/upstream/More Character Names/dynasties/dynasty_names_l_english.yml`

3. **Culture Names** (~190 entries)
   - `ck3/ETC/mod/localization/korean/More Character Names/culture/___culture_name_lists_l_korean.yml`
   - Compared against: `ck3/ETC/upstream/More Character Names/culture/culture_name_lists_l_english.yml`

## Detection Patterns

The script checks for 28+ patterns including:

### Materials
- Gold, Silver, Iron, Stone, Wood, Steel

### Celestial Bodies
- Sun, Moon, Star

### Titles (when part of names)
- King, Queen, Prince, Duke

### Colors
- White, Black, Red, Blue, Green

### Nature
- Rose, River, Mountain

### Animals
- Lion, Bear, Wolf, Eagle

### Common Words That Are Actually Names
- Stake, Stale, Stare

### Other
- Heart, Light, Dark

## Performance

- **Memory efficient**: Processes files line-by-line using generators
- **Fast lookup**: Loads English reference files into memory maps
- **Scalable**: Can handle 70K+ translation entries without issues

## Adding New Patterns

To add detection for new words, edit the `PROBLEMATIC_PATTERNS` array in the script:

```typescript
{
  english: /\bword\b/i,           // Regex pattern to match
  incorrect: ['잘못된번역'],        // Korean meanings to detect
  correct: '올바른번역',            // Recommended transliteration
  severity: 'high' as const       // Severity: high/medium/low
}
```

## Output Format

### Console Output
Shows a summary with severity classification and details for each issue found.

### JSON Report
Located at `/tmp/proper-noun-issues.json`, contains:
- Timestamp
- Total issue count
- Breakdown by severity
- Detailed list with:
  - File path and line number
  - Entry key
  - English value
  - Incorrect Korean value
  - Issue reason
  - Severity level

## Integration

This tool can be:
- Run manually before committing translation changes
- Added to CI/CD pipelines to validate translations
- Used to generate fix suggestions for translators

## Related Commands

```bash
# Update upstream source files first
pnpm upstream

# Run CK3 translation
pnpm ck3

# Check for proper noun issues
pnpm check-proper-nouns

# Retranslate items that need fixing
pnpm ck3:retranslate
```
