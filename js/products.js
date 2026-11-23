/**
 * ============================================================
 *  КАТАЛОГ КОНДИЦИОНЕРОВ
 * ============================================================
 *
 *  Чтобы добавить товар — скопируйте любой объект ниже,
 *  вставьте его в массив и поменяйте значения.
 *
 *  Обязательные поля:
 *    id          — уникальный латинский идентификатор (без пробелов)
 *    brand       — бренд
 *    name        — модель
 *    description — короткое описание под названием
 *    price       — цена числом, в рублях (без пробелов и знака ₽)
 *    image       — путь к фото от корня сайта
 *    specs       — 2–3 короткие характеристики для карточки
 *
 *  Необязательные поля:
 *    oldPrice    — старая цена (будет зачёркнута)
 *    category    — "wall" (настенный), "multi" (мульти-сплит), "mobile" (мобильный)
 *    tags        — ["inverter", "wifi"]; тег inverter включает фильтр «Инверторные»
 *    badge       — { text: "Хит продаж", type: "hit" | "sale" | "new" }
 *    popular     — число для сортировки «Сначала популярные» (больше = выше)
 *
 *  Фото: положите файл в images/products/ и укажите путь,
 *  например "images/products/my-model.jpg". Рекомендуемый размер — 1200×900.
 * ============================================================
 */
window.PRODUCTS = [
  {
    id: "daikin-ftxb25c",
    brand: "Daikin",
    name: "FTXB25C",
    description: "Тихая инверторная сплит-система для спальни или гостиной",
    price: 32900,
    oldPrice: 36900,
    category: "wall",
    tags: ["inverter", "wifi"],
    specs: ["до 25 м²", "2,5 кВт", "Wi-Fi"],
    badge: { text: "Хит продаж", type: "hit" },
    image: "images/products/product-1.jpg",
    imageAlt: "Настенный кондиционер Daikin FTXB25C",
    popular: 100
  },
  {
    id: "mitsubishi-msz-ln25vg2",
    brand: "Mitsubishi Electric",
    name: "MSZ-LN25VG2",
    description: "Премиальная модель с двойным фильтром и плазменной очисткой",
    price: 74900,
    category: "wall",
    tags: ["inverter", "wifi"],
    specs: ["до 25 м²", "2,5 кВт", "Плазма"],
    badge: { text: "Премиум", type: "new" },
    image: "images/products/product-2.jpg",
    imageAlt: "Настенный кондиционер Mitsubishi Electric MSZ-LN25VG2",
    popular: 75
  },
  {
    id: "lg-p09sp2",
    brand: "LG",
    name: "Dual Cool P09SP2",
    description: "Быстрое охлаждение и управление со смартфона через Wi-Fi",
    price: 27900,
    category: "wall",
    tags: ["inverter", "wifi"],
    specs: ["до 25 м²", "2,6 кВт", "Wi-Fi"],
    image: "images/products/product-3.jpg",
    imageAlt: "Настенный кондиционер LG Dual Cool P09SP2",
    popular: 95
  },
  {
    id: "samsung-ar09txhqasine",
    brand: "Samsung",
    name: "AR09TXHQASINE",
    description: "Технология WindFree: прохлада без направленного потока воздуха",
    price: 34900,
    category: "wall",
    tags: ["inverter", "wifi"],
    specs: ["до 26 м²", "2,6 кВт", "WindFree"],
    image: "images/products/product-4.jpg",
    imageAlt: "Настенный кондиционер Samsung AR09TXHQASINE",
    popular: 90
  },
  {
    id: "haier-multi-3xm52",
    brand: "Haier",
    name: "Multi 3XM52 + 3 × AS25",
    description: "Мульти-сплит на три комнаты с одним наружным блоком",
    price: 89900,
    category: "multi",
    tags: ["multi", "inverter"],
    specs: ["3 комнаты", "5,2 кВт", "Мульти-сплит"],
    badge: { text: "Комплект", type: "new" },
    image: "images/products/product-5.jpg",
    imageAlt: "Мульти-сплит система Haier на три комнаты",
    popular: 70
  },
  {
    id: "ballu-bsag-09hn8",
    brand: "Ballu",
    name: "BSAG-09HN8",
    description: "Практичный вариант для дачи или съёмной квартиры",
    price: 19900,
    oldPrice: 23900,
    category: "wall",
    tags: [],
    specs: ["до 25 м²", "2,6 кВт", "Бюджет"],
    badge: { text: "Скидка", type: "sale" },
    image: "images/products/product-6.jpg",
    imageAlt: "Настенный кондиционер Ballu BSAG-09HN8",
    popular: 85
  },
  {
    id: "hisense-ap09uw",
    brand: "Hisense",
    name: "AP09UW",
    description: "Мобильный кондиционер без монтажа — включил и пользуйся",
    price: 24900,
    category: "mobile",
    tags: ["mobile"],
    specs: ["до 20 м²", "2,6 кВт", "Мобильный"],
    image: "images/products/product-7.jpg",
    imageAlt: "Мобильный кондиционер Hisense AP09UW",
    popular: 60
  },
  {
    id: "electrolux-eacm-12",
    brand: "Electrolux",
    name: "EACM-12 HP/N3",
    description: "Мобильная модель с режимом обогрева для межсезонья",
    price: 22900,
    category: "mobile",
    tags: ["mobile"],
    specs: ["до 30 м²", "3,5 кВт", "Обогрев"],
    image: "images/products/product-8.jpg",
    imageAlt: "Мобильный кондиционер Electrolux EACM-12 HP/N3",
    popular: 55
  }
];
