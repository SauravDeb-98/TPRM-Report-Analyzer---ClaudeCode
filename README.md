# TPRM Report Analyzer

AI-powered Third-Party Risk Management report analysis tool. Upload vendor
risk documents (PDF, Word, Excel), get a structured risk assessment from
Claude, and export the result as a polished PDF, Word doc, or interactive
HTML report.

## What changed in this version

- **AI engine**: switched from a local-only Ollama model to the Anthropic
  Claude API, so the app works in the cloud (no GPU/local model required).
- **Robustness**: hardened file parsing (corrupted/encrypted/oversized files
  now fail with a clear message instead of silently feeding garbage to the
  AI), hardened JSON parsing of the AI's response, fixed several crash bugs
  in the PDF/DOCX/HTML export paths, and replaced the random "vulnerability
  breakdown" chart with one derived from the AI's actual findings.
- **Security**: added an optional shared-password gate (`APP_PASSWORD`) so
  the app isn't wide open to anyone with the link; escaped user/AI-derived
  text in the HTML export to prevent injection.

## 1. Local setup

```bash
git clone <your-repo-url>
cd <repo-folder>
python3 -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY (and optionally APP_PASSWORD)
```

Get an API key at https://console.anthropic.com/settings/keys

Run it:

```bash
export $(cat .env | xargs)   # loads .env into your shell, macOS/Linux
streamlit run app.py
```

Open http://localhost:8501. If you set `APP_PASSWORD`, you'll be asked for
it before the app loads; if you didn't set it, the app skips the gate.

## 2. Deploying so your team can access it via a link (Render)

This repo includes a `Dockerfile`, so Render can build and run it directly.

1. Push this repo to GitHub (Render deploys from a Git repo).
2. Go to https://render.com → **New** → **Web Service**.
3. Connect your GitHub account and select this repository.
4. Render will detect the `Dockerfile` automatically. Settings:
   - **Environment**: Docker
   - **Region**: pick one close to your team
   - **Instance type**: the free tier works for light use; paid tiers avoid
     cold-start sleep delays.
5. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your real key
   - `APP_PASSWORD` = a shared password for your team
   - (optional) `ANTHROPIC_MODEL` if you want a specific Claude model
6. Click **Create Web Service**. Render will build the Docker image and give
   you a URL like `https://tprm-analyzer.onrender.com` — that's the link to
   share with your team. No VPN needed; it's a normal public HTTPS URL, but
   gated by the password you set in step 5.

### Notes on data protection

- The shared password is a basic gate, not full authentication — anyone with
  both the link and the password can use the app. It stops casual/accidental
  access, not a determined attacker. If you need per-person login or audit
  logs, that requires a proper auth layer (e.g. an identity provider), which
  is a larger change.
- Uploaded documents are sent to the Anthropic API for analysis and are not
  stored by this app beyond the current session's memory. Review
  [Anthropic's API data usage policy](https://www.anthropic.com/legal/commercial-terms)
  if your documents contain regulated data.
- The local feedback database (`feedback.db`) is **not persistent** on most
  container platforms, including Render's free tier — it resets on every
  deploy/restart. Treat thumbs up/down feedback as ephemeral, not a system
  of record.
- Set `APP_PASSWORD` to something your team can remember but outsiders can't
  guess. Rotate it if someone leaves the team.

## 3. Running tests

The hardened logic in `analyzer.py` and `document_parser.py` is covered by
test scripts (not part of the deployed app) that check JSON parsing,
malformed AI output, corrupted/encrypted files, and export edge cases. Ask
whoever maintains this repo for `test_*.py` if you want to re-run them after
making changes.
