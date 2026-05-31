import re
import unicodedata

CATEGORY_ALIASES = {
    "medicamentos": ["medicamento", "medicamentos", "farmacos", "farmaco"],
    "suplementos": ["suplemento", "suplementos", "vitaminas", "vitamina"],
    "cuidado personal": ["cuidado personal", "higiene", "belleza", "dermocosmetica"],
}

CLEAR_PATTERNS = [
    "limpiar",
    "limpia",
    "quitar filtro",
    "borrar filtro",
    "sin filtro",
    "mostrar todo",
    "mostrar todos",
    "ver todo",
]

SEARCH_PATTERNS = [
    r"(?:buscar|busca|encontrar|encuentra|muestrame|mostrar|ver|quiero ver)\s+(?P<q>.+)",
    r"(?:producto|productos)\s+(?P<q>.+)",
]


def _normalize_text(value):
    text = (value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _contains_any(text, choices):
    return any(choice in text for choice in choices)


def _extract_category(text):
    for canonical, aliases in CATEGORY_ALIASES.items():
        if _contains_any(text, aliases):
            return canonical

    match = re.search(r"(?:categoria|categorias|filtrar por)\s+(?P<cat>[a-z0-9\s]{3,40})", text)
    if match:
        return match.group("cat").strip()
    return None


def _extract_search_query(text):
    for pattern in SEARCH_PATTERNS:
        match = re.search(pattern, text)
        if not match:
            continue
        query = (match.group("q") or "").strip()
        if query and query not in ("todo", "todos"):
            return query

    if len(text.split()) <= 4 and not _contains_any(text, CLEAR_PATTERNS):
        return text
    return None


def parse_voice_search_command(transcription):
    normalized = _normalize_text(transcription)

    if not normalized:
        return {
            "intent": "unknown",
            "query": "",
            "categoria": None,
            "resultado": "ambiguo",
            "mensaje": "No pude entender la solicitud de busqueda.",
        }

    if _contains_any(normalized, CLEAR_PATTERNS):
        return {
            "intent": "clear_filters",
            "query": "",
            "categoria": None,
            "resultado": "ok",
            "mensaje": "Busqueda limpiada.",
        }

    categoria = _extract_category(normalized)
    if categoria:
        return {
            "intent": "filter_category",
            "query": "",
            "categoria": categoria,
            "resultado": "ok",
            "mensaje": f"Filtrando por categoria: {categoria}.",
        }

    query = _extract_search_query(normalized)
    if query:
        return {
            "intent": "search_text",
            "query": query,
            "categoria": None,
            "resultado": "ok",
            "mensaje": f"Buscando: {query}.",
        }

    return {
        "intent": "unknown",
        "query": "",
        "categoria": None,
        "resultado": "ambiguo",
        "mensaje": "No pude identificar si querias buscar o limpiar.",
    }
