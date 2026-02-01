from pathlib import Path
import os

UPLOAD_DIR = Path(os.environ.get("NMM_UPLOAD_DIR", "/app/static/uploads"))
