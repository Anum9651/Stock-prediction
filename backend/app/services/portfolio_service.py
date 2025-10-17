# backend/app/services/portfolio_service.py
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc
from app.models.portfolio import Portfolio, Holding
from app.models.price import Price
from app.services.yfinance_service import fetch_ohlcv, normalize_ticker

def create_portfolio(db: Session, name: str) -> Dict[str, Any]:
    p = Portfolio(name=name.strip())
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name, "created_at": p.created_at.isoformat()}

def get_portfolio(db: Session, pid: int) -> Dict[str, Any] | None:
    p = db.get(Portfolio, pid)
    if not p:
        return None
    return {
        "id": p.id,
        "name": p.name,
        "created_at": p.created_at.isoformat(),
        "holdings": [{"id": h.id, "ticker": h.ticker, "qty": h.qty, "avg_price": h.avg_price} for h in p.holdings],
    }

def add_holding(db: Session, pid: int, ticker: str, qty: float, avg_price: float) -> Dict[str, Any]:
    t = normalize_ticker(ticker)
    h = Holding(portfolio_id=pid, ticker=t, qty=qty, avg_price=avg_price)
    db.add(h)
    db.commit()
    db.refresh(h)
    return {"id": h.id, "ticker": h.ticker, "qty": h.qty, "avg_price": h.avg_price}

def delete_holding(db: Session, hid: int) -> bool:
    h = db.get(Holding, hid)
    if not h:
        return False
    db.delete(h)
    db.commit()
    return True

def _latest_close_for(db: Session, ticker: str) -> float | None:
    # Try latest stored 1d bar
    row = db.execute(
        select(Price.close)
        .where(Price.ticker == ticker, Price.interval == "1d")
        .order_by(desc(Price.ts))
        .limit(1)
    ).scalar_one_or_none()
    if row is not None:
        return float(row)

    # Fallback: fetch recent and persist (period 5d)
    df = fetch_ohlcv(ticker, period="5d", interval="1d")
    if df is None or df.empty:
        return None
    # persist
    from app.models.price import Price as PriceModel
    for _, r in df.iterrows():
        db.merge(PriceModel(
            ticker=ticker, interval="1d",
            ts=r["ts"].to_pydatetime(),
            open=float(r["open"]), high=float(r["high"]),
            low=float(r["low"]), close=float(r["close"]),
            volume=int(r["volume"])
        ))
    db.commit()
    return float(df.iloc[-1]["close"])

def summary(db: Session, pid: int) -> Dict[str, Any] | None:
    p = db.get(Portfolio, pid)
    if not p:
        return None

    positions: List[Dict[str, Any]] = []
    total_cost = 0.0
    total_value = 0.0

    for h in p.holdings:
        last = _latest_close_for(db, h.ticker)
        if last is None:
            last = 0.0
        value = last * h.qty
        cost = h.avg_price * h.qty
        pnl = value - cost
        positions.append({
            "id": h.id, "ticker": h.ticker,
            "qty": h.qty, "avg_price": h.avg_price,
            "last": last, "value": value, "cost": cost, "pnl": pnl,
        })
        total_cost += cost
        total_value += value

    return {
        "id": p.id, "name": p.name,
        "positions": positions,
        "totals": {
            "cost": total_cost,
            "value": total_value,
            "pnl": total_value - total_cost,
        }
    }
