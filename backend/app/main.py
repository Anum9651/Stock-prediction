# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import health, stock, indicators, portfolio

app = FastAPI()

# CORS (frontend on 8080)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include routers
for r in (health.router, stock.router, indicators.router, portfolio.router):
    app.include_router(r, prefix="/api")
