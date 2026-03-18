from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class AnalyzeRequest:
    area_mu: float
    crop_mode: str
    model_mode: str
    geometry: Optional[Dict[str, Any]] = None
