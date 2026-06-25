"""
Hard test cases for app.py's export functions (generate_pdf, generate_docx)
and html_exporter.generate_html_report. Focused on adversarial inputs:
empty result sets, huge finding lists (page-break stress), unicode/emoji
vendor names, missing fields, and HTML-injection-shaped strings.
"""

import sys

sys.path.insert(0, "/home/claude/build")

import app  # noqa: E402
import html_exporter  # noqa: E402

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


print("=== generate_pdf ===")

# 1. Empty results - the old code's pdf.output on a results=[] loop produces
#    a banner-only PDF; make sure it doesn't crash and produces valid bytes.
pdf_bytes = app.generate_pdf([])
check("empty results produces valid non-empty pdf bytes", isinstance(pdf_bytes, bytes) and len(pdf_bytes) > 100, len(pdf_bytes))
check("empty results pdf starts with %PDF header", pdf_bytes[:4] == b"%PDF", pdf_bytes[:8])

# 2. Single normal vendor
normal_result = {
    "vendor": "Acme Corp", "risk_score": "High", "summary": "Standard summary.",
    "scope": "Cloud hosting of customer PII.", "findings": ["No MFA enforced", "Outdated TLS"],
    "next_steps": ["Enable MFA", "Upgrade TLS to 1.2+"], "postscript": "Recommend conditional approval.",
    "filename": "acme.pdf",
}
pdf_bytes = app.generate_pdf([normal_result])
check("single normal vendor produces valid pdf", pdf_bytes[:4] == b"%PDF" and len(pdf_bytes) > 500, len(pdf_bytes))

# 3. Vendor with unicode/emoji name + smart quotes (the exact thing that
#    crashes fpdf's latin-1 core fonts if not cleaned first)
unicode_result = {
    "vendor": "Société Générale™ 🏦", "risk_score": "Critical",
    "summary": "Vendor uses \u201csmart quotes\u201d and an em\u2014dash and ellipsis\u2026",
    "scope": "Handles données personnelles (GDPR).",
    "findings": ["Finding with emoji 🚨 and unicode café"],
    "next_steps": ["Étape suivante"],
    "postscript": "Final note with \u2018single smart quotes\u2019.",
    "filename": "societe.pdf",
}
try:
    pdf_bytes = app.generate_pdf([unicode_result])
    check("unicode/emoji vendor data does not crash pdf generation", pdf_bytes[:4] == b"%PDF", pdf_bytes[:8])
except Exception as e:
    check("unicode/emoji vendor data does not crash pdf generation", False, str(e))

# 4. Vendor with a huge number of findings (page-break stress test - the
#    original code had no logic to avoid splitting a card header from its body)
huge_result = {
    "vendor": "MegaCorp Holdings", "risk_score": "Critical",
    "summary": "A" * 2000,
    "scope": "B" * 1000,
    "findings": [f"Finding number {i}: some detailed finding text describing an issue." for i in range(60)],
    "next_steps": [f"Step {i}: remediation action to take." for i in range(40)],
    "postscript": "C" * 3000,
    "filename": "mega.pdf",
}
try:
    pdf_bytes = app.generate_pdf([huge_result, normal_result, unicode_result])
    check("huge findings list across multiple vendors does not crash", pdf_bytes[:4] == b"%PDF", pdf_bytes[:8])
    check("huge findings list produces substantial multi-page output", len(pdf_bytes) > 5000, len(pdf_bytes))
except Exception as e:
    check("huge findings list across multiple vendors does not crash", False, str(e))

# 5. Missing/None fields (simulates a result that slipped through normalization
#    with gaps - defense in depth)
sparse_result = {"vendor": None, "risk_score": None}
try:
    pdf_bytes = app.generate_pdf([sparse_result])
    check("sparse/None-field result does not crash pdf generation", pdf_bytes[:4] == b"%PDF", pdf_bytes[:8])
except Exception as e:
    check("sparse/None-field result does not crash pdf generation", False, str(e))

# 6. Vendor name that is extremely long (potential cell overflow)
long_name_result = dict(normal_result)
long_name_result["vendor"] = "A" * 300 + " Extremely Long Vendor Name Inc."
try:
    pdf_bytes = app.generate_pdf([long_name_result])
    check("extremely long vendor name does not crash pdf generation", pdf_bytes[:4] == b"%PDF", pdf_bytes[:8])
except Exception as e:
    check("extremely long vendor name does not crash pdf generation", False, str(e))


print("\n=== generate_docx ===")

docx_bytes = app.generate_docx([])
check("empty results produces valid docx bytes", isinstance(docx_bytes, bytes) and len(docx_bytes) > 100, len(docx_bytes))
check("empty docx starts with PK zip header", docx_bytes[:2] == b"PK", docx_bytes[:4])

docx_bytes = app.generate_docx([huge_result, unicode_result, sparse_result])
check("docx handles huge/unicode/sparse results without crashing", docx_bytes[:2] == b"PK", docx_bytes[:4])


print("\n=== html_exporter.generate_html_report ===")

html_out = html_exporter.generate_html_report([])
check("empty results produces valid html", "<html" in html_out.lower() and len(html_out) > 50, len(html_out))

# HTML-injection-shaped finding text - must be escaped, not interpolated raw
injection_result = {
    "vendor": "<script>alert('xss')</script>EvilCorp",
    "risk_score": "Low",
    "summary": "Normal summary",
    "scope": "Normal scope",
    "findings": ["<img src=x onerror=alert(1)>", "Normal finding"],
    "next_steps": ["Normal step"],
    "postscript": "Normal postscript",
    "category_scores": {"Access Control": 50, "Data Privacy": 50, "Patch Management": 50, "Compliance": 50},
}
html_out = html_exporter.generate_html_report([injection_result])
check("script tag in vendor name is escaped, not raw", "<script>alert" not in html_out, "raw script tag found in output!")
check("escaped script tag content is present as text", "&lt;script&gt;" in html_out, "escaped form not found")
check("img onerror payload escaped", "<img src=x onerror" not in html_out, "raw img onerror tag found in output!")

html_out = html_exporter.generate_html_report([huge_result, normal_result, unicode_result])
check("html report with mixed huge/unicode results renders", "<html" in html_out.lower() and len(html_out) > 1000, len(html_out))

print(f"\n{'='*50}\nRESULTS: {passed} passed, {failed} failed\n{'='*50}")
sys.exit(1 if failed else 0)
