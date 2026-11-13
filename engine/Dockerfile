FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY acai_twin/ acai_twin/
COPY main.py .

ENV PORT=8000
ENV ACAI_DB=/app/dados/acai_twin.db
EXPOSE 8000

# Render/Fly definem $PORT; localmente usa 8000.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
