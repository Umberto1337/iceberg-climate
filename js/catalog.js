/**
 * ============================================================
 *  КАТАЛОГ: рендер карточек, фильтры, поиск, сортировка
 *  Данные товаров — в js/products.js
 * ============================================================
 */
(function () {
  'use strict';

  var grid = document.getElementById('product-grid');
  if (!grid) return;

  var products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.slice() : [];
  var countEl = document.querySelector('[data-products-count]');
  var wordEl = document.querySelector('[data-products-word]');
  var emptyEl = document.getElementById('catalog-empty');
  var searchEl = document.getElementById('catalog-search');
  var sortEl = document.getElementById('catalog-sort');
  var resetBtn = document.querySelector('[data-reset-filters]');
  var chips = Array.prototype.slice.call(document.querySelectorAll('[data-filter]'));
  var priceFormatter = new Intl.NumberFormat('ru-RU');

  var state = {
    filter: 'all',
    query: '',
    sort: 'popular'
  };

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPrice(value) {
    return priceFormatter.format(Number(value) || 0) + ' ₽';
  }

  function pluralizeModels(number) {
    var mod10 = number % 10;
    var mod100 = number % 100;

    if (mod10 === 1 && mod100 !== 11) return 'модель';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'модели';
    return 'моделей';
  }

  function matchesCategory(product) {
    if (state.filter === 'all') return true;
    if (state.filter === 'inverter') {
      return Array.isArray(product.tags) && product.tags.indexOf('inverter') !== -1;
    }
    return product.category === state.filter;
  }

  function getVisibleProducts() {
    var query = normalize(state.query).trim();

    var visible = products.filter(function (product) {
      if (!matchesCategory(product)) return false;
      if (!query) return true;

      var haystack = normalize([
        product.brand,
        product.name,
        product.description,
        Array.isArray(product.specs) ? product.specs.join(' ') : ''
      ].join(' '));

      return haystack.indexOf(query) !== -1;
    });

    visible.sort(function (a, b) {
      if (state.sort === 'price-asc') return Number(a.price) - Number(b.price);
      if (state.sort === 'price-desc') return Number(b.price) - Number(a.price);
      return (Number(b.popular) || 0) - (Number(a.popular) || 0);
    });

    return visible;
  }

  function badgeMarkup(product) {
    if (!product.badge || !product.badge.text) return '';

    var knownTypes = ['hit', 'sale', 'new'];
    var type = knownTypes.indexOf(product.badge.type) !== -1 ? product.badge.type : 'hit';

    return '<span class="product-card__badge badge--' + type + '">' +
      escapeHtml(product.badge.text) +
      '</span>';
  }

  function cardMarkup(product) {
    var specs = Array.isArray(product.specs) ? product.specs : [];
    var orderHref = 'index.html?product=' + encodeURIComponent(product.id) + '#contact';
    var oldPrice = product.oldPrice
      ? '<s>' + formatPrice(product.oldPrice) + '</s>'
      : '';

    var specsMarkup = specs.map(function (spec) {
      return '<li>' + escapeHtml(spec) + '</li>';
    }).join('');

    return '' +
      '<article class="product-card" data-product-id="' + escapeHtml(product.id) + '">' +
        '<div class="product-card__media">' +
          badgeMarkup(product) +
          '<img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.imageAlt || (product.brand + ' ' + product.name)) + '" width="1200" height="900" loading="lazy" decoding="async">' +
        '</div>' +
        '<div class="product-card__body">' +
          '<p class="product-card__brand">' + escapeHtml(product.brand) + '</p>' +
          '<h3 class="product-card__name">' + escapeHtml(product.name) + '</h3>' +
          '<p class="product-card__desc">' + escapeHtml(product.description) + '</p>' +
          '<ul class="product-card__specs" aria-label="Характеристики">' + specsMarkup + '</ul>' +
          '<div class="product-card__footer">' +
            '<div class="price">' +
              '<span class="price__label">от</span>' +
              '<strong>' + formatPrice(product.price) + '</strong>' +
              oldPrice +
            '</div>' +
            '<a class="btn btn--primary btn--sm" href="' + orderHref + '">Заказать' +
              '<svg aria-hidden="true"><use href="#i-arrow"/></svg>' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function updateChips() {
    chips.forEach(function (chip) {
      var active = chip.getAttribute('data-filter') === state.filter;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function render() {
    var visible = getVisibleProducts();

    grid.innerHTML = visible.map(cardMarkup).join('');
    grid.hidden = visible.length === 0;

    if (countEl) countEl.textContent = String(visible.length);
    if (wordEl) wordEl.textContent = pluralizeModels(visible.length);
    if (emptyEl) emptyEl.hidden = visible.length !== 0;

    updateChips();
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      state.filter = chip.getAttribute('data-filter') || 'all';
      render();
    });
  });

  if (searchEl) {
    searchEl.addEventListener('input', function () {
      state.query = searchEl.value;
      render();
    });
  }

  if (sortEl) {
    sortEl.addEventListener('change', function () {
      state.sort = sortEl.value;
      render();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      state.filter = 'all';
      state.query = '';
      state.sort = 'popular';

      if (searchEl) searchEl.value = '';
      if (sortEl) sortEl.value = 'popular';

      render();
    });
  }

  // Если фото товара ещё не добавлено — не показываем «битую» иконку
  grid.addEventListener('error', function (event) {
    var target = event.target;
    if (!target || target.tagName !== 'IMG') return;
    target.hidden = true;
    var media = target.closest('.product-card__media');
    if (media) media.classList.add('is-missing');
  }, true);

  render();
})();
