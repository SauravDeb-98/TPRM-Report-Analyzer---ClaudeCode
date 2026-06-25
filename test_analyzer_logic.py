"""
Hard test cases for the pure-logic parts of analyzer.py:
JSON extraction, risk score normalization, list coercion, and full
result normalization. No network calls - these test the defensive
parsing layer that protects the rest of the app from a misbehaving LLM
response.
"""

import json
import sys

sys.path.insert(0, "/home/claude/build")
import analyzer  # noqa: E402

passed = 0
failed = 0


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS: {label}")
    else:
        failed += 1
        print(f"  FAIL: {label}  {detail}")


print("=== _extract_json ===")

# 1. Clean JSON
r = analyzer._extract_json('{"a": 1, "b": "two"}')
check("clean json", r == {"a": 1, "b": "two"}, r)

# 2. Markdown-fenced JSON
r = analyzer._extract_json('Sure, here you go:\n```json\n{"a": 1}\n```\nHope that helps!')
check("fenced json with commentary", r == {"a": 1}, r)

# 3. Plain fence, no "json" tag
r = analyzer._extract_json('```\n{"x": [1,2,3]}\n```')
check("plain fence", r == {"x": [1, 2, 3]}, r)

# 4. Nested braces (this is exactly what breaks a greedy regex r'\{.*\}')
nested = '{"vendor": "Acme", "findings": ["uses {curly} in text"], "meta": {"nested": {"deep": 1}}}'
r = analyzer._extract_json(nested)
check("nested braces with literal { in string", r is not None and r.get("meta", {}).get("nested", {}).get("deep") == 1, r)

# 5. Trailing commentary after the JSON object
r = analyzer._extract_json('{"a": 1}\n\nLet me know if you need anything else!')
check("trailing commentary after json", r == {"a": 1}, r)

# 6. Leading commentary before the JSON object
r = analyzer._extract_json('Here is the analysis:\n\n{"a": 1}')
check("leading commentary before json", r == {"a": 1}, r)

# 7. Garbage / no JSON at all
r = analyzer._extract_json('I cannot analyze this document, sorry.')
check("no json present returns None", r is None, r)

# 8. Empty string
r = analyzer._extract_json('')
check("empty string returns None", r is None, r)

# 9. Unbalanced braces (malformed / truncated response)
r = analyzer._extract_json('{"a": 1, "b": [1, 2, 3')
check("unbalanced/truncated json returns None", r is None, r)

# 10. Braces inside escaped quotes within strings
tricky = '{"text": "He said \\"use {x} notation\\" to me"}'
r = analyzer._extract_json(tricky)
check("escaped quotes containing braces", r is not None and r.get("text") == 'He said "use {x} notation" to me', r)

# 11. Multiple top-level-looking objects - should grab the first balanced one
r = analyzer._extract_json('{"first": 1}{"second": 2}')
check("multiple json objects grabs the first", r == {"first": 1}, r)

# 12. Unicode content inside JSON
r = analyzer._extract_json('{"vendor": "Société Générale™", "note": "café"}')
check("unicode content preserved", r is not None and r.get("vendor") == "Société Générale™", r)


print("\n=== _normalize_risk_score ===")

check("Critical exact", analyzer._normalize_risk_score("Critical") == "Critical")
check("lowercase critical", analyzer._normalize_risk_score("critical") == "Critical")
check("CRITICAL uppercase", analyzer._normalize_risk_score("CRITICAL") == "Critical")
check("whitespace padded", analyzer._normalize_risk_score("  High  ") == "High")
check("partial word critically", analyzer._normalize_risk_score("Critically Severe") == "Critical")
check("none value", analyzer._normalize_risk_score(None) == "Medium")
check("empty string", analyzer._normalize_risk_score("") == "Medium")
check("garbage value falls back to Medium", analyzer._normalize_risk_score("Apocalyptic") == "Medium")
check("numeric value", analyzer._normalize_risk_score(5) == "Medium")
check("low variant", analyzer._normalize_risk_score("lower than expected") == "Low")


print("\n=== _coerce_list_of_strings ===")

check("none returns empty list", analyzer._coerce_list_of_strings(None) == [])
check("plain list of strings", analyzer._coerce_list_of_strings(["a", "b"]) == ["a", "b"])
check("single string becomes single-item list", analyzer._coerce_list_of_strings("just one finding") == ["just one finding"])
check("empty string becomes empty list", analyzer._coerce_list_of_strings("") == [])
check("list with dicts extracts text field",
      analyzer._coerce_list_of_strings([{"finding": "bad config"}, "plain string"]) == ["bad config", "plain string"])
check("list with empty strings filtered", analyzer._coerce_list_of_strings(["", "  ", "real one"]) == ["real one"])
check("list with None items skipped", analyzer._coerce_list_of_strings(["a", None, "b"]) == ["a", "b"])
check("list with numbers coerced to str", analyzer._coerce_list_of_strings([1, 2, 3]) == ["1", "2", "3"])
check("dict without known keys falls back to json dump",
      "weird_key" in analyzer._coerce_list_of_strings([{"weird_key": "value"}])[0])


print("\n=== _normalize_result (full pipeline) ===")

# Fully well-formed input
r = analyzer._normalize_result({
    "vendor": "Acme Corp", "scope": "Cloud hosting", "risk_score": "high",
    "findings": ["No MFA"], "next_steps": ["Enable MFA"],
    "summary": "Summary text.", "postscript": "Postscript text."
})
check("well formed input normalizes risk score casing", r["risk_score"] == "High", r)
check("well formed input preserves vendor", r["vendor"] == "Acme Corp", r)

# Completely empty dict - the worst case, model returned {}
r = analyzer._normalize_result({})
check("empty dict still has all required keys", all(k in r for k in
      ["vendor", "scope", "risk_score", "findings", "next_steps", "summary", "postscript"]), r)
check("empty dict defaults vendor to Unknown Vendor", r["vendor"] == "Unknown Vendor", r)
check("empty dict defaults risk_score to Medium", r["risk_score"] == "Medium", r)
check("empty dict gets a fallback findings message rather than empty list", len(r["findings"]) == 1, r)

# Vendor is None explicitly (not missing - present but null)
r = analyzer._normalize_result({"vendor": None, "risk_score": "Low"})
check("explicit None vendor still defaults correctly", r["vendor"] == "Unknown Vendor", r)

# Vendor is just whitespace
r = analyzer._normalize_result({"vendor": "   ", "risk_score": "Low"})
check("whitespace-only vendor defaults correctly", r["vendor"] == "Unknown Vendor", r)

# findings/next_steps as single strings instead of lists (common model deviation)
r = analyzer._normalize_result({"findings": "Single finding as string", "next_steps": "Single step as string"})
check("findings as bare string becomes list", r["findings"] == ["Single finding as string"], r)
check("next_steps as bare string becomes list", r["next_steps"] == ["Single step as string"], r)

# Numeric risk_score (model hallucination)
r = analyzer._normalize_result({"risk_score": 90})
check("numeric risk_score falls back to Medium", r["risk_score"] == "Medium", r)

# Extra unexpected fields should be ignored, not crash
r = analyzer._normalize_result({"vendor": "X", "unexpected_field": {"nested": "data"}, "risk_score": "Low"})
check("extra unexpected fields don't break normalization", r["vendor"] == "X" and r["risk_score"] == "Low", r)

print(f"\n{'='*50}\nRESULTS: {passed} passed, {failed} failed\n{'='*50}")
sys.exit(1 if failed else 0)
