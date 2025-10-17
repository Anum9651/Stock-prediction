# app/services/yfinance_service.py
import time
from datetime import timezone
from typing import Literal, Optional

import pandas as pd
import requests
import yfinance as yf
from fastapi import HTTPException  # map upstream problems to clean HTTP codes

Period = Literal["5d","1mo","3mo","6mo","1y","2y","5y","10y","ytd","max"]

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": _UA,
        "Accept": "application/json, text/plain, */*",
    })
    return s

def normalize_ticker(t: str) -> str:
    return t.strip().upper()

def _download_yf(ticker: str, period: Period, interval: str) -> pd.DataFrame:
    """Try Yahoo via yfinance with polite retries/backoff."""
    backoffs = [0.0, 1.0, 2.0, 4.0]
    last_err: Optional[str] = None

    for delay in backoffs:
        if delay:
            time.sleep(delay)

        try:
            df = yf.download(
                normalize_ticker(ticker),
                period=period,
                interval=interval,
                auto_adjust=False,
                progress=False,
                threads=False,          # avoid concurrency oddities
                session=_session(),
            )
            if df is not None and not df.empty:
                return df
            last_err = "empty dataframe"
        except requests.exceptions.Timeout:
            # upstream didn’t respond in time
            raise HTTPException(status_code=504, detail="Upstream timeout")
        except requests.exceptions.HTTPError as e:
            code = getattr(getattr(e, "response", None), "status_code", None)
            if code == 429:
                # rate limited
                raise HTTPException(status_code=503, detail="Upstream rate-limited; try again soon")
            raise HTTPException(status_code=502, detail=f"Upstream provider error ({code})")
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"

    # If all retries failed without a specific HTTPException above:
    raise HTTPException(status_code=502, detail=f"Upstream provider error: {last_err}")

def _stooq_fallback(ticker: str, period: Period, interval: str) -> pd.DataFrame:
    """
    Simple fallback via Stooq (daily/weekly/monthly only).
    If pandas-datareader isn't installed, returns empty DF.
    """
    try:
        from pandas_datareader.stooq import StooqDailyReader
    except Exception:
        return pd.DataFrame()

    # crude translation of period to start date
    end = pd.Timestamp.utcnow().normalize()
    months = {"5d":0, "1mo":1, "3mo":3, "6mo":6, "1y":12, "2y":24, "5y":60, "10y":120, "ytd":12, "max":240}
    start = end - pd.DateOffset(months=months.get(period, 12))

    rdr = StooqDailyReader(symbols=normalize_ticker(ticker), start=start, end=end)
    df = rdr.read().sort_index()
    if df is None or df.empty:
        return pd.DataFrame()

    df = df.rename(columns={"Open":"Open","High":"High","Low":"Low","Close":"Close","Volume":"Volume"})
    return df

def fetch_ohlcv(ticker: str, period: Period = "1y", interval: str = "1d") -> pd.DataFrame:
    """
    Returns a DataFrame with columns: ts, open, high, low, close, volume (UTC).
    Tries Yahoo first with polite headers/backoff; if blocked/empty, falls back to Stooq for daily bars.
    """
    try:
        df = _download_yf(ticker, period, interval)
    except HTTPException as he:
        # For daily/weekly/monthly, try a best-effort fallback; otherwise bubble up
        if interval in ("1d", "1wk", "1mo"):
            df = _stooq_fallback(ticker, period, interval)
            if df is None or df.empty:
                raise he
        else:
            raise he

    if df is None or df.empty:
        # yfinance sometimes returns empty silently -> treat as no data
        raise HTTPException(status_code=404, detail="No data for ticker/interval")

    # normalize columns
    df = df.rename(columns={
        "Open":"open","High":"high","Low":"low","Close":"close","Volume":"volume"
    })

    # ensure datetime index is tz-aware UTC
    idx = df.index
    if getattr(idx, "tz", None) is None:
        idx = idx.tz_localize(timezone.utc)
    else:
        idx = idx.tz_convert(timezone.utc)
    df.index = idx

    df = df.reset_index().rename(columns={"Date":"ts","Datetime":"ts"})
    cols = ["ts","open","high","low","close","volume"]
    return df[cols].dropna()
