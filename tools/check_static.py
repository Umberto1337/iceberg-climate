"""Статическая проверка сайта: ссылки, id, SVG-символы, каталог."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

from lxml import html as LH

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ["index.html", "catalog.html", "privacy.html"]
problems: list[str] = []


def check_pages() -> None:
    for page in PAGES:
        path = os.path.join(ROOT, page)
        if not os.path.exists(path):
            problems.append(f"{page}: файл не найден")
            continue

        doc = LH.parse(path).getroot()
        ids = doc.xpath("//@id")
        duplicates = sorted({item for item in ids if ids.count(item) > 1})
        if duplicates:
            problems.append(f"{page}: дублируются id {duplicates}")

        for element in doc.iter():
            for attr in ("href", "src"):
                value = (element.get(attr) or "").strip()
                if not value or value.startswith(("#", "mailto:", "tel:", "http:", "https:", "data:")):
                    continue
                file_part = value.split("#")[0].split("?")[0]
                if file_part and not os.path.exists(os.path.join(ROOT, file_part)):
                    problems.append(f"{page}: битая ссылка {attr}={value}")

        for element in doc.iter():
            href = element.get("href") or ""
            if element.tag == "use" and href.startswith("#") and href[1:] not in ids:
                problems.append(f"{page}: нет SVG-символа {href}")

            if element.tag == "a" and href.startswith("#") and len(href) > 1:
                if href[1:] not in ids:
                    problems.append(f"{page}: мёртвый якорь {href}")

            if element.tag == "img":
                src = element.get("src") or ""
                if not src:
                    problems.append(f"{page}: img без src")
                if not element.get("alt"):
                    problems.append(f"{page}: img без alt ({src})")
                if not element.get("width") or not element.get("height"):
                    problems.append(f"{page}: img без width/height ({src})")

        # Ссылки на другие страницы с якорем должны существовать
        for element in doc.iter():
            href = element.get("href") or ""
            if not href or href.startswith(("#", "mailto:", "tel:", "http:", "https:")):
                continue
            file_part, _, anchor = href.partition("#")
            target = os.path.join(ROOT, file_part)
            if anchor and file_part.endswith(".html") and os.path.exists(target):
                target_doc = LH.parse(target).getroot()
                if anchor not in target_doc.xpath("//@id"):
                    problems.append(f"{page}: якорь {href} не найден")

        # Поля формы должны иметь label
        for input_el in doc.xpath("//form//input[@id] | //form//textarea[@id]"):
            input_id = input_el.get("id")
            if input_el.get("type") in ("hidden", "checkbox"):
                continue
            if not doc.xpath(f'//label[@for="{input_id}"]'):
                problems.append(f"{page}: поле #{input_id} без label")

        # Все локальные страницы из навигации
        for element in doc.iter():
            href = element.get("href") or ""
            if href.endswith(".html") and not os.path.exists(os.path.join(ROOT, href)):
                problems.append(f"{page}: нет страницы {href}")


def check_catalog() -> None:
    node = os.environ.get("NODE_BIN", "node")
    script = r"""
const fs = require('fs');
const vm = require('vm');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/products.js', 'utf8'), context);
const products = context.window.PRODUCTS;
const issues = [];
const ids = new Set();
for (const [i, p] of products.entries()) {
  for (const field of ['id','brand','name','description','price','image','specs']) {
    if (!p[field]) issues.push(`товар ${i}: нет поля ${field}`);
  }
  if (ids.has(p.id)) issues.push(`повторяющийся id ${p.id}`);
  ids.add(p.id);
  if (!Number.isFinite(p.price) || p.price <= 0) issues.push(`${p.id}: цена не число`);
  if (p.oldPrice && p.oldPrice <= p.price) issues.push(`${p.id}: oldPrice <= price`);
  if (!Array.isArray(p.specs) || p.specs.length < 2) issues.push(`${p.id}: мало specs`);
  if (!fs.existsSync(p.image)) issues.push(`${p.id}: нет фото ${p.image}`);
  if (!['wall','multi','mobile'].includes(p.category)) issues.push(`${p.id}: категория ${p.category}`);
}
console.log(JSON.stringify({ count: products.length, issues }, null, 2));
"""
    result = subprocess.run(
        [node, "-e", script],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    print(result.stdout)
    if result.returncode != 0:
        problems.append("node проверка каталога не выполнилась: " + result.stderr)
        return

    data = json.loads(result.stdout)
    problems.extend(data["issues"])
    if data["count"] < 4:
        problems.append("в каталоге слишком мало товаров")


def check_css_classes() -> None:
    with open(os.path.join(ROOT, "css", "style.css"), encoding="utf-8") as f:
        css = f.read()

    used: set[str] = set()
    for page in PAGES:
        with open(os.path.join(ROOT, page), encoding="utf-8") as f:
            content = f.read()
        for match in re.finditer(r'class="([^"]+)"', content):
            used.update(match.group(1).split())

    # Классы, которые выставляются из JS
    used.update(
        {
            "is-visible", "is-open", "is-scrolled", "is-loading", "is-invalid",
            "is-error", "is-success", "is-active", "is-highlighted", "is-missing",
            "nav-open", "is-visible",
        }
    )

    missing = sorted(cls for cls in used if f".{cls}" not in css)
    if missing:
        problems.append("классы без стилей: " + ", ".join(missing))


def main() -> None:
    check_pages()
    check_catalog()
    check_css_classes()

    if problems:
        print("\nПРОБЛЕМЫ:")
        for problem in problems:
            print(" -", problem)
        sys.exit(1)

    print("\nСтатические проверки пройдены: ссылки, id, SVG, каталог, классы.")


if __name__ == "__main__":
    main()
