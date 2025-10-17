# create tables in the existing DB (sp / sp)
docker compose exec db psql -U sp -d sp -c "
CREATE TABLE IF NOT EXISTS portfolios (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS holdings (
  id SERIAL PRIMARY KEY,
  portfolio_id INT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  qty NUMERIC NOT NULL CHECK (qty >= 0),
  avg_price NUMERIC NOT NULL CHECK (avg_price >= 0)
);

CREATE INDEX IF NOT EXISTS ix_holdings_portfolio_id ON holdings(portfolio_id);
"
