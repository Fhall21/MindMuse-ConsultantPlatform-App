import httpx
from openai import OpenAI
from core.config import settings

client = OpenAI(api_key=settings.openai_api_key, timeout=httpx.Timeout(30.0))


def get_client() -> OpenAI:
    return client
