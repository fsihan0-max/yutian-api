from ..algorithms import legacy_engine


def get_health_response():
    return legacy_engine.health()
