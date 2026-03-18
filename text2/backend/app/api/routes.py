from flask import Blueprint

from ..services.health_service import get_health_response
from ..services.sample_service import handle_samples
from ..services.review_service import handle_reviews
from ..services.analysis_service import handle_analyze

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/health")
def health():
    return get_health_response()


@api_bp.route("/samples", methods=["GET", "POST"])
def samples():
    return handle_samples()


@api_bp.route("/reviews", methods=["GET", "POST"])
def reviews():
    return handle_reviews()


@api_bp.route("/analyze", methods=["POST"])
def analyze():
    return handle_analyze()
