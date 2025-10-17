# backend/app/models/portfolio.py
from sqlalchemy import Column, Integer, Text, ForeignKey, Numeric, CheckConstraint, DateTime, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    holdings = relationship("Holding", back_populates="portfolio", cascade="all, delete-orphan")

class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    ticker = Column(Text, nullable=False)
    qty = Column(Numeric, nullable=False)
    avg_price = Column(Numeric, nullable=False)

    __table_args__ = (
        CheckConstraint("qty >= 0", name="chk_qty_nonneg"),
        CheckConstraint("avg_price >= 0", name="chk_avg_price_nonneg"),
    )

    portfolio = relationship("Portfolio", back_populates="holdings")
