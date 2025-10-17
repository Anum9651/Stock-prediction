# app/api/stock.py
from typing import Annotated
from datetime import timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.price import Price
from app.services.yfinance_service import fetch_ohlcv, normalize_ticker
from app.utils.cache import cache_get, cache_set

router = APIRouter(prefix="/api", tags=["stock"])

# Input guards
ALLOWED_INTERVALS = {"1d", "1m", "5m"}
ALLOWED_RANGES = {"1y", "5y", "6mo", "3mo"}  # expand as your service supports more

@router.get("/stock")
def get_stock(
    ticker: Annotated[str, Query(min_length=1)],
    range: Annotated[str, Query()] = "1y",        # consider renaming to 'period' to avoid shadowing built-in
    interval: Annotated[str, Query()] = "1d",
    db: Session = Depends(get_db),
):
    # Validate query params early
    if interval not in ALLOWED_INTERVALS:
        raise HTTPException(
            status_code=422,
            detail=f"invalid interval: {interval}. Allowed: {sorted(ALLOWED_INTERVALS)}",
        )
    if range not in ALLOWED_RANGES:
        raise HTTPException(
            status_code=422,
            detail=f"invalid range: {range}. Allowed: {sorted(ALLOWED_RANGES)}",
        )

    t = normalize_ticker(ticker)
    cache_key = f"stock:{t}:{range}:{interval}"

    # 1) Try cache
    cached = cache_get(cache_key)
    if cached:
        return cached

    # 2) Try DB
    rows = db.execute(
        select(Price)
        .where(Price.ticker == t, Price.interval == interval)
        .order_by(Price.ts.asc())
    ).scalars().all()

    # 3) Backfill if DB empty
    if not rows:
        df = fetch_ohlcv(t, period=range, interval=interval)
        if df.empty:
            raise HTTPException(status_code=404, detail="No data for ticker/interval")

        for _, r in df.iterrows():
            rec = Price(
                ticker=t,
                interval=interval,
                ts=pd.Timestamp(r["ts"]).to_pydatetime(),
                open=float(r["open"]),
                high=float(r["high"]),
                low=float(r["low"]),
                close=float(r["close"]),
                volume=int(r["volume"]),
            )
            try:
                db.add(rec)
                db.commit()
            except IntegrityError:
                db.rollback()

        rows = db.execute(
            select(Price)
            .where(Price.ticker == t, Price.interval == interval)
            .order_by(Price.ts.asc())
        ).scalars().all()

    # 4) Build response
    data = []
    for r in rows:
        ts = r.ts
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        data.append({
            "ts": ts.isoformat(),
            "open": r.open,
            "high": r.high,
            "low": r.low,
            "close": r.close,
            "volume": r.volume,
        })

    payload = {"ticker": t, "interval": interval, "data": data}

    # 5) Cache it
    cache_set(cache_key, payload)
    return payload
