from openai import OpenAI
from core.config import settings

client = OpenAI(api_key=settings.openai_api_key)


def get_client() -> OpenAI:
    return client
