import re
from functools import lru_cache

from pymorphy3 import MorphAnalyzer

WORD_PATTERN = re.compile(r"[A-Za-zА-Яа-яЁё]+")
RUSSIAN_LETTER_PATTERN = re.compile(r"[А-Яа-яЁё]")
RU_HUI_PATTERN = re.compile(r"^ху[йеяию].*")

MORPH = MorphAnalyzer()

# Нормальные формы (леммы), проверяются через pymorphy3.
BAD_RU_LEMMAS: set[str] = {
    "бля",
    "блядь",
    "блять",
    "блядина",
    "сука",
    "сучка",
    "хуй",
    "хуесос",
    "пизда",
    "ебать",
    "ебаный",
    "ебанный",
    "долбаеб",
    "уебок",
    "мудак",
}

BAD_RU_PREFIXES: tuple[str, ...] = (
    "бляд",
    "блят",
    "блядин",
    "пизд",
    "ебан",
    "уеб",
    "наеб",
    "заеб",
    "выеб",
    "поеб",
    "проеб",
    "подъеб",
    "подьеб",
    "разъеб",
    "разьеб",
    "долбаеб",
    "долбоеб",
    "хуесос",
    "мудак",
    "трах",
    "сос",
)

# Для английского оставляем простой stem-check.
BAD_EN_STEMS: tuple[str, ...] = (
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "pussy",
)


def _normalize_word(word: str) -> str:
    return word.lower().replace("ё", "е")


@lru_cache(maxsize=20000)
def _to_lemma(word: str) -> str:
    parsed = MORPH.parse(word)
    if not parsed:
        return word
    return _normalize_word(parsed[0].normal_form)


def _is_bad_word(word: str) -> bool:
    normalized = _normalize_word(word)
    if not normalized:
        return False

    if RUSSIAN_LETTER_PATTERN.search(normalized):
        lemma = _to_lemma(normalized)
        for candidate in (normalized, lemma):
            if candidate in BAD_RU_LEMMAS:
                return True
            if candidate.startswith(BAD_RU_PREFIXES):
                return True
            if RU_HUI_PATTERN.match(candidate):
                return True
        return False

    return any(normalized == stem or normalized.startswith(stem) for stem in BAD_EN_STEMS)


def sanitize_message(text: str) -> str:
    def replace_token(match: re.Match[str]) -> str:
        token = match.group(0)
        if _is_bad_word(token):
            return "*" * len(token)
        return token

    return WORD_PATTERN.sub(replace_token, text)
