# app/api/types.py
from enum import Enum

class Interval(str, Enum):
    d1 = "1d"
    m1 = "1m"
    m5 = "5m"

class Range(str, Enum):
    y1 = "1y"
    y5 = "5y"
    m6 = "6mo"
    m3 = "3mo"
