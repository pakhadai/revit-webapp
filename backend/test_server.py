# Тестовий сервер для перевірки промокодів
from fastapi import FastAPI
from api import promo_codes

app = FastAPI()
app.include_router(promo_codes.router, prefix="/api/promo-codes")

@app.get("/")
async def root():
    return {"message": "Test server for promo codes"}

if __name__ == "__main__":
    import uvicorn
    print("Запускаємо тестовий сервер на http://localhost:8002")
    print("Перевірте: http://localhost:8002/api/promo-codes/")
    uvicorn.run(app, host="0.0.0.0", port=8002)
