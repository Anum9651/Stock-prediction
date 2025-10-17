# app/api/indicators.py
from typing import Annotated, List, Optional, Dict, Any
from datetime import timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.price import Price
from app.utils.cache import cache_get, cache_set
from app.api.types import Interval, Range  # enums you already have

router = APIRouter(prefix="/api", tags=["indicators"])

# --- indicator helpers --------------------------------------------------------
def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=window).mean()

def ema(series: pd.Series, window: int) -> pd.Series:
    return series.ewm(span=window, adjust=False).mean()

def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def bollinger(series: pd.Series, window: int = 20, stds: float = 2.0):
    mid = sma(series, window)
    st = series.rolling(window=window, min_periods=window).std()
    up = mid + stds * st
    lo = mid - stds * st
    return mid, up, lo

# --- endpoint -----------------------------------------------------------------
@router.get("/indicators")
def get_indicators(
    ticker: Annotated[str, Query(min_length=1)],
    range: Range = Query(Range.y1),                   # kept for cache-key symmetry
    interval: Interval = Query(Interval.d1),
    sma: Optional[List[int]] = Query(None, description="e.g. sma=20&sma=50"),
    ema: Optional[List[int]] = Query(None, description="e.g. ema=12&ema=26"),
    rsi_period: int = Query(14, ge=2, le=400),
    bb_window: int = Query(20, ge=5, le=400),
    bb_std: float = Query(2.0, ge=0.5, le=10.0),
    db: Session = Depends(get_db),
):
    # defaults, if not provided
    sma = sma or [20, 50]
    ema = ema or [12, 26]

    # deterministic cache key (order of lists doesn’t matter)
    key = (
        f"ind:{ticker.upper()}:{range.value}:{interval.value}:"
        f"sma={','.join(map(str, sorted(sma)))}:"
        f"ema={','.join(map(str, sorted(ema)))}:"
        f"rsi={rsi_period}:bb={bb_window}x{bb_std}"
    )
    cached = cache_get(key)
    if cached:
        return cached

    # pull close prices from DB
    rows = (
        db.execute(
            select(Price)
            .where(Price.ticker == ticker.upper(), Price.interval == interval.value)
            .order_by(Price.ts.asc())
        )
        .scalars()
        .all()
    )
    if not rows:
        # keep it clear for users
        raise HTTPException(
            status_code=404,
            detail="No price data available. Call /api/stock first to backfill.",
        )

    # build DataFrame
    df = pd.DataFrame(
        {
            "ts": [r.ts if r.ts.tzinfo else r.ts.replace(tzinfo=timezone.utc) for r in rows],
            "close": [r.close for r in rows],
        }
    ).set_index("ts")

    out: Dict[str, Any] = {"ticker": ticker.upper(), "interval": interval.value, "indicators": {}}

    # SMAs
    for w in sma:
        s = sma if False else None  # silence name clash in some editors
        ser = globals()["sma"](df["close"], w).dropna()
        out["indicators"][f"sma{w}"] = [{"ts": ts.isoformat(), "sma" + str(w): float(v)} for ts, v in ser.items()]

    # EMAs
    for w in ema:
        ser = globals()["ema"](df["close"], w).dropna()
        out["indicators"][f"ema{w}"] = [{"ts": ts.isoformat(), "ema" + str(w): float(v)} for ts, v in ser.items()]

    # RSI
    rsi_ser = rsi(df["close"], rsi_period).dropna()
    out["indicators"]["rsi"] = [{"ts": ts.isoformat(), "rsi": float(v)} for ts, v in rsi_ser.items()]

    # Bollinger
    mid, up, lo = bollinger(df["close"], bb_window, bb_std)
    bb = pd.concat([mid.rename("mid"), up.rename("upper"), lo.rename("lower")], axis=1).dropna()
    out["indicators"]["bb"] = [
        {"ts": ts.isoformat(), "mid": float(r.mid), "upper": float(r.upper), "lower": float(r.lower)}
        for ts, r in bb.iterrows()
    ]

    cache_set(key, out)
    return out
