import json
import requests
import re

def analyze_vendor_document(document_text, custom_prompt):
    """
    Sends the document text and custom prompt to a local Ollama instance,
    requesting a structured JSON response for TPRM analysis.
    """
    prompt = f"""
    You are an expert Third-Party Risk Management (TPRM) AI. 
    Analyze the provided vendor document text. 
    Adhere to the user's custom instructions if provided.
    
    Extract the following information and return ONLY a valid JSON object with the following schema:
    {{
        "vendor": "Vendor Name",
        "scope": "Services provided and data types handled",
        "risk_score": "Critical", "High", "Medium", or "Low",
        "findings": ["Finding 1", "Finding 2"],
        "next_steps": ["Step 1", "Step 2"],
        "summary": "2-3 sentences explaining their context.",
        "postscript": "A comprehensive, 2-3 paragraph executive brief written from your perspective as the TPRM Lead. It must detail the strategic business impact of the findings, assess the residual risk to the organization, propose a clear mitigation strategy, and provide a definitive 'go/no-go' recommendation or conditional approval status for leadership."
    }}

    Custom Instructions from User: {custom_prompt}
    
    --- Vendor Document Text ---
    {document_text[:15000]}
    """
    
    try:
        url = "http://localhost:11434/api/generate"
        payload = {
            "model": "llama3.2",
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        
        response = requests.post(url, json=payload, timeout=120)
        
        if response.status_code != 200:
            return {"error": f"Ollama Server Error {response.status_code}: Make sure Ollama is running and 'llama3.2' is installed."}
            
        data = response.json()
        text = data.get("response", "").strip()
        
        # Robust JSON extraction using regex to handle chatty local models
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            clean_json = match.group(0)
        else:
            return {"error": f"Ollama returned an invalid format: {text[:200]}..."}
            
        result = json.loads(clean_json)
        return result
    except requests.exceptions.ConnectionError:
        return {"error": "Could not connect to Ollama. Please ensure the Ollama app is running on your computer."}
    except Exception as e:
        return {"error": f"Ollama Processing Error: {str(e)}"}
