"""
Standalone interactive HTML report generator with embedded Plotly charts.
"""

import html as html_lib

import pandas as pd
import plotly.express as px


def _esc(value) -> str:
    """Escape user/AI-generated text before interpolating into HTML, since
    vendor names or findings could otherwise contain characters that break
    the layout or (in a worst case) inject markup."""
    return html_lib.escape(str(value), quote=True)


def _safe(res: dict) -> dict:
    """Same defense-in-depth guard as app.py._safe_result - protects against
    None/missing fields regardless of caller."""
    res = dict(res)
    res["vendor"] = res.get("vendor") or "Unknown Vendor"
    res["risk_score"] = res.get("risk_score") or "Medium"
    res["summary"] = res.get("summary") or ""
    res["scope"] = res.get("scope") or ""
    res["postscript"] = res.get("postscript") or ""
    res["findings"] = res.get("findings") or []
    res["next_steps"] = res.get("next_steps") or []
    return res


def generate_html_report(results):
    """
    Generates a standalone, highly interactive HTML report containing embedded Plotly charts
    and premium sleek CSS styling.
    """
    if not results:
        return _empty_report_html()

    df = pd.DataFrame([_safe(r) for r in results])
    risk_counts = df['risk_score'].value_counts().reset_index()
    risk_counts.columns = ['Risk', 'Count']

    if not risk_counts.empty:
        fig = px.pie(risk_counts, values='Count', names='Risk', title="Master Risk Distribution",
                     color='Risk', color_discrete_map={"Critical": "#ff4b4b", "High": "#ffa600", "Medium": "#ffde24", "Low": "#00d14e"},
                     hole=0.4)
        fig.update_layout(
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(color='#ffffff')
        )
        pie_html = fig.to_html(full_html=False, include_plotlyjs='cdn')
    else:
        pie_html = "<p>No risk data available.</p>"

    vendor_cards_html = ""
    plotlyjs_included = True  # CDN already pulled in by the pie chart above
    for idx, raw_res in enumerate(results):
        res = _safe(raw_res)
        vendor_name = _esc(res.get('vendor', 'Unknown Vendor'))
        risk = res.get('risk_score', 'Medium')

        badge_color = "#444"
        if risk == "Critical": badge_color = "linear-gradient(135deg, #ff4b4b, #990000)"
        elif risk == "High": badge_color = "linear-gradient(135deg, #ffa600, #b37400)"
        elif risk == "Medium": badge_color = "linear-gradient(135deg, #ffde24, #b39b00)"
        elif risk == "Low": badge_color = "linear-gradient(135deg, #00d14e, #008030)"

        findings_html = "".join(f"<li>{_esc(f)}</li>" for f in res.get('findings', [])) or "<li>None reported.</li>"
        next_steps_html = "".join(f"<li>{_esc(s)}</li>" for s in res.get('next_steps', [])) or "<li>None reported.</li>"

        # Use the real, finding-derived category scores computed upstream
        # (app.py) when present; fall back to a flat baseline rather than
        # random data if this module is ever called standalone.
        category_scores = res.get("category_scores")
        if not category_scores:
            base = {"Critical": 85, "High": 65, "Medium": 45, "Low": 20}.get(risk, 45)
            category_scores = {
                "Access Control": base, "Data Privacy": base,
                "Patch Management": base, "Compliance": base,
            }

        df_chart = pd.DataFrame({
            "Category": list(category_scores.keys()),
            "Vulnerability Score": list(category_scores.values()),
        })
        v_fig = px.bar(df_chart, x='Category', y='Vulnerability Score', range_y=[0, 100])
        v_fig.update_layout(
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(color='#ffffff'),
            margin=dict(l=0, r=0, t=30, b=0)
        )
        bar_html = v_fig.to_html(full_html=False, include_plotlyjs=False)

        vendor_cards_html += f"""
        <div class="vendor-card">
            <div class="card-header">
                <h2>{vendor_name}</h2>
                <div class="risk-badge" style="background: {badge_color}">{_esc(risk)} RISK</div>
            </div>

            <div class="grid-2">
                <div>
                    <div class="section-block">
                        <h3>Context</h3>
                        <p>{_esc(res.get('summary', 'No summary provided.'))}</p>
                    </div>
                    <div class="section-block">
                        <h3>Scope</h3>
                        <p>{_esc(res.get('scope', 'No scope provided.'))}</p>
                    </div>

                    <div class="grid-2">
                        <div class="section-block">
                            <h3>Critical Findings</h3>
                            <ul>{findings_html}</ul>
                        </div>
                        <div class="section-block">
                            <h3>Next Steps</h3>
                            <ul>{next_steps_html}</ul>
                        </div>
                    </div>
                </div>

                <div class="chart-container">
                    <h3>Vulnerability Breakdown</h3>
                    {bar_html}
                </div>
            </div>

            <div class="postscript">
                <strong>Leadership Postscript:</strong> {_esc(res.get('postscript', ''))}
            </div>
        </div>
        """

    return _render_template(results, pie_html, vendor_cards_html)


def _empty_report_html() -> str:
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>TPRM Leadership Report</title></head>
    <body style="background:#0e1117;color:#fafafa;font-family:sans-serif;text-align:center;padding:60px;">
        <h1>TPRM Executive Analysis Report</h1>
        <p>No vendor results were available for this report.</p>
    </body>
    </html>
    """


def _render_template(results, pie_html, vendor_cards_html) -> str:
    critical_count = sum(1 for r in results if (r.get('risk_score') or 'Medium') == 'Critical')

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TPRM Leadership Report</title>
        <style>
            :root {{
                --bg-color: #0e1117;
                --text-main: #fafafa;
                --text-muted: #a3a8b8;
                --card-bg: rgba(255, 255, 255, 0.05);
                --card-border: rgba(255, 255, 255, 0.1);
                --accent: #4f8bf9;
            }}

            body {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: var(--bg-color);
                color: var(--text-main);
                margin: 0;
                padding: 40px 20px;
                line-height: 1.6;
            }}

            .container {{
                max-width: 1200px;
                margin: 0 auto;
            }}

            .header-banner {{
                text-align: center;
                margin-bottom: 50px;
            }}

            h1 {{
                font-size: 2.5rem;
                background: linear-gradient(90deg, #4f8bf9, #9b51e0);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 10px;
            }}

            .overview-panel {{
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 16px;
                padding: 30px;
                margin-bottom: 50px;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
            }}

            .grid-2 {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 30px;
            }}

            @media (max-width: 800px) {{
                .grid-2 {{ grid-template-columns: 1fr; }}
            }}

            .metric-box {{
                background: rgba(0,0,0,0.2);
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                border: 1px solid var(--card-border);
            }}
            .metric-box h3 {{ margin: 0; color: var(--text-muted); font-size: 1rem; }}
            .metric-box .value {{ font-size: 3rem; font-weight: bold; color: var(--text-main); }}

            .vendor-card {{
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 16px;
                padding: 30px;
                margin-bottom: 30px;
                backdrop-filter: blur(10px);
                transition: transform 0.2s ease;
            }}

            .vendor-card:hover {{
                transform: translateY(-2px);
                box-shadow: 0 10px 40px 0 rgba(0, 0, 0, 0.4);
                border-color: rgba(255, 255, 255, 0.2);
            }}

            .card-header {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--card-border);
                padding-bottom: 20px;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 10px;
            }}

            .card-header h2 {{ margin: 0; font-size: 1.8rem; }}

            .risk-badge {{
                padding: 8px 16px;
                border-radius: 30px;
                font-weight: bold;
                letter-spacing: 1px;
                font-size: 0.9rem;
                text-transform: uppercase;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                white-space: nowrap;
            }}

            .section-block {{ margin-bottom: 25px; }}
            .section-block h3 {{ color: var(--accent); margin-bottom: 10px; font-size: 1.1rem; border-bottom: 1px solid var(--card-border); padding-bottom: 5px; }}
            .section-block ul {{ padding-left: 20px; margin: 0; color: var(--text-muted); }}
            .section-block p {{ margin: 0; color: var(--text-muted); }}

            .chart-container {{
                background: rgba(0,0,0,0.2);
                border-radius: 12px;
                padding: 20px;
                border: 1px solid var(--card-border);
            }}

            .postscript {{
                margin-top: 20px;
                padding: 15px;
                background: rgba(79, 139, 249, 0.1);
                border-left: 4px solid var(--accent);
                border-radius: 4px;
                color: #d1e0ff;
                white-space: pre-wrap;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header-banner">
                <h1>TPRM Executive Analysis Report</h1>
                <p style="color: var(--text-muted);">Generated via Claude-powered TPRM Analyzer</p>
            </div>

            <div class="overview-panel grid-2">
                <div>
                    <h2>Portfolio Overview</h2>
                    <div class="metric-box" style="margin-bottom: 20px;">
                        <h3>Total Vendors Assessed</h3>
                        <div class="value">{len(results)}</div>
                    </div>
                    <div class="metric-box">
                        <h3>Critical Vulnerabilities Detected</h3>
                        <div class="value" style="color: #ff4b4b;">{critical_count}</div>
                    </div>
                </div>
                <div class="chart-container" style="display:flex; justify-content:center; align-items:center;">
                    {pie_html}
                </div>
            </div>

            <h2 style="margin-top: 50px; border-bottom: 1px solid var(--card-border); padding-bottom: 10px;">Detailed Vendor Breakdown</h2>

            {vendor_cards_html}

            <div style="text-align: center; margin-top: 50px; color: var(--text-muted); font-size: 0.9rem;">
                <p>This report was generated by the TPRM Analyzer AI. Findings should be reviewed by a qualified risk analyst before action.</p>
            </div>
        </div>
    </body>
    </html>
    """
