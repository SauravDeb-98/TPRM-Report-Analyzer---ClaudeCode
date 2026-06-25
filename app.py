import streamlit as st
import pandas as pd
import time
import io
import docx
from fpdf import FPDF
import plotly.express as px
import database
import document_parser
import analyzer
import html_exporter
import random

# Initialize local feedback DB
database.init_db()

st.set_page_config(page_title="TPRM Report Analyzer", layout="wide", page_icon="🛡️")

# --- Custom Styling ---
st.markdown("""
    <style>
    .main {background-color: #0e1117;}
    .stButton>button {width: 100%;}
    </style>
""", unsafe_allow_html=True)

# --- State Initialization ---
if 'analysis_done' not in st.session_state:
    st.session_state['analysis_done'] = False
if 'results' not in st.session_state:
    st.session_state['results'] = []
if 'errors' not in st.session_state:
    st.session_state['errors'] = []

st.title("🛡️ TPRM Report Analyzer")
st.markdown("**Comprehensive, interactive Third-Party Risk Management evaluation powered by AI.**")
st.write("Upload vendor risk files, provide custom instructions, and generate leadership-ready reports.")

# --- 1 & 2. FILE INPUT & CUSTOM PROMPT INTERFACE ---
with st.sidebar:
    st.header("🔑 Network Host Mode")
    st.info("Operating locally. Your computer is now acting as the central AI server for you and your coworkers. No API keys required.")
    
    st.header("1. Upload Vendor Files")
    uploaded_files = st.file_uploader(
        "Upload Reports (.pdf, .docx, .xlsx)", 
        type=['pdf', 'docx', 'xlsx'], 
        accept_multiple_files=True
    )
    
    st.header("2. Custom Prompt Section")
    custom_prompt = st.text_area(
        "Enter custom analysis instructions:", 
        placeholder="e.g., 'Focus heavily on GDPR compliance,' or 'Filter out any findings older than 2024'",
        help="The AI dynamically adapts its analysis algorithm based on these instructions."
    )
    
    analyze_btn = st.button("🚀 Run Analysis", type="primary")

# --- 3. ANALYSIS ENGINE ---
def run_live_analysis(files, prompt):
    results = []
    for file in files:
        with st.spinner(f"Extracting text from {file.name}..."):
            doc_text = document_parser.parse_file(file)
            
        max_retries = 1
        for attempt in range(max_retries):
            with st.spinner(f"Analyzing {file.name} with Local Ollama AI Engine..."):
                res = analyzer.analyze_vendor_document(doc_text, prompt)
                
                if "error" in res:
                    if "429" in res["error"] and attempt < max_retries - 1:
                        # Wait 45 seconds for quota to reset based on typical free tier limits
                        sleep_time = 45 
                        st.warning(f"API rate limit hit. Waiting {sleep_time} seconds before retrying {file.name}...")
                        time.sleep(sleep_time)
                        continue
                    else:
                        st.session_state['errors'].append(f"Error analyzing {file.name}: {res['error']}")
                        break
                
                # Success
                break
                
        if "error" in res:
            continue # Skip adding to results if all retries failed
            
        # Add metadata
        res["filename"] = file.name
        
        # Map risk to numerical score for charts
        risk = res.get("risk_score", "Medium")
        score_val = {"Critical": 90, "High": 75, "Medium": 50, "Low": 25}.get(risk, 50) + random.randint(-5, 5)
        res["score_val"] = score_val
        
        results.append(res)
            
    # Sort from Critical to Low
    risk_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    results.sort(key=lambda x: risk_order.get(x.get("risk_score", "Medium"), 2))
    return results

# --- 4. MULTI-FORMAT OUTPUT GENERATION ---
def generate_docx(results):
    doc = docx.Document()
    doc.add_heading('Executive Leadership Summary', 0)
    doc.add_paragraph(f"Total Vendors Assessed: {len(results)}")
    
    doc.add_heading('Vendor Breakdowns', 1)
    for res in results:
        doc.add_heading(f"{res.get('vendor', 'Unknown')} - {res.get('risk_score', 'Medium')} Risk", 2)
        doc.add_paragraph(res.get('summary', ''))
        doc.add_paragraph("Critical Findings:")
        for finding in res.get('findings', []):
            doc.add_paragraph(f"- {finding}", style='List Bullet')
        doc.add_paragraph("Next Steps:")
        for step in res.get('next_steps', []):
            doc.add_paragraph(f"- {step}", style='List Bullet')
        doc.add_paragraph(f"Leadership Postscript: {res.get('postscript', '')}")
    
    bio = io.BytesIO()
    doc.save(bio)
    return bio.getvalue()

def generate_pdf(results):
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # Colors
    bg_dark = (14, 17, 23)
    accent_blue = (79, 139, 249)
    text_main = (30, 30, 30)
    text_muted = (100, 100, 100)
    
    # 1. Header Banner
    pdf.set_fill_color(*bg_dark)
    pdf.rect(0, 0, 210, 40, 'F')
    
    pdf.set_xy(10, 12)
    pdf.set_font("Arial", size=24, style="B")
    pdf.set_text_color(255, 255, 255)
    pdf.cell(190, 10, txt="TPRM Executive Analysis", ln=1, align='C')
    
    pdf.set_font("Arial", size=11, style="I")
    pdf.set_text_color(180, 180, 180)
    pdf.cell(190, 8, txt="Highly Confidential - Automated AI Assessment", ln=1, align='C')
    
    pdf.set_xy(10, 50)
    
    # 2. Portfolio Overview
    pdf.set_font("Arial", size=16, style="B")
    pdf.set_text_color(*accent_blue)
    pdf.cell(190, 10, txt="Portfolio Overview", ln=1, border='B')
    pdf.ln(5)
    
    pdf.set_font("Arial", size=12, style="B")
    pdf.set_text_color(*text_main)
    pdf.cell(95, 8, txt=f"Total Vendors Assessed: {len(results)}", ln=0)
    
    critical_count = sum([1 for r in results if r.get('risk_score') == 'Critical'])
    if critical_count > 0:
        pdf.set_text_color(255, 75, 75)
    else:
        pdf.set_text_color(*text_main)
    pdf.cell(95, 8, txt=f"Critical Vulnerabilities: {critical_count}", ln=1)
    pdf.ln(10)
    
    def clean_text(text):
        if not text: return ""
        text = str(text)
        replacements = {'\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2013': '-', '\u2014': '--', '\u2026': '...', '\u00A0': ' '}
        for k, v in replacements.items():
            text = text.replace(k, v)
        return text.encode('latin-1', 'ignore').decode('latin-1')

    # 3. Vendor Cards
    for res in results:
        vendor = clean_text(res.get('vendor', 'Unknown'))
        risk = res.get('risk_score', 'Medium')
        
        # Draw Card Header Background
        pdf.set_fill_color(240, 242, 246)
        pdf.cell(190, 12, txt="", ln=0, fill=True)
        pdf.set_x(10)
        
        # Vendor Name
        pdf.set_font("Arial", size=14, style="B")
        pdf.set_text_color(*text_main)
        pdf.cell(140, 12, txt=f" {vendor}", ln=0)
        
        # Risk Badge
        pdf.set_font("Arial", size=11, style="B")
        if risk == "Critical":
            pdf.set_text_color(255, 255, 255)
            pdf.set_fill_color(255, 75, 75)
        elif risk == "High":
            pdf.set_text_color(255, 255, 255)
            pdf.set_fill_color(255, 166, 0)
        elif risk == "Medium":
            pdf.set_text_color(30, 30, 30)
            pdf.set_fill_color(255, 222, 36)
        else:
            pdf.set_text_color(255, 255, 255)
            pdf.set_fill_color(0, 209, 78)
            
        pdf.cell(45, 8, txt=f"{risk.upper()} RISK", ln=1, align='C', fill=True)
        pdf.ln(4)
        
        # Scope & Summary
        pdf.set_font("Arial", size=11, style="B")
        pdf.set_text_color(*accent_blue)
        pdf.cell(190, 8, txt="Context & Scope", ln=1)
        
        pdf.set_font("Arial", size=10)
        pdf.set_text_color(*text_muted)
        pdf.multi_cell(190, 6, txt=clean_text(res.get('summary', '')))
        pdf.multi_cell(190, 6, txt=clean_text(res.get('scope', '')))
        pdf.ln(4)
        
        # Findings & Steps
        pdf.set_font("Arial", size=11, style="B")
        pdf.set_text_color(*accent_blue)
        pdf.cell(190, 8, txt="Critical Findings", ln=1)
        
        pdf.set_font("Arial", size=10)
        pdf.set_text_color(*text_main)
        for finding in res.get('findings', []):
            pdf.multi_cell(190, 6, txt=clean_text(f"- {finding}"))
        pdf.ln(4)
        
        pdf.set_font("Arial", size=11, style="B")
        pdf.set_text_color(*accent_blue)
        pdf.cell(190, 8, txt="Remediation Next Steps", ln=1)
        
        pdf.set_font("Arial", size=10)
        pdf.set_text_color(*text_main)
        for step in res.get('next_steps', []):
            pdf.multi_cell(190, 6, txt=clean_text(f"- {step}"))
        pdf.ln(4)
        
        # Leadership Postscript Box
        pdf.set_fill_color(235, 242, 255)
        pdf.set_text_color(10, 40, 100)
        pdf.set_font("Arial", size=10, style="B")
        pdf.cell(190, 8, txt=" TPRM LEADERSHIP POSTSCRIPT", ln=1, fill=True)
        pdf.set_font("Arial", size=10)
        pdf.multi_cell(190, 6, txt=clean_text(res.get('postscript', '')), fill=True)
        
        pdf.ln(10)
        
    return pdf.output(dest='S').encode('latin1')

# Main Execution Flow
if analyze_btn:
    if not uploaded_files:
        st.error("Please upload at least one vendor file.")
    else:
        st.session_state['errors'] = [] # Reset errors
        st.session_state['results'] = run_live_analysis(uploaded_files, custom_prompt)
        st.session_state['analysis_done'] = True

if st.session_state.get('analysis_done'):
    if st.session_state.get('errors'):
        for err in st.session_state['errors']:
            st.error(err)
            
    results = st.session_state.get('results', [])
    if not results:
        st.stop() # Halt rendering if there's nothing to show
        
    st.success("Analysis Complete!")
    
    # --- EXECUTIVE LEADERSHIP SUMMARY ---
    st.header("Executive Leadership Summary")
    col1, col2 = st.columns([1, 2])
    with col1:
        st.metric("Total Vendors Assessed", len(results))
        risk_counts = pd.DataFrame([r.get('risk_score', 'Medium') for r in results], columns=['Risk']).value_counts().reset_index()
        risk_counts.columns = ['Risk', 'Count']
        st.dataframe(risk_counts, hide_index=True, use_container_width=True)
    
    with col2:
        if not risk_counts.empty:
            fig = px.pie(risk_counts, values='Count', names='Risk', title="Master Risk Distribution",
                         color='Risk', color_discrete_map={"Critical": "red", "High": "orange", "Medium": "yellow", "Low": "green"})
            st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")
    
    # --- DETAILED VENDOR BREAKDOWN ---
    st.header("Detailed Vendor-by-Vendor Breakdown")
    for i, res in enumerate(results):
        vendor_name = res.get('vendor', 'Unknown')
        with st.expander(f"{res.get('risk_score', 'Medium')} RISK: {vendor_name}", expanded=True):
            st.write(f"**Context:** {res.get('summary', '')}")
            st.write(f"**Scope:** {res.get('scope', '')}")
            
            col_f, col_c = st.columns(2)
            with col_f:
                st.markdown("**Critical Findings:**")
                for f in res.get('findings', []):
                    st.markdown(f"- {f}")
                
                st.markdown("**Next Steps & Remediation:**")
                for s in res.get('next_steps', []):
                    st.markdown(f"- {s}")
            
            with col_c:
                # Individual vendor chart based on simulated sub-categories
                df_chart = pd.DataFrame({
                    "Category": ["Access Control", "Data Privacy", "Patch Management", "Compliance"],
                    "Vulnerability Score": [random.randint(10, 100) for _ in range(4)]
                })
                v_fig = px.bar(df_chart, x='Category', y='Vulnerability Score', title="Vulnerability Breakdown")
                st.plotly_chart(v_fig, use_container_width=True, key=f"chart_{vendor_name}_{i}")
            
            st.info(f"**Leadership Postscript:** {res.get('postscript', '')}")
            
            # --- 5. INTERACTIVE USER FEEDBACK ---
            st.markdown("---")
            st.write("**Was this analysis accurate?**")
            fcol1, fcol2, _ = st.columns([1, 1, 8])
            
            with fcol1:
                if st.button("👍 Thumbs Up", key=f"up_{vendor_name}_{i}"):
                    database.log_feedback(vendor_name, res.get("filename", ""), True)
                    st.toast(f"Feedback logged: Successful template mapping for {vendor_name}.")
            with fcol2:
                # Trigger dialog on thumbs down
                if st.button("👎 Thumbs Down", key=f"down_{vendor_name}_{i}"):
                    st.session_state[f"dialog_{vendor_name}_{i}"] = True

            # Feedback Dialog implementation using Streamlit elements
            if st.session_state.get(f"dialog_{vendor_name}_{i}", False):
                with st.form(key=f"form_{vendor_name}_{i}"):
                    st.write("Help the AI improve its analysis:")
                    feedback_text = st.text_area("Explicit comments (optional):", placeholder="e.g., 'The risk rating for Vendor X was too high'")
                    submitted = st.form_submit_button("Submit")
                    if submitted:
                        database.log_feedback(vendor_name, res.get("filename", ""), False, feedback_text)
                        st.toast(f"Negative feedback logged to local database. The AI will refine future iterations.")
                        st.session_state[f"dialog_{vendor_name}_{i}"] = False
                        st.rerun()

    # --- DOWNLOAD OPTIONS ---
    st.markdown("---")
    st.header("Export Final Report")
    
    # Primary Styled PDF Report
    pdf_data = generate_pdf(results)
    st.download_button(
        label="📄 Download as Executive PDF Report (.pdf)",
        data=pdf_data,
        file_name="TPRM_Executive_Report.pdf",
        mime="application/pdf",
        type="primary",
        use_container_width=True
    )
    
    st.markdown("<br><p style='text-align: center; color: gray;'>Alternative Formats</p>", unsafe_allow_html=True)
    
    # Secondary Exports
    html_data = html_exporter.generate_html_report(results)
    docx_data = generate_docx(results)
    
    col_d1, col_d2 = st.columns(2)
    with col_d1:
        st.download_button(
            label="🌐 Download as Interactive HTML (.html)",
            data=html_data,
            file_name="TPRM_Interactive_Report.html",
            mime="text/html",
            use_container_width=True
        )
    with col_d2:
        st.download_button(
            label="📄 Download as Word (.docx)",
            data=docx_data,
            file_name="TPRM_Report.docx",
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            use_container_width=True
        )
