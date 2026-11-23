/**
 * ============================================================
 *  ОБЩАЯ ЛОГИКА САЙТА «АЙСБЕРГ»
 *  — липкая шапка и мобильное меню
 *  — появление блоков при скролле
 *  — слайдер работ (стрелки, точки, свайп, автопрокрутка)
 *  — маска и валидация телефона
 *  — отправка формы в Formspree + всплывающая плашка
 *  — предзаполнение заявки при переходе из каталога
 * ============================================================
 */
(function () {
  'use strict';

  var doc = document;
  var CONFIG = window.SITE_CONFIG || {};
  var priceFormatter = new Intl.NumberFormat('ru-RU');

  function $(selector, scope) {
    return (scope || doc).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  function onReady(callback) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function pad2(number) {
    return String(number).padStart(2, '0');
  }

  function formatPrice(value) {
    return priceFormatter.format(Number(value) || 0) + ' ₽';
  }

  onReady(function () {
    initHeader();
    initMobileNav();
    initReveal();
    initSlider();
    initYear();
    initForm();
    prefillProductFromQuery();
  });

  /* ---------------------------------------------------------
     Шапка: тень при прокрутке
  --------------------------------------------------------- */
  function initHeader() {
    var header = $('#site-header');
    if (!header) return;

    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 6);
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* ---------------------------------------------------------
     Мобильное меню
  --------------------------------------------------------- */
  function initMobileNav() {
    var burger = $('.burger');
    var nav = $('#main-nav');
    if (!burger || !nav) return;

    var isOpen = false;

    function setOpen(open) {
      isOpen = open;
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      nav.classList.toggle('is-open', open);
      doc.body.classList.toggle('nav-open', open);
    }

    burger.addEventListener('click', function () {
      setOpen(!isOpen);
    });

    $$('a', nav).forEach(function (link) {
      link.addEventListener('click', function () {
        if (isOpen) setOpen(false);
      });
    });

    doc.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen) {
        setOpen(false);
        burger.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 980 && isOpen) setOpen(false);
    });
  }

  /* ---------------------------------------------------------
     Плавное появление блоков
  --------------------------------------------------------- */
  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(function (item) {
        item.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
    );

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  /* ---------------------------------------------------------
     Слайдер «Наши работы»
  --------------------------------------------------------- */
  function initSlider() {
    var slider = $('[data-slider]');
    if (!slider) return;

    var track = $('[data-slider-track]', slider);
    var viewport = $('[data-slider-viewport]', slider);
    var slides = track ? $$('.work-slide', track) : [];
    if (!track || !viewport || slides.length === 0) return;

    var prevBtn = $('[data-slider-prev]');
    var nextBtn = $('[data-slider-next]');
    var currentEl = $('[data-slider-current]');
    var totalEl = $('[data-slider-total]');
    var dotsWrap = $('[data-slider-dots]');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    var total = slides.length;
    var index = 0;
    var dots = [];
    var autoplayTimer = null;
    var hovered = false;
    var focused = false;
    var sliderVisible = true;
    var pointerStartX = null;
    var pointerStartY = null;

    if (totalEl) totalEl.textContent = pad2(total);

    if (dotsWrap) {
      dotsWrap.setAttribute('role', 'group');
      dotsWrap.innerHTML = '';

      slides.forEach(function (_, i) {
        var dot = doc.createElement('button');
        dot.type = 'button';
        dot.className = 'slider-dot';
        dot.setAttribute('aria-label', 'Показать слайд ' + (i + 1));
        dot.setAttribute('aria-pressed', 'false');
        dot.addEventListener('click', function () {
          goTo(i, true);
        });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      });
    }

    function render() {
      track.style.transform = 'translate3d(-' + index * 100 + '%, 0, 0)';

      if (currentEl) currentEl.textContent = pad2(index + 1);

      slides.forEach(function (slide, i) {
        var active = i === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });

      dots.forEach(function (dot, i) {
        var active = i === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function goTo(next, byUser) {
      index = (next + total) % total;
      render();
      if (byUser) restartAutoplay();
    }

    function canAutoplay() {
      return !reduceMotion.matches && !doc.hidden && !hovered && !focused && sliderVisible && total > 1;
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        window.clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function startAutoplay() {
      stopAutoplay();
      if (!canAutoplay()) return;
      autoplayTimer = window.setInterval(function () {
        index = (index + 1) % total;
        render();
      }, 6500);
    }

    function restartAutoplay() {
      startAutoplay();
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        goTo(index - 1, true);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        goTo(index + 1, true);
      });
    }

    viewport.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(index - 1, true);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(index + 1, true);
      }
    });

    viewport.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
    });

    viewport.addEventListener('pointerup', function (event) {
      if (pointerStartX === null) return;

      var deltaX = event.clientX - pointerStartX;
      var deltaY = event.clientY - pointerStartY;
      pointerStartX = null;
      pointerStartY = null;

      if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        goTo(index + (deltaX < 0 ? 1 : -1), true);
      }
    });

    viewport.addEventListener('pointercancel', function () {
      pointerStartX = null;
      pointerStartY = null;
    });

    viewport.addEventListener('dragstart', function (event) {
      event.preventDefault();
    });

    slider.addEventListener('mouseenter', function () {
      hovered = true;
      stopAutoplay();
    });

    slider.addEventListener('mouseleave', function () {
      hovered = false;
      startAutoplay();
    });

    slider.addEventListener('focusin', function () {
      focused = true;
      stopAutoplay();
    });

    slider.addEventListener('focusout', function () {
      window.setTimeout(function () {
        focused = slider.contains(doc.activeElement);
        startAutoplay();
      }, 0);
    });

    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) stopAutoplay();
      else startAutoplay();
    });

    if (typeof reduceMotion.addEventListener === 'function') {
      reduceMotion.addEventListener('change', startAutoplay);
    }

    // Автопрокрутка работает только когда слайдер виден на экране
    if ('IntersectionObserver' in window) {
      var visibilityObserver = new IntersectionObserver(
        function (entries) {
          sliderVisible = entries[0].isIntersecting;
          if (sliderVisible) startAutoplay();
          else stopAutoplay();
        },
        { threshold: 0.25 }
      );
      visibilityObserver.observe(slider);
    }

    render();
    startAutoplay();
  }

  /* ---------------------------------------------------------
     Год в футере
  --------------------------------------------------------- */
  function initYear() {
    var year = String(new Date().getFullYear());
    $$('[data-current-year]').forEach(function (el) {
      el.textContent = year;
    });
  }

  /* ---------------------------------------------------------
     Форма: валидация, маска, Formspree, тост
  --------------------------------------------------------- */
  function initForm() {
    var form = $('#request-form');
    if (!form) return;

    var nameInput = $('#name');
    var phoneInput = $('#phone');
    var commentInput = $('#comment');
    var consentInput = $('#consent');
    var consentError = $('#consent-error');
    var submitBtn = $('#submit-btn');
    var commentCounter = $('[data-comment-count]');
    var demoNote = $('#form-demo-note');
    var toast = $('#toast');

    if (!nameInput || !phoneInput || !consentInput || !submitBtn) return;

    var endpoint = normalizeEndpoint(CONFIG.formspreeEndpoint);
    var isDemo = !endpoint;
    var toastTimer = null;

    if (!isDemo) {
      form.setAttribute('action', endpoint);
    } else if (demoNote) {
      demoNote.hidden = false;
    }

    if (CONFIG.formspreeEndpoint && !endpoint) {
      console.warn('[Айсберг] formspreeEndpoint указан неверно. Ожидается https://formspree.io/f/xxxxxx или ID формы.');
    }

    /* ---------- Всплывающая плашка ---------- */
    function hideToast() {
      if (!toast) return;
      window.clearTimeout(toastTimer);
      toast.classList.remove('is-visible');
      window.setTimeout(function () {
        if (!toast.classList.contains('is-visible')) toast.hidden = true;
      }, 400);
    }

    function showToast(options) {
      if (!toast) return;

      var opts = options || {};
      var duration = opts.type === 'error' ? 8000 : 6500;
      var titleEl = $('#toast-title');
      var textEl = $('#toast-text');
      var iconUse = $('#toast-icon-use');
      var progress = $('.toast__progress', toast);

      window.clearTimeout(toastTimer);
      toast.hidden = false;
      toast.classList.remove('is-success', 'is-error');
      toast.classList.add(opts.type === 'error' ? 'is-error' : 'is-success');
      toast.style.setProperty('--toast-duration', duration + 'ms');

      if (titleEl) titleEl.textContent = opts.title || '';
      if (textEl) textEl.textContent = opts.message || '';
      if (iconUse) iconUse.setAttribute('href', opts.type === 'error' ? '#i-alert' : '#i-check');

      if (progress) {
        progress.style.animation = 'none';
        void progress.offsetWidth;
        progress.style.animation = '';
      }

      void toast.offsetWidth;
      toast.classList.add('is-visible');

      toastTimer = window.setTimeout(hideToast, duration);
    }

    if (toast) {
      var closeBtn = $('.toast__close', toast);
      if (closeBtn) closeBtn.addEventListener('click', hideToast);
      toast.addEventListener('mouseenter', function () {
        window.clearTimeout(toastTimer);
      });
      toast.addEventListener('mouseleave', function () {
        window.clearTimeout(toastTimer);
        if (toast.classList.contains('is-visible')) {
          toastTimer = window.setTimeout(hideToast, 2500);
        }
      });
    }

    /* ---------- Ошибки полей ---------- */
    function setFieldError(input, message) {
      var field = input.closest('.field');
      if (field) field.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');

      var errorId = input.getAttribute('aria-describedby');
      var errorEl = errorId ? doc.getElementById(errorId) : null;
      if (errorEl) errorEl.textContent = message;
    }

    function clearFieldError(input) {
      var field = input.closest('.field');
      if (field) field.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');

      var errorId = input.getAttribute('aria-describedby');
      var errorEl = errorId ? doc.getElementById(errorId) : null;
      if (errorEl) errorEl.textContent = '';
    }

    function validateName() {
      var value = nameInput.value.trim().replace(/\s+/g, ' ');

      if (value.length < 2) {
        setFieldError(nameInput, 'Введите имя — минимум 2 символа');
        return false;
      }

      if (!/[A-Za-zА-Яа-яЁё]/.test(value)) {
        setFieldError(nameInput, 'Имя должно содержать буквы');
        return false;
      }

      clearFieldError(nameInput);
      return true;
    }

    function validatePhone() {
      var digits = onlyDigits(phoneInput.value);

      if (digits.length !== 11 || digits.charAt(0) !== '7') {
        setFieldError(phoneInput, 'Введите номер в формате +7 (999) 123-45-67');
        return false;
      }

      clearFieldError(phoneInput);
      return true;
    }

    function validateConsent() {
      if (!consentError) return consentInput.checked;

      if (!consentInput.checked) {
        consentError.textContent = 'Подтвердите согласие на обработку персональных данных';
        consentError.classList.add('is-visible');
        consentInput.setAttribute('aria-invalid', 'true');
        return false;
      }

      consentError.textContent = '';
      consentError.classList.remove('is-visible');
      consentInput.removeAttribute('aria-invalid');
      return true;
    }

    /* ---------- Маска телефона ---------- */
    function formatPhone(value) {
      var digits = onlyDigits(value);
      if (!digits) return '';

      if (digits.charAt(0) === '8') digits = '7' + digits.slice(1);
      if (digits.charAt(0) === '9') digits = '7' + digits;
      if (digits.charAt(0) !== '7') digits = '7' + digits;
      digits = digits.slice(0, 11);

      var rest = digits.slice(1);
      var result = '+7';

      if (rest.length) result += ' (' + rest.slice(0, 3);
      if (rest.length >= 3) result += ')';
      if (rest.length > 3) result += ' ' + rest.slice(3, 6);
      if (rest.length > 6) result += '-' + rest.slice(6, 8);
      if (rest.length > 8) result += '-' + rest.slice(8, 10);

      return result;
    }

    phoneInput.addEventListener('input', function () {
      var formatted = formatPhone(phoneInput.value);
      if (phoneInput.value !== formatted) phoneInput.value = formatted;
      if (phoneInput.value) clearFieldError(phoneInput);
    });

    // Backspace в конце строки не должен «залипать» на скобке или дефисе
    phoneInput.addEventListener('keydown', function (event) {
      if (event.key !== 'Backspace') return;
      if (phoneInput.selectionStart !== phoneInput.selectionEnd) return;
      if (phoneInput.selectionStart !== phoneInput.value.length) return;

      var lastChar = phoneInput.value.slice(-1);
      if (!lastChar || /^\d$/.test(lastChar)) return;

      var digits = onlyDigits(phoneInput.value);
      if (!digits) return;

      event.preventDefault();
      phoneInput.value = formatPhone(digits.slice(0, -1));
      phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
      clearFieldError(phoneInput);
    });

    phoneInput.addEventListener('blur', function () {
      if (onlyDigits(phoneInput.value).length <= 1) {
        phoneInput.value = '';
        clearFieldError(phoneInput);
        return;
      }
      validatePhone();
    });

    nameInput.addEventListener('input', function () {
      clearFieldError(nameInput);
    });

    nameInput.addEventListener('blur', function () {
      if (nameInput.value.trim()) validateName();
    });

    consentInput.addEventListener('change', function () {
      if (consentInput.checked) validateConsent();
    });

    if (commentInput) {
      var updateCounter = function () {
        if (commentCounter) {
          commentCounter.textContent = commentInput.value.length + ' / 500';
        }
      };
      commentInput.addEventListener('input', updateCounter);
      updateCounter();
    }

    /* ---------- Отправка ---------- */
    function setLoading(loading) {
      submitBtn.disabled = loading;
      submitBtn.classList.toggle('is-loading', loading);
      submitBtn.setAttribute('aria-busy', loading ? 'true' : 'false');
    }

    function resetForm() {
      form.reset();
      [nameInput, phoneInput].forEach(clearFieldError);
      if (consentError) {
        consentError.textContent = '';
        consentError.classList.remove('is-visible');
      }
      consentInput.removeAttribute('aria-invalid');
      if (commentCounter) commentCounter.textContent = '0 / 500';
    }

    function getFirstName() {
      var value = nameInput.value.trim().split(/\s+/)[0] || 'друг';
      return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function wait(ms) {
      return new Promise(function (resolve) {
        window.setTimeout(resolve, ms);
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var nameOk = validateName();
      var phoneOk = validatePhone();
      var consentOk = validateConsent();

      if (!nameOk || !phoneOk || !consentOk) {
        var firstInvalid = !nameOk ? nameInput : (!phoneOk ? phoneInput : consentInput);
        firstInvalid.focus();
        return;
      }

      if (isDemo) {
        var demoName = getFirstName();
        setLoading(true);
        wait(800).then(function () {
          resetForm();
          setLoading(false);
          showToast({
            type: 'success',
            title: 'Заявка отправлена (демо)',
            message: 'Спасибо, ' + demoName + '! Это демо-режим — заявка не ушла. Вставьте Formspree endpoint в js/config.js, и форма заработает по-настоящему.'
          });
        });
        return;
      }

      sendToFormspree();
    });

    async function sendToFormspree() {
      var firstName = getFirstName();
      var sentPhone = phoneInput.value;
      var formData = new FormData(form);
      var controller = new AbortController();
      var timeoutId = window.setTimeout(function () {
        controller.abort();
      }, Number(CONFIG.requestTimeout) || 15000);

      setLoading(true);
      form.setAttribute('aria-busy', 'true');

      try {
        var response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });

        window.clearTimeout(timeoutId);

        if (!response.ok) {
          var details = '';

          try {
            var data = await response.json();
            if (data && Array.isArray(data.errors)) {
              details = data.errors.map(function (item) {
                return item.message;
              }).filter(Boolean).join(' ');
            }
          } catch (parseError) {
            details = '';
          }

          throw new Error(details || 'Сервис ответил ошибкой ' + response.status);
        }

        resetForm();
        showToast({
          type: 'success',
          title: 'Заявка отправлена',
          message: 'Спасибо, ' + firstName + '! Перезвоним в течение 15 минут на номер ' + sentPhone + '.'
        });
      } catch (error) {
        window.clearTimeout(timeoutId);

        var message = error && error.name === 'AbortError'
          ? 'Сервер долго не отвечает. Попробуйте ещё раз или позвоните: +7 (495) 120-24-22.'
          : 'Проверьте интернет и попробуйте снова. Или позвоните нам: +7 (495) 120-24-22.';

        showToast({
          type: 'error',
          title: 'Не удалось отправить',
          message: message
        });

        console.error('[Айсберг] Ошибка отправки формы:', error);
      } finally {
        setLoading(false);
        form.removeAttribute('aria-busy');
      }
    }
  }

  /* ---------------------------------------------------------
     Предзаполнение формы при переходе из каталога
     catalog.html → index.html?product=daikin-ftxb25c#contact
  --------------------------------------------------------- */
  function prefillProductFromQuery() {
    var commentInput = $('#comment');
    if (!commentInput) return;

    var params = new URLSearchParams(window.location.search);
    var productId = params.get('product');
    if (!productId) return;

    var products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    var product = products.find(function (item) {
      return item.id === productId;
    });

    if (!product) return;

    if (!commentInput.value.trim()) {
      commentInput.value = 'Интересует ' + product.brand + ' ' + product.name +
        ' — от ' + formatPrice(product.price) + '. Подскажите стоимость установки.';
      commentInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    var productField = $('#form-product');
    if (productField) {
      productField.value = product.brand + ' ' + product.name;
    }

    if (window.location.hash === '#contact') {
      var card = $('.form-card');
      if (card) {
        card.classList.add('is-highlighted');
        window.setTimeout(function () {
          card.classList.remove('is-highlighted');
        }, 2600);
      }
    }
  }

  /* ---------------------------------------------------------
     Вспомогательные функции
  --------------------------------------------------------- */
  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function normalizeEndpoint(rawValue) {
    var value = String(rawValue || '').trim();
    if (!value) return '';

    if (/^https?:\/\/(www\.)?formspree\.io\/f\/[A-Za-z0-9]+/i.test(value)) {
      return value.replace(/^http:/i, 'https:').replace('www.', '');
    }

    if (/^[A-Za-z0-9]{6,}$/.test(value)) {
      return 'https://formspree.io/f/' + value;
    }

    if (/^f\/[A-Za-z0-9]+$/i.test(value)) {
      return 'https://formspree.io/' + value;
    }

    return '';
  }
})();
