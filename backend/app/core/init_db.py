from app.core.database import Base, engine
from app.models.price import Price  
from app.models import portfolio

def init_db():
    Base.metadata.create_all(bind=engine)
