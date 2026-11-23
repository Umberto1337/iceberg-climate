"""
Генератор изображений-заглушек для сайта «Айсберг».

Запуск (из корня проекта):
    python tools/make_placeholders.py

Все картинки — обычные JPG. Чтобы поставить свои фото, просто замените
файлы в images/works/ и images/products/ файлами с теми же именами
(например, work-1.jpg, daikin.jpg) — код трогать не нужно.
"""

from __future__ import annotations

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKS_DIR = os.path.join(ROOT, "images", "works")
PRODUCTS_DIR = os.path.join(ROOT, "images", "products")

FONT_REGULAR = r"C:\Windows\Fonts\segoeui.ttf"
FONT_SEMIBOLD = r"C:\Windows\Fonts\seguisb.ttf"
FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"

random.seed(7)


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def vertical_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size, top)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        draw.line([(0, y), (width, y)], fill=lerp(top, bottom, y / max(1, height - 1)))
    return image


def add_glow(image: Image.Image, center: tuple[int, int], radius: int, color: tuple[int, int, int], alpha: int = 90) -> None:
    """Мягкое радиальное свечение."""
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    steps = 16
    for i in range(steps, 0, -1):
        r = int(radius * i / steps)
        a = int(alpha * (1 - i / steps) ** 1.6)
        if r <= 0 or a <= 0:
            continue
        draw.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r], fill=(*color, a))
    glow = glow.filter(ImageFilter.GaussianBlur(radius // 6))
    image.alpha_composite(glow) if image.mode == "RGBA" else image.paste(glow, (0, 0), glow)


def rounded_shadow(
    image: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    blur: int = 30,
    offset: tuple[int, int] = (0, 18),
    opacity: int = 60,
) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(
        [x0 + offset[0], y0 + offset[1], x1 + offset[0], y1 + offset[1]],
        radius=radius,
        fill=(15, 55, 90, opacity),
    )
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    image.alpha_composite(layer)


def bezier_points(p0, p1, p2, samples: int = 60):
    points = []
    for i in range(samples + 1):
        t = i / samples
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t**2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t**2 * p2[1]
        points.append((x, y))
    return points


def draw_airflow(draw: ImageDraw.ImageDraw, start: tuple[int, int], accent: tuple[int, int, int], alpha: int = 110) -> None:
    """Три плавные линии «потока воздуха»."""
    for index, shift in enumerate((0, 44, 88)):
        offset_x = shift * 0.55
        p0 = (start[0] + offset_x, start[1])
        p1 = (start[0] - 70 + offset_x, start[1] + 150)
        p2 = (start[0] + 60 + offset_x, start[1] + 300)
        pts = bezier_points(p0, p1, p2)
        width = 7 - index
        draw.line(pts, fill=(*accent, alpha - index * 18), width=width, joint="curve")


def draw_snowflake(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: int, color, width: int = 4) -> None:
    cx, cy = center
    for angle in range(0, 180, 30):
        rad = math.radians(angle)
        dx, dy = math.cos(rad) * radius, math.sin(rad) * radius
        draw.line([(cx - dx, cy - dy), (cx + dx, cy + dy)], fill=color, width=width)
        for t in (0.55,):
            for sign in (-1, 1):
                bx, by = cx + dx * t * sign, cy + dy * t * sign
                for branch in (-45, 45):
                    brad = math.radians(angle + branch)
                    draw.line(
                        [(bx, by), (bx + math.cos(brad) * radius * 0.24, by + math.sin(brad) * radius * 0.24)],
                        fill=color,
                        width=max(2, width - 1),
                    )


def draw_window(image: Image.Image, draw: ImageDraw.ImageDraw, x: int, y: int, accent, dark: bool) -> None:
    width, height = 420, 540
    rounded_shadow(image, (x, y, x + width, y + height), 26, blur=36, offset=(0, 22), opacity=45 if not dark else 90)
    draw.rounded_rectangle([x, y, x + width, y + height], radius=26, fill=(246, 251, 255, 255) if not dark else (18, 45, 68, 255))
    inset = 18
    glass_top = (206, 238, 253) if not dark else (10, 32, 52)
    glass_bottom = (238, 249, 255) if not dark else (18, 52, 80)
    glass = vertical_gradient((width - inset * 2, height - inset * 2), glass_top, glass_bottom)
    mask = Image.new("L", glass.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, glass.width, glass.height], radius=16, fill=255)
    image.paste(glass, (x + inset, y + inset), mask)
    # Рама
    draw = ImageDraw.Draw(image)
    frame_color = (255, 255, 255) if not dark else (30, 62, 90)
    draw.rounded_rectangle([x, y, x + width, y + height], radius=26, outline=frame_color, width=12)
    draw.line([(x + width // 2, y + inset), (x + width // 2, y + height - inset)], fill=frame_color, width=8)
    draw.line([(x + inset, y + height // 2), (x + width - inset, y + height // 2)], fill=frame_color, width=8)
    # Луна / солнце
    draw.ellipse([x + width - 130, y + 60, x + width - 70, y + 120], fill=(232, 243, 252) if dark else (255, 236, 186))


def draw_plant(draw: ImageDraw.ImageDraw, x: int, y: int, scale: float = 1.0, dark: bool = False) -> None:
    pot_w, pot_h = int(120 * scale), int(110 * scale)
    draw.rounded_rectangle([x, y, x + pot_w, y + pot_h], radius=int(16 * scale), fill=(223, 232, 238) if not dark else (32, 62, 86))
    draw.rectangle([x + 8, y, x + pot_w - 8, y + int(16 * scale)], fill=(197, 210, 220) if not dark else (24, 50, 72))
    leaf = (74, 160, 128) if not dark else (52, 122, 108)
    leaf_dark = (52, 132, 104) if not dark else (38, 96, 90)
    stems = [(-42, -150), (4, -190), (48, -140), (-10, -110)]
    for i, (dx, dy) in enumerate(stems):
        sx, sy = x + pot_w // 2, y + 4
        ex, ey = sx + dx * scale, sy + dy * scale
        draw.line([(sx, sy), (ex, ey)], fill=leaf_dark, width=max(2, int(5 * scale)))
        rw, rh = int(34 * scale), int(17 * scale)
        angle_box = [ex - rw, ey - rh, ex + rw, ey + rh]
        draw.ellipse(angle_box, fill=leaf if i % 2 == 0 else leaf_dark)


def make_work(index: int, title: str, palette: str) -> None:
    variants = {
        "sky": ((246, 252, 255), (222, 241, 252), (56, 189, 248), False),
        "sand": ((255, 252, 246), (243, 234, 218), (234, 179, 8), False),
        "mint": ((246, 255, 252), (219, 244, 236), (20, 184, 166), False),
        "night": ((11, 27, 43), (20, 49, 74), (56, 189, 248), True),
        "lilac": ((250, 249, 255), (230, 230, 250), (129, 140, 248), False),
        "steel": ((248, 251, 254), (226, 236, 245), (14, 116, 233), False),
    }
    top, bottom, accent, dark = variants[palette]
    image = vertical_gradient((1600, 1000), top, bottom).convert("RGBA")
    add_glow(image, (1280, 180), 520, accent, 80 if not dark else 110)
    add_glow(image, (240, 820), 420, (255, 255, 255) if not dark else accent, 90)

    draw = ImageDraw.Draw(image, "RGBA")

    # Мягкая «стена» и пол
    draw.rectangle([0, 780, 1600, 1000], fill=(251, 254, 255) if not dark else (16, 41, 62))
    draw.line([(0, 780), (1600, 780)], fill=(224, 239, 249) if not dark else (34, 68, 96), width=2)

    draw_window(image, draw, 120, 150, accent, dark)
    draw_plant(draw, 430, 680, 1.15, dark)

    # Кондиционер
    unit = (900, 190, 1430, 360)
    rounded_shadow(image, unit, 26, blur=42, offset=(0, 26), opacity=45 if not dark else 110)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(unit, radius=26, fill=(255, 255, 255, 255) if not dark else (236, 245, 252, 255))
    draw.rounded_rectangle([unit[0], unit[1], unit[2], unit[1] + 26], radius=13, fill=(247, 251, 254, 255) if not dark else (215, 230, 242, 255))
    # Вентиляционная решётка
    for i in range(4):
        y = 286 + i * 15
        draw.rounded_rectangle([940, y, 1330, y + 6], radius=3, fill=(208, 224, 236) if not dark else (150, 180, 202))
    # Дисплей
    draw.rounded_rectangle([1340, 250, 1404, 286], radius=8, fill=(230, 245, 255, 255) if not dark else (18, 45, 68, 255))
    display_font = font(FONT_SEMIBOLD, 22)
    display_color = (14, 116, 233) if not dark else (110, 220, 255)
    draw.text((1352, 256), "22°", font=display_font, fill=display_color)
    draw.ellipse([1345, 306, 1357, 318], fill=(56, 189, 248) if not dark else (110, 220, 255))
    # Логотип на корпусе
    brand_font = font(FONT_SEMIBOLD, 17)
    draw.text((940, 245), "ICEBERG  AIR", font=brand_font, fill=(122, 148, 170) if not dark else (140, 174, 198))

    draw_airflow(draw, (1150, 380), accent, 120 if not dark else 140)

    # Плашка-подпись (сверху слева, чтобы не спорить с подписью слайда в HTML)
    chip = (180, 44, 648, 148)
    rounded_shadow(image, chip, 24, blur=22, offset=(0, 8), opacity=40 if not dark else 100)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(chip, radius=24, fill=(255, 255, 255, 235) if not dark else (13, 33, 51, 225))
    draw.ellipse([210, 78, 228, 96], fill=(*accent, 255))
    title_font = font(FONT_BOLD, 22)
    subtitle_font = font(FONT_REGULAR, 16)
    draw.text((246, 60), f"ФОТО РАБОТЫ  {index:02d}", font=title_font, fill=(10, 32, 54) if not dark else (240, 248, 255))
    draw.text((246, 98), f"замените work-{index}.jpg", font=subtitle_font, fill=(96, 122, 145) if not dark else (168, 192, 210))

    # Крупный номер
    number_font = font(FONT_BOLD, 250)
    draw.text((1330, 690), f"{index:02d}", font=number_font, fill=(226, 241, 252) if not dark else (23, 55, 82))

    image.convert("RGB").save(os.path.join(WORKS_DIR, f"work-{index}.jpg"), quality=88, optimize=True, progressive=True)


def make_product(index: int, accent, body, dark_body: bool = False) -> None:
    image = vertical_gradient((1200, 900), (250, 253, 255), (224, 240, 252)).convert("RGBA")
    add_glow(image, (930, 150), 400, accent, 65)
    add_glow(image, (180, 760), 380, (255, 255, 255), 120)
    draw = ImageDraw.Draw(image, "RGBA")

    # Декоративные линии
    for i in range(7):
        x = 60 + i * 190
        draw.line([(x, 0), (x - 260, 900)], fill=(255, 255, 255), width=2)
    draw.ellipse([880, 600, 1320, 1040], fill=(248, 252, 255))

    # Тень под корпусом
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse([210, 640, 990, 730], fill=(16, 55, 90, 38))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    image.alpha_composite(shadow)
    draw = ImageDraw.Draw(image, "RGBA")

    # Корпус
    unit = (210, 300, 990, 560)
    rounded_shadow(image, unit, 40, blur=34, offset=(0, 20), opacity=45)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(unit, radius=40, fill=(*body, 255))
    edge = (255, 255, 255) if not dark_body else (100, 116, 132)
    draw.rounded_rectangle(unit, radius=40, outline=edge, width=3)
    # Верхняя грань
    draw.rounded_rectangle([unit[0] + 6, unit[1] + 6, unit[2] - 6, unit[1] + 54], radius=30, fill=(252, 254, 255) if not dark_body else (66, 80, 94))
    # Решётка
    for i in range(5):
        y = 466 + i * 14
        draw.rounded_rectangle([270, y, 930, y + 6], radius=3, fill=(186, 204, 217) if not dark_body else (104, 120, 136))
    # Дисплей
    draw.rounded_rectangle([858, 360, 946, 408], radius=10, fill=(238, 249, 255, 255) if not dark_body else (12, 28, 44, 255))
    display_font = font(FONT_SEMIBOLD, 26)
    draw.text((872, 368), "22°", font=display_font, fill=accent)
    draw.ellipse([866, 426, 879, 439], fill=accent)
    # Логотип
    logo_font = font(FONT_SEMIBOLD, 19)
    logo_color = (118, 145, 166) if not dark_body else (206, 222, 234)
    draw.text((268, 352), "ICEBERG AIR", font=logo_font, fill=logo_color)
    # Нижняя створка
    draw.rounded_rectangle([240, 556, 960, 584], radius=12, fill=(242, 249, 254, 255) if not dark_body else (52, 68, 84, 255))
    # Поток воздуха
    draw_airflow(draw, (600, 610), accent, 125)

    # Номер и подпись
    number_font = font(FONT_BOLD, 190)
    draw.text((960, 660), f"{index:02d}", font=number_font, fill=(230, 243, 253))
    chip_w = 330
    chip = (60, 790, 60 + chip_w, 850)
    draw.rounded_rectangle(chip, radius=22, fill=(255, 255, 255, 230))
    draw.ellipse([84, 812, 100, 828], fill=accent)
    label_font = font(FONT_SEMIBOLD, 19)
    draw.text((114, 806), "ФОТО ТОВАРА", font=label_font, fill=(10, 32, 54))
    small_font = font(FONT_REGULAR, 15)
    draw.text((114, 828), "замените файл · 1200 × 900", font=small_font, fill=(110, 134, 154))

    image.convert("RGB").save(os.path.join(PRODUCTS_DIR, f"product-{index}.jpg"), quality=88, optimize=True, progressive=True)


def make_og() -> None:
    image = vertical_gradient((1200, 630), (7, 26, 47), (12, 49, 84)).convert("RGBA")
    add_glow(image, (980, 90), 460, (56, 189, 248), 120)
    add_glow(image, (160, 640), 360, (34, 211, 238), 55)
    draw = ImageDraw.Draw(image, "RGBA")
    for i in range(9):
        draw.arc([-120 + i * 30, 360 - i * 20, 620 + i * 40, 1080 - i * 20], 200, 320, fill=(255, 255, 255, 12), width=3)

    draw.rounded_rectangle([86, 88, 166, 168], radius=24, fill=(240, 250, 255, 255))
    draw_snowflake(draw, (126, 128), 26, (14, 116, 233, 255), 5)

    title_font = font(FONT_BOLD, 104)
    draw.text((86, 205), "Айсберг", font=title_font, fill=(255, 255, 255))
    sub_font = font(FONT_SEMIBOLD, 30)
    draw.text((92, 330), "КЛИМАТИЧЕСКИЕ СИСТЕМЫ", font=sub_font, fill=(120, 220, 255))
    tag_font = font(FONT_REGULAR, 32)
    draw.text((92, 410), "Установка · Обслуживание · Продажа", font=tag_font, fill=(216, 236, 248))
    phone_font = font(FONT_SEMIBOLD, 34)
    draw.text((92, 500), "+7 (495) 120-24-22", font=phone_font, fill=(255, 255, 255))

    image.convert("RGB").save(os.path.join(ROOT, "images", "og-cover.jpg"), quality=90, optimize=True, progressive=True)


def main() -> None:
    os.makedirs(WORKS_DIR, exist_ok=True)
    os.makedirs(PRODUCTS_DIR, exist_ok=True)

    works = [
        ("Квартира в ЖК «Северный парк»", "sky"),
        ("Офис на Пионерском проспекте", "sand"),
        ("Загородный дом, Анапский район", "mint"),
        ("Кофейня в центре Анапы", "night"),
        ("Спальня в ЖК «Метрополия»", "lilac"),
        ("Сервисное обслуживание", "steel"),
    ]
    for i, (title, palette) in enumerate(works, start=1):
        make_work(i, title, palette)

    products = [
        ((56, 189, 248), (255, 255, 255), False),
        ((129, 140, 248), (236, 241, 248), False),
        ((20, 184, 166), (255, 255, 255), False),
        ((250, 204, 21), (44, 58, 71), True),
        ((14, 165, 233), (246, 248, 250), False),
        ((244, 114, 182), (255, 255, 255), False),
        ((34, 211, 238), (238, 245, 251), False),
        ((99, 102, 241), (52, 64, 84), True),
    ]
    for i, (accent, body, dark_body) in enumerate(products, start=1):
        make_product(i, accent, body, dark_body)

    make_og()
    print("Готово: 6 работ, 8 товаров, OG-обложка.")


if __name__ == "__main__":
    main()

