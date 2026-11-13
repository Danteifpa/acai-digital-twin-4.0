import os
import sys
from pathlib import Path

os.environ.setdefault("ACAI_DB", ":memory:")  # testes nunca tocam o banco real
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
