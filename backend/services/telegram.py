# backend/services/telegram.py
import httpx
import asyncio
from typing import List, Dict, Optional
from config import settings
import logging
import json
from pathlib import Path

logger = logging.getLogger(__name__)


class TelegramService:
    """Сервіс для відправки повідомлень через Telegram Bot API з підтримкою мультимовності"""

    def __init__(self):
        self.bot_token = settings.BOT_TOKEN
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
        self.client = httpx.AsyncClient(timeout=30.0)
        self.translations = {}
        self.load_translations()

    def load_translations(self):
        """Завантажити переклади для повідомлень"""
        translations_dir = Path(__file__).parent.parent / "translations"

        for lang in ['ua', 'en', 'ru', 'de', 'ar']:
            try:
                file_path = translations_dir / f"messages_{lang}.json"
                if file_path.exists():
                    with open(file_path, 'r', encoding='utf-8') as f:
                        self.translations[lang] = json.load(f)
                    logger.info(f"Loaded translations for {lang}")
            except Exception as e:
                logger.error(f"Failed to load translations for {lang}: {e}")

    def t(self, key: str, lang: str = 'ua', **kwargs) -> str:
        """Отримати переклад з підстановкою параметрів"""
        # Отримуємо переклад для мови або fallback на українську
        translations = self.translations.get(lang, self.translations.get('ua', {}))

        # Розбиваємо ключ на частини (notifications.order.created)
        keys = key.split('.')
        value = translations

        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                break

        # Якщо не знайдено - повертаємо ключ
        if not value:
            return key

        # Підставляємо параметри
        if kwargs:
            try:
                return value.format(**kwargs)
            except:
                return value

        return value

    async def send_message(
            self,
            chat_id: int,
            text: str,
            parse_mode: str = "HTML",
            reply_markup: Optional[Dict] = None
    ) -> bool:
        """Відправити текстове повідомлення користувачу"""
        try:
            data = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": parse_mode
            }

            if reply_markup:
                data["reply_markup"] = reply_markup

            response = await self.client.post(
                f"{self.base_url}/sendMessage",
                json=data
            )

            result = response.json()

            if result.get("ok"):
                logger.info(f"Message sent to user {chat_id}")
                return True
            else:
                logger.error(f"Failed to send message: {result}")
                return False

        except Exception as e:
            logger.error(f"Error sending message to {chat_id}: {str(e)}")
            return False

    async def send_notification(
            self,
            user_id: int,
            title: str,
            message: str,
            buttons: Optional[List[Dict]] = None,
            lang: str = 'ua'
    ) -> bool:
        """Відправити форматоване повідомлення з кнопками"""

        # Форматуємо текст
        text = f"<b>🔔 {title}</b>\n\n{message}"

        # Додаємо кнопки якщо є
        reply_markup = None
        if buttons:
            reply_markup = {
                "inline_keyboard": [buttons]
            }

        return await self.send_message(user_id, text, reply_markup=reply_markup)

    async def send_order_notification(
            self,
            user_id: int,
            order_id: str,
            total: float,
            lang: str = 'ua'
    ):
        """Повідомлення про нове замовлення"""

        title = self.t('notifications.order.title', lang)
        message = self.t(
            'notifications.order.message',
            lang,
            order_id=order_id,
            total=total
        )

        buttons = [{
            "text": self.t('buttons.my_downloads', lang),
            "web_app": {"url": f"{settings.APP_URL}/#downloads"}
        }]

        return await self.send_notification(user_id, title, message, [buttons], lang)

    async def send_subscription_reminder(
            self,
            user_id: int,
            days_left: int,
            lang: str = 'ua'
    ):
        """Нагадування про закінчення підписки"""

        title = self.t('notifications.subscription.reminder_title', lang)
        message = self.t(
            'notifications.subscription.reminder_message',
            lang,
            days=days_left
        )

        buttons = [
            {
                "text": self.t('buttons.renew_subscription', lang),
                "web_app": {"url": f"{settings.APP_URL}/#subscription"}
            }
        ]

        return await self.send_notification(user_id, title, message, buttons, lang)

    async def send_daily_bonus_reminder(
            self,
            user_id: int,
            streak: int,
            lang: str = 'ua'
    ):
        """Нагадування про щоденний бонус"""

        next_reward = self._get_streak_reward(streak + 1)

        title = self.t('notifications.daily_bonus.title', lang)
        message = self.t(
            'notifications.daily_bonus.reminder',
            lang,
            streak=streak,
            reward=next_reward
        )

        buttons = [{
            "text": self.t('buttons.claim_bonus', lang),
            "web_app": {"url": f"{settings.APP_URL}"}
        }]

        return await self.send_notification(user_id, title, message, [buttons], lang)

    async def send_new_archive_notification(
            self,
            user_ids_with_lang: List[tuple],  # [(user_id, language), ...]
            archive_title: Dict[str, str],  # {"ua": "...", "en": "..."}
            archive_code: str
    ):
        """Повідомлення про новий архів для підписників з урахуванням мови"""

        results = {"success": 0, "failed": 0}

        for user_id, user_lang in user_ids_with_lang:
            # Вибираємо назву архіву відповідною мовою
            localized_title = archive_title.get(user_lang, archive_title.get('ua', 'New Archive'))

            title = self.t('notifications.new_archive.title', user_lang)
            message = self.t(
                'notifications.new_archive.message',
                user_lang,
                title=localized_title,
                code=archive_code
            )

            buttons = [{
                "text": self.t('buttons.download', user_lang),
                "web_app": {"url": f"{settings.APP_URL}/#downloads"}
            }]

            success = await self.send_notification(
                user_id,
                title,
                message,
                [buttons],
                user_lang
            )

            if success:
                results["success"] += 1
            else:
                results["failed"] += 1

            await asyncio.sleep(0.05)  # Rate limit protection

        return results

    async def send_referral_bonus_notification(
            self,
            user_id: int,
            referral_name: str,
            bonus_amount: int,
            lang: str = 'ua'
    ):
        """Повідомлення про бонус за реферала"""

        title = self.t('notifications.referral.bonus_title', lang)
        message = self.t(
            'notifications.referral.bonus_message',
            lang,
            name=referral_name,
            amount=bonus_amount
        )

        buttons = [{
            "text": self.t('buttons.invite_more', lang),
            "web_app": {"url": f"{settings.APP_URL}/#referrals"}
        }]

        return await self.send_notification(user_id, title, message, [buttons], lang)

    async def send_vip_level_upgrade(
            self,
            user_id: int,
            new_level: str,
            cashback_rate: float,
            lang: str = 'ua'
    ):
        """Повідомлення про підвищення VIP рівня"""

        level_names = {
            'bronze': self.t('vip.levels.bronze', lang),
            'silver': self.t('vip.levels.silver', lang),
            'gold': self.t('vip.levels.gold', lang),
            'diamond': self.t('vip.levels.diamond', lang)
        }

        title = self.t('notifications.vip.upgrade_title', lang)
        message = self.t(
            'notifications.vip.upgrade_message',
            lang,
            level=level_names.get(new_level, new_level),
            cashback=int(cashback_rate * 100)
        )

        return await self.send_notification(user_id, title, message, lang=lang)

    async def send_payment_success(
            self,
            user_id: int,
            payment_type: str,  # 'order' or 'subscription'
            amount: float,
            lang: str = 'ua'
    ):
        """Повідомлення про успішну оплату"""

        if payment_type == 'order':
            title = self.t('notifications.payment.order_success_title', lang)
            message = self.t('notifications.payment.order_success_message', lang, amount=amount)
        else:
            title = self.t('notifications.payment.subscription_success_title', lang)
            message = self.t('notifications.payment.subscription_success_message', lang, amount=amount)

        return await self.send_notification(user_id, title, message, lang=lang)

    def _get_streak_reward(self, day: int) -> int:
        """Розрахунок винагороди за день стріку"""
        rewards = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 7}
        return rewards.get(day, 10)

    async def close(self):
        """Закрити HTTP клієнт"""
        await self.client.aclose()


# Створюємо глобальний екземпляр
telegram_service = TelegramService()
