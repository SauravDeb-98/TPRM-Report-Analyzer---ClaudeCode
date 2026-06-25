# TPRM Report Analyzer - container image for Render (or any Docker host)
FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr (so logs show up immediately
# in Render's log viewer) and from writing .pyc files into the image.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first so Docker can cache this layer across builds
# that only change application code.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Render sets $PORT at runtime; default to 8501 (Streamlit's default) for
# local `docker run` testing.
ENV PORT=8501
EXPOSE 8501

# --server.address=0.0.0.0 is required inside a container so Streamlit
# accepts connections from outside localhost.
CMD streamlit run app.py \
    --server.port=${PORT} \
    --server.address=0.0.0.0 \
    --server.headless=true \
    --browser.gatherUsageStats=false
