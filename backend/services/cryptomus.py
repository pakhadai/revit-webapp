# backend/services/cryptomus.py
import hashlib
import hmac
import json
import base64
from typing import Dict, Optional
import httpx
from datetime import datetime
import uuid
from config import settings


class CryptomusService:
    """Сервіс для роботи з Cryptomus API"""

    def __init__(self):
        self.api_key = settings.CRYPTOMUS_API_KEY
        self.merchant_uuid = settings.CRYPTOMUS_MERCHANT_UUID
        self.base_url = "https://api.cryptomus.com/v1"
        self.webhook_url = f"{settings.APP_URL}/api/payments/cryptomus/webhook"

    def _generate_signature(self, data: dict) -> str:
        """Генерація підпису для запиту"""
        # Сортуємо дані за ключами
        sorted_data = json.dumps(data, sort_keys=True, separators=(',', ':'))

        # Створюємо підпис
        signature = hmac.new(
            self.api_key.encode('utf-8'),
            sorted_data.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        return signature

    def _verify_webhook_signature(self, data: dict, signature: str) -> bool:
        """Перевірка підпису від Cryptomus"""
        expected_signature = self._generate_signature(data)
        return hmac.compare_digest(expected_signature, signature)

    async def create_payment(
            self,
            order_id: str,
            amount: float,
            currency: str = "USD",
            customer_email: Optional[str] = None,
            customer_id: Optional[str] = None,
            metadata: Optional[dict] = None
    ) -> dict:
        """Створити платіж"""

        payment_data = {
            "amount": str(amount),
            "currency": currency,
            "order_id": order_id,
            "url_return": f"{settings.APP_URL}/payment/success",
            "url_callback": self.webhook_url,
            "is_payment_multiple": False,
            "lifetime": 3600,  # 1 година
            "additional_data": json.dumps(metadata or {})
        }

        if customer_email:
            payment_data["customer_email"] = customer_email

        if customer_id:
            payment_data["customer_id"] = str(customer_id)

        # Додаємо підпис
        signature = self._generate_signature(payment_data)

        headers = {
            "merchant": self.merchant_uuid,
            "sign": signature,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/payment",
                    json=payment_data,
                    headers=headers
                )
                response.raise_for_status()

                result = response.json()

                if result.get("state") == 0:
                    return {
                        "success": True,
                        "payment_url": result["result"]["url"],
                        "payment_id": result["result"]["uuid"],
                        "order_id": result["result"]["order_id"],
                        "amount": result["result"]["amount"],
                        "currency": result["result"]["currency"],
                        "status": result["result"]["status"]
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("message", "Payment creation failed")
                    }

            except httpx.HTTPError as e:
                return {
                    "success": False,
                    "error": f"HTTP error: {str(e)}"
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Unexpected error: {str(e)}"
                }

    async def check_payment_status(self, payment_id: str) -> dict:
        """Перевірити статус платежу"""

        data = {
            "uuid": payment_id
        }

        signature = self._generate_signature(data)

        headers = {
            "merchant": self.merchant_uuid,
            "sign": signature,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/payment/info",
                    json=data,
                    headers=headers
                )
                response.raise_for_status()

                result = response.json()

                if result.get("state") == 0:
                    payment_info = result["result"]
                    return {
                        "success": True,
                        "status": payment_info["status"],
                        "is_final": payment_info["is_final"],
                        "amount": payment_info["amount"],
                        "currency": payment_info["currency"],
                        "network": payment_info.get("network"),
                        "address": payment_info.get("address"),
                        "txid": payment_info.get("txid"),
                        "payment_status": self._map_status(payment_info["status"])
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("message", "Failed to get payment info")
                    }

            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }

    def _map_status(self, cryptomus_status: str) -> str:
        """Мапінг статусів Cryptomus на наші"""
        status_map = {
            "payment_created": "pending",
            "pending": "pending",
            "paid": "completed",
            "paid_over": "completed",
            "wrong_amount": "failed",
            "cancel": "cancelled",
            "fail": "failed",
            "system_fail": "failed",
            "refund_process": "refunding",
            "refund_fail": "failed",
            "refund_paid": "refunded"
        }
        return status_map.get(cryptomus_status, "unknown")

    async def refund_payment(self, payment_id: str, address: str) -> dict:
        """Повернути платіж"""

        data = {
            "uuid": payment_id,
            "address": address,
            "is_subtract": True  # Відняти комісію з суми повернення
        }

        signature = self._generate_signature(data)

        headers = {
            "merchant": self.merchant_uuid,
            "sign": signature,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/payment/refund",
                    json=data,
                    headers=headers
                )
                response.raise_for_status()

                result = response.json()

                if result.get("state") == 0:
                    return {
                        "success": True,
                        "message": "Refund initiated successfully"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("message", "Refund failed")
                    }

            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }


# Створюємо глобальний екземпляр
cryptomus_service = CryptomusService()
