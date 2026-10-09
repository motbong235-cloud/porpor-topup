"""
Khmer-System ABA PayWay Module
អាចយកទៅប្រើជាមួយ Website ឬ Telegram Bot បាន

Usage:
    from khmer_system import create_qr, check_payment, is_ready
"""

import os
import requests

# ========================
# Config (អាចប្តូរតាម env)
# ========================
ABA_API_KEY     = os.getenv("ABA_API_KEY", "")
ABA_MERCHANT_ID = os.getenv("ABA_MERCHANT_ID", "")
BASE_URL        = "https://khmer-system.com"

CREATE_URL = f"{BASE_URL}/aba-api/generate-qr"
CHECK_URL  = f"{BASE_URL}/aba-api/check-payment"

_session = requests.Session()
_session.headers.update({
    "Content-Type": "application/json",
    "Accept": "application/json"
})


def is_ready() -> bool:
    """True បើមាន API Key និង Merchant ID រួច"""
    return bool(ABA_API_KEY.strip() and ABA_MERCHANT_ID.strip())


def create_qr(amount: float, bill_number: str, description: str = "Payment") -> dict:
    """
    បង្កើត QR តាម Khmer-System

    Args:
        amount: ចំនួនលុយ (ឧ. 1.50)
        bill_number: លេខយោងត្រូវខុសគ្នារាល់ដង
        description: ពិពណ៌នា

    Returns:
        {
            "success": True/False,
            "qr_image": "...",          # base64 ឬ url
            "qr_string": "...",
            "transaction_id": "...",
            "error": "..."              # បើ fail
        }
    """
    if not is_ready():
        return {"success": False, "error": "ABA_API_KEY ឬ ABA_MERCHANT_ID មិនទាន់កំណត់"}

    payload = {
        "api_key": ABA_API_KEY,
        "merchant_id": ABA_MERCHANT_ID,
        "amount": f"{float(amount):.2f}",
        "bill_number": str(bill_number),
        "description": description
    }

    try:
        r = _session.post(CREATE_URL, json=payload, timeout=20)
        data = r.json()

        if data.get("status") == "success" or data.get("qr_image") or data.get("qr"):
            return {
                "success": True,
                "qr_image": data.get("qr_image") or data.get("qr"),
                "qr_string": data.get("qr_string") or data.get("qr_data", ""),
                "transaction_id": data.get("transaction_id") or data.get("tran_id") or bill_number,
                "raw": data
            }

        return {
            "success": False,
            "error": data.get("message") or data.get("error") or "បង្កើត QR មិនបាន",
            "raw": data
        }

    except requests.Timeout:
        return {"success": False, "error": "Timeout"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def check_payment(transaction_id: str) -> dict:
    """
    ពិនិត្យស្ថានភាពការបង់ប្រាក់

    Returns:
        {
            "paid": True/False,
            "status": "...",
            "amount": ...,
            "error": "..."   # បើមាន
        }
    """
    if not is_ready():
        return {"paid": False, "error": "Key មិនទាន់កំណត់"}

    payload = {
        "api_key": ABA_API_KEY,
        "merchant_id": ABA_MERCHANT_ID,
        "transaction_id": str(transaction_id)
    }

    try:
        r = _session.post(CHECK_URL, json=payload, timeout=15)
        data = r.json()

        status = str(data.get("status", "")).lower()
        paid = status in ("success", "paid", "completed", "successful")

        return {
            "paid": paid,
            "status": status,
            "amount": data.get("amount"),
            "raw": data
        }

    except Exception as e:
        return {"paid": False, "error": str(e)}
