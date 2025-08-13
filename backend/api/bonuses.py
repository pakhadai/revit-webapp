from utils.timezone import get_kyiv_time, get_kyiv_midnight, seconds_until_kyiv_midnight


@router.post("/daily-bonus")
async def claim_daily_bonus(
        current_user: User = Depends(get_current_user_dependency),
        session: AsyncSession = Depends(get_session)
):
    """Отримати щоденний бонус (за київським часом)"""

    # Отримуємо поточний київський час
    kyiv_now = get_kyiv_time()
    kyiv_today = kyiv_now.date()

    # Перевіряємо чи вже отримували сьогодні
    result = await session.execute(
        select(DailyBonus).where(
            DailyBonus.user_id == current_user.id
        ).order_by(DailyBonus.claimed_at.desc())
    )
    last_claim = result.scalar_one_or_none()

    if last_claim:
        # Конвертуємо час останнього отримання в київський
        last_claim_kyiv = utc_to_kyiv(last_claim.claimed_at)

        # Якщо вже отримували сьогодні за київським часом
        if last_claim_kyiv.date() == kyiv_today:
            seconds_left = seconds_until_kyiv_midnight()
            hours_left = seconds_left // 3600
            minutes_left = (seconds_left % 3600) // 60

            raise HTTPException(
                status_code=400,
                detail=f"Ви вже отримали бонус сьогодні. Наступний через {hours_left}г {minutes_left}хв"
            )

        # Перевіряємо стрік (чи отримували вчора)
        yesterday = kyiv_today - timedelta(days=1)
        if last_claim_kyiv.date() == yesterday:
            # Продовжуємо стрік
            current_streak = last_claim.streak + 1
        else:
            # Стрік скинувся
            current_streak = 1
    else:
        # Перший бонус
        current_streak = 1

    # Визначаємо розмір бонусу залежно від стріку
    bonus_amounts = {
        1: 10,  # День 1
        2: 15,  # День 2
        3: 20,  # День 3
        4: 25,  # День 4
        5: 30,  # День 5
        6: 35,  # День 6
        7: 50,  # День 7 - максимальний бонус
    }

    # Після 7 днів стрік продовжується, але бонус залишається 50
    if current_streak <= 7:
        bonus_amount = bonus_amounts[current_streak]
    else:
        bonus_amount = 50

    # Нараховуємо бонуси
    current_user.bonuses += bonus_amount
    current_user.total_bonuses_earned += bonus_amount

    # Записуємо в історію
    daily_bonus = DailyBonus(
        user_id=current_user.id,
        amount=bonus_amount,
        streak=current_streak,
        claimed_at=datetime.now(timezone.utc)  # Зберігаємо в UTC
    )
    session.add(daily_bonus)

    # Записуємо транзакцію
    transaction = BonusTransaction(
        user_id=current_user.id,
        amount=bonus_amount,
        balance_after=current_user.bonuses,
        type=BonusTransactionType.DAILY_CLAIM,
        description=f"Щоденний бонус, день {current_streak}"
    )
    session.add(transaction)

    await session.commit()

    # Визначаємо завтрашній бонус
    tomorrow_streak = current_streak + 1
    if tomorrow_streak <= 7:
        tomorrow_bonus = bonus_amounts[tomorrow_streak]
    else:
        tomorrow_bonus = 50

    # Час до наступного бонусу
    seconds_left = seconds_until_kyiv_midnight()

    return {
        "success": True,
        "amount": bonus_amount,
        "streak": current_streak,
        "new_balance": current_user.bonuses,
        "tomorrow_bonus": tomorrow_bonus,
        "next_claim_in_seconds": seconds_left,
        "next_claim_time": get_kyiv_midnight().isoformat()
    }