# False Positive Detection Fix

## Problem

The translation validator was incorrectly flagging valid Korean translations as invalid when sentence-ending punctuation appeared immediately before a dollar variable.

### Example of False Positive

```
Source: "$RICE_intro$ made it public"
Translation: "$RICE_intro$는 공개했습니다"  ✓ VALID

Source: "Text. $VAR$ continues"
Translation: "텍스트입니다.$VAR$ 계속됩니다"  ✓ VALID (was incorrectly flagged as INVALID)
```

The validator was detecting `.$` as a malformed variable pattern, even though it's actually:
- `.` = Korean sentence ending punctuation (마침표)
- `$VAR$` = Valid, complete dollar variable

## Root Cause

The regex pattern for detecting unbalanced dollar variable endings was too broad:

```typescript
// OLD (incorrect)
dollarEnd: text.match(/(?<!\$)[a-zA-Z0-9_\-.]+\$/g) || []
```

This pattern matched `[a-zA-Z0-9_\\-.]+\\$`, which includes single punctuation marks like `.`, `-`, or `_` followed by `$`.

### Why This Is Wrong

In the text `"있습니다.$RICE_var$"`:
- The `.` is sentence punctuation, not part of a variable
- But the regex `[a-zA-Z0-9_\\-.]+\\$` matched `.$` because `.` is in the character class

## Solution

Changed the regex to **require the pattern to start with an alphanumeric character**:

```typescript
// NEW (correct)
dollarEnd: text.match(/(?<!\$)[a-zA-Z0-9][a-zA-Z0-9_\-.]*\$/g) || []
```

Key changes:
- `[a-zA-Z0-9_\\-.]+` → `[a-zA-Z0-9][a-zA-Z0-9_\\-.]*`
- First character **must be alphanumeric**: `[a-zA-Z0-9]`
- Remaining characters **can include punctuation**: `[a-zA-Z0-9_\\-.]*`

This ensures:
- ✅ `var$` matches (valid variable name)
- ✅ `my_var$` matches (valid variable with underscore)
- ✅ `my-var.name$` matches (valid variable with dash and dot)
- ❌ `.$` does NOT match (single punctuation)
- ❌ `_$` does NOT match (single underscore)
- ❌ `-$` does NOT match (single dash)

## Test Results

All test cases pass:

```
✓ Original issue: sentence ending with period before dollar variable
✓ Korean sentence ending before dollar variable
✓ Multiple dollar variables with punctuation
✓ Actual malformed: $[ pattern (correctly detected)
✓ Actual malformed: [$ pattern (correctly detected)
✓ Valid: dollar variable with hyphen
✓ Valid: dollar variable with dot in name
✓ Edge cases: punctuation before variables
```

## Impact

This fix eliminates false positives in the retranslation process, allowing valid Korean translations to pass validation without being unnecessarily flagged for retranslation.

The fix applies to:
- Dollar variables: `$var$`
- Pound variables: `£var£`
- At variables: `@var@`

All three variable types now use the same improved pattern to prevent false positives.
