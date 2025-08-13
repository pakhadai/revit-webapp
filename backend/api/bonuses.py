from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from database import get_db
from models.user import User
from models.bonus import DailyBonus
from api.auth import get_current_user
from utils.timezone import get_kyiv_time

router = APIRouter()


# Допоміжна функція з основною логікою для перевірки статусу бонусу
async def _get_bonus_status(user_id: int, db: Session):
    """
    Перевіряє, чи може користувач отримати щоденний бонус.
    Повертає словник з `can_claim` (bool) та `time_left` (int, у секундах).
    """
    now = get_kyiv_time()
    # Знаходимо останнє отримання бонусу для цього користувача
    last_claim = db.query(DailyBonus).filter(DailyBonus.user_id == user_id).first()

    if last_claim:
        last_claimed_at = last_claim.last_claimed_at
        # Переконуємось, що ми порівнюємо об'єкти datetime з однаковими даними про часову зону
        if last_claimed_at.tzinfo is None:
            # Якщо з бази прийшов "наївний" час, вважаємо, що це київський час
            last_claimed_at = get_kyiv_time().tzinfo.localize(last_claimed_at)

        time_since_claim = now - last_claimed_at

        # Перевіряємо, чи минуло 24 години (1 день)
        if time_since_claim < timedelta(days=1):
            time_left = timedelta(days=1) - time_since_claim
            return {"can_claim": False, "time_left": int(time_left.total_seconds())}

    # Якщо бонусів ще не було, або минуло більше 24 годин
    return {"can_claim": True, "time_left": 0}


@router.get("/daily-bonus", summary="Отримати статус щоденного бонусу")
async def get_daily_bonus_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Кінцева точка API для перевірки статусу щоденного бонусу.
    """
    return await _get_bonus_status(current_user.id, db)


@router.post("/daily-bonus", summary="Отримати щоденний бонус")
async def claim_daily_bonus(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Кінцева точка API для отримання щоденного бонусу.
    """
    status_data = await _get_bonus_status(current_user.id, db)
    if not status_data['can_claim']:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bonus already claimed today.")

    bonus_amount = 10  # Кількість бонусів для нарахування
    current_user.bonus_balance += bonus_amount

    last_claim = db.query(DailyBonus).filter(DailyBonus.user_id == current_user.id).first()
    now = get_kyiv_time()

    if last_claim:
        last_claim.last_claimed_at = now
    else:
        new_claim = DailyBonus(user_id=current_user.id, last_claimed_at=now)
        db.add(new_claim)

    db.commit()
    db.refresh(current_user)

    return {"message": "Bonus claimed successfully", "new_balance": current_user.bonus_balance}
