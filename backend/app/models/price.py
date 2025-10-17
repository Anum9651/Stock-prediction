from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, BigInteger, Float, TIMESTAMP, UniqueConstraint
from app.core.database import Base

class Price(Base):
    __tablename__ = "prices"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String, nullable=False)
    ts: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    interval: Mapped[str] = mapped_column(String, nullable=False)
    open: Mapped[float | None] = mapped_column(Float(asdecimal=False))
    high: Mapped[float | None] = mapped_column(Float(asdecimal=False))
    low: Mapped[float | None] = mapped_column(Float(asdecimal=False))
    close: Mapped[float | None] = mapped_column(Float(asdecimal=False))
    volume: Mapped[int | None] = mapped_column(BigInteger)

    __table_args__ = (UniqueConstraint("ticker", "ts", "interval", name="uq_ticker_ts_interval"),)
