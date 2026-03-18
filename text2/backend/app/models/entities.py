from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class SampleRecord:
    id: str
    label_key: str
    crop_mode: str
    feature_vector: Dict[str, Any]


@dataclass
class ReviewRecord:
    id: str
    case_id: str
    reviewer: str
    corrected_label: str
