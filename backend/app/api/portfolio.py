# backend/app/api/portfolio.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.portfolio import Portfolio, Holding
from app.models.price import Price  # for summary latest price lookups

router = APIRouter(prefix="/api", tags=["portfolio"])

# ---- Pydantic schemas ----
class HoldingIn(BaseModel):
    ticker: str
    qty: float
    avg_price: float

class HoldingPatch(BaseModel):
    qty: Optional[float] = None
    avg_price: Optional[float] = None

class PortfolioOut(BaseModel):
    id: int
    name: str
    holdings: list[dict]

    class Config:
        from_attributes = True

# ---- Helpers ----
def serialize_portfolio(p: Portfolio) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "holdings": [
            {
                "id": h.id,
                "ticker": h.ticker,
                "qty": float(h.qty),
                "avg_price": float(h.avg_price),
            }
            for h in p.holdings
        ],
    }

# ---- Routes ----
@router.post("/portfolio")
def create_portfolio(payload: dict, db: Session = Depends(get_db)):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="name is required")

    p = Portfolio(name=name)
    try:
        db.add(p)
        db.commit()
        db.refresh(p)
    except IntegrityError:
        db.rollback()
        # name has a UNIQUE constraint -> return 409 instead of 500
        raise HTTPException(status_code=409, detail="Portfolio name already exists")
    return serialize_portfolio(p)

@router.get("/portfolio/{pf_id}")
def get_portfolio(pf_id: int, db: Session = Depends(get_db)):
    p = db.get(Portfolio, pf_id)
    if not p:
        raise HTTPException(status_code=404, detail="portfolio not found")
    _ = p.holdings  # touch relationship to load
    return serialize_portfolio(p)

@router.post("/portfolio/{pf_id}/holdings")
def add_holding(pf_id: int, body: HoldingIn, db: Session = Depends(get_db)):
    p = db.get(Portfolio, pf_id)
    if not p:
        raise HTTPException(status_code=404, detail="portfolio not found")

    h = Holding(
        portfolio_id=p.id,
        ticker=body.ticker.upper().strip(),
        qty=body.qty,
        avg_price=body.avg_price,
    )
    db.add(h)
    db.commit()
    db.refresh(p)
    _ = p.holdings
    return serialize_portfolio(p)

@router.patch("/portfolio/{pf_id}/holdings/{hid}")
def update_holding(pf_id: int, hid: int, patch: HoldingPatch, db: Session = Depends(get_db)):
    p = db.get(Portfolio, pf_id)
    if not p:
        raise HTTPException(status_code=404, detail="portfolio not found")
    h = db.get(Holding, hid)
    if not h or h.portfolio_id != pf_id:
        raise HTTPException(status_code=404, detail="holding not found")

    if patch.qty is not None:
        h.qty = patch.qty
    if patch.avg_price is not None:
        h.avg_price = patch.avg_price

    db.commit()
    db.refresh(p)
    _ = p.holdings
    return serialize_portfolio(p)

@router.delete("/portfolio/{pf_id}/holdings/{hid}")
def delete_holding(pf_id: int, hid: int, db: Session = Depends(get_db)):
    p = db.get(Portfolio, pf_id)
    if not p:
        raise HTTPException(status_code=404, detail="portfolio not found")
    h = db.get(Holding, hid)
    if not h or h.portfolio_id != pf_id:
        raise HTTPException(status_code=404, detail="holding not found")

    db.delete(h)
    db.commit()
    db.refresh(p)
    _ = p.holdings
    return serialize_portfolio(p)

@router.delete("/portfolio/{pf_id}")
def delete_portfolio(pf_id: int, db: Session = Depends(get_db)):
    p = db.get(Portfolio, pf_id)
    if not p:
        # idempotent delete
        return {"ok": True}
    db.delete(p)
    db.commit()
    return {"ok": True}

# ---- Summary ----
@router.get("/portfolio/{pf_id}/summary")
def portfolio_summary(pf_id: int, db: Session = Depends(get_db)):
    """
    Returns per-position PnL plus totals.
    For 'last' price we take the most recent close in the prices table (any interval).
    """
    p = db.get(Portfolio, pf_id)
    if not p:
        raise HTTPException(status_code=404, detail="portfolio not found")
    _ = p.holdings

    positions = []
    total_cost = 0.0
    total_value = 0.0

    for h in p.holdings:
        # latest close for this ticker
        last_row = db.execute(
            select(Price)
            .where(Price.ticker == h.ticker)
            .order_by(Price.ts.desc())
            .limit(1)
        ).scalars().first()

        last = float(last_row.close) if last_row else None
        qty = float(h.qty)
        avg = float(h.avg_price)
        cost = qty * avg
        value = qty * last if last is not None else None
        pnl = (value - cost) if value is not None else None

        total_cost += cost
        if value is not None:
            total_value += value

        positions.append({
            "id": h.id,
            "ticker": h.ticker,
            "qty": qty,
            "avg_price": avg,
            "last": last,
            "cost": cost,
            "value": value,
            "pnl": pnl,
        })

    totals = {
        "cost": total_cost,
        "value": total_value if positions else 0.0,
        "pnl": (total_value - total_cost) if positions else 0.0,
    }

    return {
        "id": p.id,
        "name": p.name,
        "positions": positions,
        "totals": totals,
    }
