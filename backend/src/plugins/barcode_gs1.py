import calendar
import re
from datetime import date
from urllib.parse import unquote, urlparse

SEPARADOR_GS = "\x1d"
PREFIXOS_SIMPBOLOGIA = ("]C1", "]d2", "]Q3", "]e0", "]E0")

AI_FIXOS = {
    "00": 18,
    "01": 14,
    "02": 14,
    "11": 6,
    "12": 6,
    "13": 6,
    "15": 6,
    "16": 6,
    "17": 6,
    "20": 2,
    "402": 17,
}
AI_VARIAVEIS = {
    "10": 20,
    "21": 20,
    "22": 20,
    "30": 8,
    "37": 8,
    "240": 30,
    "241": 30,
    "242": 6,
    "250": 30,
    "251": 30,
    "400": 30,
    "401": 30,
    "403": 30,
}
AI_COMPRIMENTO_FIXO = {
    **AI_FIXOS,
    **{str(ai): 13 for ai in range(410, 418)},
}


def _limpar_codigo(codigo: str) -> str:
    codigo = codigo.strip()
    for prefixo in PREFIXOS_SIMPBOLOGIA:
        if codigo.startswith(prefixo):
            return codigo[len(prefixo):]
    return codigo


def _gtin_valido(gtin: str) -> bool:
    if not gtin.isdigit() or len(gtin) not in (8, 12, 13, 14):
        raise ValueError("O GTIN precisa ter 8, 12, 13 ou 14 dígitos.")
    soma = sum(
        int(digito) * (3 if posicao % 2 == 0 else 1)
        for posicao, digito in enumerate(reversed(gtin[:-1]))
    )
    digito_verificador = (10 - soma % 10) % 10
    return int(gtin[-1]) == digito_verificador


def _data_gs1(valor: str) -> str:
    if len(valor) != 6 or not valor.isdigit():
        raise ValueError("A data GS1 deve estar no formato AAMMDD.")
    ano, mes, dia = int(valor[:2]), int(valor[2:4]), int(valor[4:6])
    ano += 2000
    if dia == 0:
        dia = calendar.monthrange(ano, mes)[1]
    try:
        return date(ano, mes, dia).isoformat()
    except ValueError as erro:
        raise ValueError("A data GS1 não é válida.") from erro


def _ler_campos_parentetizados(codigo: str) -> dict[str, str]:
    tokens = list(re.finditer(r"\((\d{2,4})\)", codigo))
    if not tokens or codigo[:tokens[0].start()].strip():
        return {}
    campos = {}
    for indice, token in enumerate(tokens):
        ai = token.group(1)
        inicio = token.end()
        fim = tokens[indice + 1].start() if indice + 1 < len(tokens) else len(codigo)
        valor = codigo[inicio:fim].strip()
        if not valor or len(valor) > AI_VARIAVEIS.get(ai, AI_COMPRIMENTO_FIXO.get(ai, 0)):
            raise ValueError(f"O campo GS1 ({ai}) está vazio ou excede o tamanho permitido.")
        if ai in AI_COMPRIMENTO_FIXO and len(valor) != AI_COMPRIMENTO_FIXO[ai]:
            raise ValueError(f"O campo GS1 ({ai}) deve ter {AI_COMPRIMENTO_FIXO[ai]} caracteres.")
        campos[ai] = valor
    return campos


def _ler_campos_sequenciais(codigo: str) -> dict[str, str]:
    campos = {}
    posicao = 0
    while posicao < len(codigo):
        if codigo[posicao] == SEPARADOR_GS:
            posicao += 1
            continue
        ai = next(
            (
                candidato
                for candidato in sorted(
                    {*AI_COMPRIMENTO_FIXO, *AI_VARIAVEIS},
                    key=lambda item: (-len(item), item),
                )
                if codigo.startswith(candidato, posicao)
            ),
            None,
        )
        if ai is None:
            raise ValueError("Não foi possível identificar um campo GS1 no código lido.")
        posicao += len(ai)
        if ai in AI_COMPRIMENTO_FIXO:
            tamanho = AI_COMPRIMENTO_FIXO[ai]
            valor = codigo[posicao:posicao + tamanho]
            if len(valor) != tamanho:
                raise ValueError(f"O campo GS1 ({ai}) está incompleto.")
            posicao += tamanho
        else:
            fim = codigo.find(SEPARADOR_GS, posicao)
            if fim < 0:
                fim = len(codigo)
            valor = codigo[posicao:fim]
            if not valor or len(valor) > AI_VARIAVEIS[ai]:
                raise ValueError(f"O campo GS1 ({ai}) está vazio ou excede o tamanho permitido.")
            posicao = fim
        campos[ai] = valor
    return campos


def _ler_link_digital(codigo: str) -> dict[str, str]:
    parsed = urlparse(codigo)
    if parsed.scheme not in ("http", "https"):
        return {}
    partes = [unquote(parte) for parte in parsed.path.split("/") if parte]
    campos = {}
    for indice, parte in enumerate(partes[:-1]):
        if parte in {"01", "10", "17", "21"}:
            campos[parte] = partes[indice + 1]
    return campos


def interpretar_codigo_barras(codigo: str) -> dict:
    original = codigo.strip()
    if not original:
        raise ValueError("Informe ou leia um código de barras.")

    limpo = _limpar_codigo(original)
    gtin_direto = limpo.isdigit() and len(limpo) in (8, 12, 13, 14)
    campos = {}
    if not gtin_direto:
        campos = _ler_link_digital(limpo)
        if not campos:
            campos = _ler_campos_parentetizados(limpo)
        if not campos and SEPARADOR_GS in limpo:
            campos = _ler_campos_sequenciais(limpo)
        if not campos and limpo.startswith(("01", "00", "10", "17", "21")):
            campos = _ler_campos_sequenciais(limpo)

    gtin = campos.get("01")
    gtin_valido = None
    if not campos and gtin_direto:
        gtin = limpo
        gtin_valido = _gtin_valido(gtin)

    if gtin:
        gtin_valido = _gtin_valido(gtin)
        if not gtin_valido and campos:
            raise ValueError("O dígito verificador do GTIN GS1 não é válido.")

    candidatos = []
    if gtin:
        candidatos.append(gtin)
        gtin13 = gtin.zfill(13)
        if gtin13 not in candidatos:
            candidatos.append(gtin13)
        gtin14 = gtin.zfill(14)
        if gtin14 not in candidatos:
            candidatos.append(gtin14)
        sem_zeros = gtin.lstrip("0")
        if sem_zeros and sem_zeros not in candidatos:
            candidatos.append(sem_zeros)
    if limpo.isdigit() and limpo not in candidatos:
        candidatos.append(limpo)
    if limpo not in candidatos:
        candidatos.append(limpo)

    return {
        "codigo_barras": original,
        "tipo_codigo": "GS1" if campos else ("GTIN" if gtin else "codigo_interno"),
        "gtin": gtin,
        "gtin14": gtin.zfill(14) if gtin else None,
        "gtin_valido": gtin_valido,
        "lote": campos.get("10"),
        "validade": _data_gs1(campos["17"]) if "17" in campos else None,
        "numero_serie": campos.get("21"),
        "dados_gs1": campos,
        "codigos_consulta": candidatos,
    }
