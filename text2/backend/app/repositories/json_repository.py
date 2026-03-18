from pathlib import Path
import json

from ..config.settings import DATA_FIXTURE_DIR


SAMPLES_FILE = DATA_FIXTURE_DIR / "sample_labels.json"
REVIEWS_FILE = DATA_FIXTURE_DIR / "review_records.json"


def ensure_data_files() -> None:
    DATA_FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    for path in (SAMPLES_FILE, REVIEWS_FILE):
        if not path.exists():
            path.write_text("[]", encoding="utf-8")


def read_json_list(path: Path):
    ensure_data_files()
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def write_json_list(path: Path, data):
    ensure_data_files()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
