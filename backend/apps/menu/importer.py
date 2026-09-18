"""Dependency-free CSV/XLSX menu import for Plait.

XLSX support intentionally uses the OOXML zip/XML format so the production
backend does not need pandas/openpyxl just to onboard a restaurant menu.
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree as ET

MAX_IMPORT_ROWS = 1000
MAX_FILE_SIZE = 5 * 1024 * 1024

ALIASES = {
    'name': {'name', 'название', 'блюдо', 'наименование'},
    'category': {'category', 'категория', 'раздел'},
    'price': {'price', 'цена', 'стоимость'},
    'description': {'description', 'описание', 'состав'},
    'weight': {'weight', 'вес', 'объем', 'объём'},
    'station': {'station', 'preparation_station', 'станция', 'цех'},
    'available': {'available', 'is_available', 'доступно', 'в наличии'},
    'visible': {'visible', 'is_visible', 'видимо', 'показывать'},
}

def _norm(value):
    return re.sub(r'\s+', ' ', str(value or '').strip()).casefold()

def _header_map(headers):
    result = {}
    for idx, header in enumerate(headers):
        normalized = _norm(header)
        for field, aliases in ALIASES.items():
            if normalized in aliases and field not in result:
                result[field] = idx
    return result

def _bool(value, default=True):
    v = _norm(value)
    if not v:
        return default
    if v in {'1', 'true', 'yes', 'да', 'доступно', 'есть'}:
        return True
    if v in {'0', 'false', 'no', 'нет', 'недоступно'}:
        return False
    raise ValueError('ожидается да/нет')

def _price(value):
    raw = str(value or '').strip().replace('\xa0', '').replace(' ', '').replace(',', '.')
    raw = re.sub(r'[^0-9.\-]', '', raw)
    try:
        price = Decimal(raw)
    except (InvalidOperation, ValueError):
        raise ValueError('некорректная цена')
    if price < 0 or price > Decimal('99999999.99'):
        raise ValueError('цена вне допустимого диапазона')
    return price.quantize(Decimal('0.01'))

def _csv_rows(data):
    text = data.decode('utf-8-sig')
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
    except csv.Error:
        dialect = csv.excel
        dialect.delimiter = ';'
    return list(csv.reader(io.StringIO(text), dialect))

def _xlsx_rows(data):
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        shared = []
        if 'xl/sharedStrings.xml' in zf.namelist():
            root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
            for si in root.findall('m:si', ns):
                shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % ns['m'])))
        workbook = ET.fromstring(zf.read('xl/workbook.xml'))
        sheet = workbook.find('m:sheets/m:sheet', ns)
        if sheet is None:
            return []
        rel_id = sheet.attrib['{%s}id' % ns['r']]
        rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
        target = None
        for rel in rels:
            if rel.attrib.get('Id') == rel_id:
                target = rel.attrib.get('Target')
                break
        if not target:
            return []
        path = target.lstrip('/') if target.startswith('/xl/') else 'xl/' + target.lstrip('/')
        root = ET.fromstring(zf.read(path))
        rows = []
        for row in root.findall('.//m:sheetData/m:row', ns):
            cells = {}
            max_col = -1
            for cell in row.findall('m:c', ns):
                ref = cell.attrib.get('r', 'A1')
                letters = re.match(r'[A-Z]+', ref).group(0)
                col = 0
                for ch in letters:
                    col = col * 26 + ord(ch) - 64
                col -= 1
                max_col = max(max_col, col)
                typ = cell.attrib.get('t')
                value_node = cell.find('m:v', ns)
                inline = cell.find('m:is', ns)
                value = ''
                if typ == 'inlineStr' and inline is not None:
                    value = ''.join(t.text or '' for t in inline.iter('{%s}t' % ns['m']))
                elif value_node is not None:
                    value = value_node.text or ''
                    if typ == 's' and value.isdigit():
                        value = shared[int(value)]
                cells[col] = value
            rows.append([cells.get(i, '') for i in range(max_col + 1)])
        return rows

def parse_menu_file(filename, data):
    lower = filename.lower()
    if len(data) > MAX_FILE_SIZE:
        raise ValueError('Файл больше 5 MB.')
    try:
        rows = _xlsx_rows(data) if lower.endswith('.xlsx') else _csv_rows(data) if lower.endswith('.csv') else None
    except (UnicodeDecodeError, csv.Error, zipfile.BadZipFile, ET.ParseError, KeyError, IndexError) as exc:
        raise ValueError('Не удалось прочитать файл. Проверьте формат CSV/XLSX.') from exc
    if rows is None:
        raise ValueError('Поддерживаются только .csv и .xlsx.')
    rows = [r for r in rows if any(str(v).strip() for v in r)]
    if not rows:
        raise ValueError('Файл пустой.')
    if len(rows) - 1 > MAX_IMPORT_ROWS:
        raise ValueError(f'За один импорт можно загрузить максимум {MAX_IMPORT_ROWS} блюд.')
    mapping = _header_map(rows[0])
    missing = [x for x in ('name', 'price') if x not in mapping]
    if missing:
        raise ValueError('Обязательные колонки: Название/Name и Цена/Price.')

    parsed, errors = [], []
    seen = set()
    for line_no, row in enumerate(rows[1:], start=2):
        def get(field):
            idx = mapping.get(field)
            return str(row[idx]).strip() if idx is not None and idx < len(row) else ''
        name = get('name')
        if not name:
            errors.append({'row': line_no, 'field': 'name', 'message': 'Название обязательно.'}); continue
        key = _norm(name)
        if key in seen:
            errors.append({'row': line_no, 'field': 'name', 'message': f'Дубликат «{name}» внутри файла.'}); continue
        seen.add(key)
        try:
            parsed.append({
                'row': line_no, 'name': name[:255], 'category': get('category')[:255],
                'price': _price(get('price')), 'description': get('description'),
                'weight': get('weight')[:50],
                'preparation_station': 'bar' if _norm(get('station')) in {'bar', 'бар'} else 'kitchen',
                'is_available': _bool(get('available'), True), 'is_visible': _bool(get('visible'), True),
            })
        except ValueError as exc:
            errors.append({'row': line_no, 'field': 'value', 'message': str(exc)})
    return parsed, errors
