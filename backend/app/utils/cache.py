import json
import redis
from app.core.config import settings

_redis = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)

def cache_get(key: str):
    val = _redis.get(key)
    if not val:
        return None
    return json.loads(val)

def cache_set(key: str, value, ttl: int | None = None):
    _redis.set(key, json.dumps(value), ex=ttl or settings.REDIS_TTL_SECONDS)
