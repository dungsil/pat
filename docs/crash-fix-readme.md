# CK3 RICE Mod Crash Fix

## Problem Summary

The CK3 RICE mod translation causes game crashes due to **214 malformed variable patterns** in Korean translation files.

## Root Cause

**Malformed Pattern**: `$[` (mixing dollar variable syntax with square bracket syntax)

### Example

❌ **Incorrect** (causes crash):
```
$EFFECT_LIST_BULLET$[GetTitleByKey('k_lanka').GetNameNoTier]
```

✅ **Correct**:
```
$EFFECT_LIST_BULLET$ [GetTitleByKey('k_lanka').GetNameNoTier]
```

The space after `$EFFECT_LIST_BULLET$` is critical. When removed, it creates `$[` which the game engine cannot parse.

## Why It Crashes

CK3's game engine recognizes these variable syntaxes:
- `$variable$` - Dollar-wrapped variables
- `[Function]` - Square bracket functions
- `£variable£` - Pound-wrapped variables
- `@icon@` - Icon references

**It does NOT support mixed syntax**:
- `$[...]` ❌ (dollar + square bracket)
- `£[...]` ❌ (pound + square bracket)
- `[$...]` ❌ (square bracket containing dollar)

## Solution

### Automatic Fix (Recommended)

```bash
# Step 1: Identify and invalidate incorrect translations
pnpm ck3:retranslate

# Step 2: Re-translate correctly
pnpm ck3
```

### How It Works

1. The `retranslate` script scans all translation files
2. Validates each translation using `validateTranslation()` function
3. Detects malformed patterns like `$[`, `£[`, etc.
4. Resets hashes for problematic entries
5. Next `pnpm ck3` run will re-translate them correctly

## Validation Logic

The validation logic is already implemented in:
- **File**: `scripts/utils/translation-validator.ts`
- **Function**: `detectMalformedVariables()` (line 42)
- **Pattern detection**: Line 48 - `/\$\[/g`

### Test Results

✅ All tests pass:

```
Test 1: Malformed pattern "$EFFECT_LIST_BULLET$[king|E]"
Result: isValid = false ✓ (correctly detected)

Test 2: Correct pattern "$EFFECT_LIST_BULLET$ [king|E]"
Result: isValid = true ✓ (passes validation)

Test 3: Complex real-world case
Result: isValid = false ✓ (correctly detected)
```

## Impact

### Affected Files
- Total: **214 instances** of `$[` pattern
- Main files:
  - `ck3/RICE/mod/localization/korean/___rice_sri_lanka_l_korean.yml`
  - `ck3/RICE/mod/localization/korean/___RICE_north_atlantic_l_korean.yml`
  - Various other RICE mod translation files

### Why This Happened

These translations were created **before the validation logic was implemented**. The validation system is now in place and will prevent this issue for all new translations.

## Prevention

The following safeguards are now active:

1. **Translation Validation** (`scripts/utils/translate.ts:89-95`):
   - Every new AI translation is validated
   - Invalid translations trigger automatic retry

2. **Cache Validation** (`scripts/utils/translate.ts:70-77`):
   - Cached translations are also validated
   - Invalid cache entries are automatically removed

3. **Retranslation Script** (`scripts/utils/retranslation-invalidator.ts`):
   - Scans existing translation files
   - Identifies quality issues
   - Resets hashes for problematic entries

## Code Changes

**No code changes required!** 

The existing validation logic already correctly detects and prevents this issue. The user only needs to run the retranslation command to fix existing translations.

## For Developers

### Validation Function Location
```typescript
// scripts/utils/translation-validator.ts

function detectMalformedVariables(text: string): string[] {
  const malformedPatterns: string[] = []
  
  const dollarMixedPatterns = [
    /\$\[/g,  // $[ - Detected ✓
    /\$</g,   // $< - Detected ✓
    /\$\s+\w+\s+\$/g,  // $ var $ with spaces
  ]
  
  // ... additional pattern checks for £[, @[, etc. ...
  
  for (const pattern of dollarMixedPatterns) {
    const matches = text.match(pattern)
    if (matches) {
      malformedPatterns.push(...matches)
    }
  }
  
  return [...new Set(malformedPatterns)]  // Remove duplicates
}
```

### Usage in Translation Pipeline
```typescript
// scripts/utils/translate.ts

export async function translate(text: string, gameType: GameType, retry: number = 0): Promise<string> {
  // ... normalization and caching logic ...
  
  // Actual AI translation request
  const translatedText = await translateAI(text, gameType)
  
  // Validation
  const validation = validateTranslation(normalizedText, translatedText, gameType)

  if (!validation.isValid) {
    log.warn(`Translation validation failed (retrying): "${normalizedText}" -> "${translatedText}" (reason: ${validation.reason})`)
    return await translate(text, gameType, retry + 1)  // Automatic retry
  }
  
  // Cache and return
  await setCache(text, translatedText, gameType)
  return translatedText
}
```

## Additional Resources

- **Korean Guide**: See `크래시_해결_가이드.md` for Korean documentation
- **Detailed Analysis**: See `CRASH_ANALYSIS.md` for technical details
- **Validation Code**: `scripts/utils/translation-validator.ts`
- **Retranslation Logic**: `scripts/utils/retranslation-invalidator.ts`

## Quick Reference

```bash
# Fix RICE mod crashes
pnpm ck3:retranslate  # Invalidate incorrect translations
pnpm ck3              # Re-translate

# For other games
pnpm vic3:retranslate && pnpm vic3
pnpm stellaris:retranslate && pnpm stellaris
```

---

**Conclusion**: The validation system is working correctly. Running the retranslation commands will automatically fix all 214 malformed patterns. No code changes needed! ✨
