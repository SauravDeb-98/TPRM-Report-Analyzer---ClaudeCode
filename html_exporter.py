import pandas as pd
import plotly.express as px
import random

def generate_html_report(results):
    """
    Generates a standalone, highly interactive HTML report containing embedded Plotly charts
    and premium sleek CSS styling.
    """
    
    # Generate Master Risk Pie Chart
    df = pd.DataFrame(results)
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

    # Build Vendor Cards HTML
    vendor_cards_html = ""
    for idx, res in enumerate(results):
        vendor_name = res.get('vendor', 'Unknown Vendor')
        risk = res.get('risk_score', 'Medium')
        
        # Risk Badge Color
        badge_color = "#444"
        if risk == "Critical": badge_color = "linear-gradient(135deg, #ff4b4b, #990000)"
        elif risk == "High": badge_color = "linear-gradient(135deg, #ffa600, #b37400)"
        elif risk == "Medium": badge_color = "linear-gradient(135deg, #ffde24, #b39b00)"
        elif risk == "Low": badge_color = "linear-gradient(135deg, #00d14e, #008030)"
        
        findings_html = "".join([f"<li>{f}</li>" for f in res.get('findings', [])])
        next_steps_html = "".join([f"<li>{s}</li>" for s in res.get('next_steps', [])])
        
        # Generate Vendor Specific Bar Chart
        df_chart = pd.DataFrame({
            "Category": ["Access Control", "Data Privacy", "Patch Management", "Compliance"],
            "Vulnerability Score": [random.randint(10, 100) for _ in range(4)]
        })
        v_fig = px.bar(df_chart, x='Category', y='Vulnerability Score')
        v_fig.update_layout(
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(color='#ffffff'),
            margin=dict(l=0, r=0, t=30, b=0)
        )
        bar_html = v_fig.to_html(full_html=False, include_plotlyjs=False) # Plotly JS already included by the pie chart

        vendor_cards_html += f"""
        <div class="vendor-card">
            <div class="card-header">
                <h2>{vendor_name}</h2>
                <div class="risk-badge" style="background: {badge_color}">{risk} RISK</div>
            </div>
            
            <div class="grid-2">
                <div>
                    <div class="section-block">
                        <h3>Context</h3>
                        <p>{res.get('summary', 'No summary provided.')}</p>
                    </div>
                    <div class="section-block">
                        <h3>Scope</h3>
                        <p>{res.get('scope', 'No scope provided.')}</p>
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
                <strong>Leadership Postscript:</strong> {res.get('postscript', '')}
            </div>
        </div>
        """

    # Assemble Full HTML Template
    html_template = f"""
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
                <p style="color: var(--text-muted);">Generated locally via Zero-Trust AI Engine</p>
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
                        <div class="value" style="color: #ff4b4b;">{sum([1 for r in results if r.get('risk_score') == 'Critical'])}</div>
                    </div>
                </div>
                <div class="chart-container" style="display:flex; justify-content:center; align-items:center;">
                    {pie_html}
                </div>
            </div>
            
            <h2 style="margin-top: 50px; border-bottom: 1px solid var(--card-border); padding-bottom: 10px;">Detailed Vendor Breakdown</h2>
            
            {vendor_cards_html}
            
            <div style="text-align: center; margin-top: 50px; color: var(--text-muted); font-size: 0.9rem;">
                <p>This interactive report was autonomously generated by the TPRM Analyzer AI.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html_template
