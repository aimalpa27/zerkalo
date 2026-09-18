/**
 * Контент лендинга «Для владельцев» (OwnersScreen) на трёх языках.
 * Для zh/tr/ko показываем английскую версию (B2B-аудитория в Казахстане).
 */
import type { Lang } from '../types'

export const OWNERS_CONTACTS = {
  whatsapp: 'https://wa.me/77087626050',
  whatsappLabel: 'WhatsApp',
  phone: '+7 708 762 6050',
  email: 'info@plait.kz',
}

export interface OwnersContent {
  page_title: string
  hero_badge: string
  hero_title1: string
  hero_title2: string
  hero_desc: string
  cta_apply: string
  stats: Array<{ val: string; label: string }>
  features_title: string
  features: Array<{ title: string; desc: string }>
  how_title: string
  steps: Array<{ title: string; desc: string }>
  pricing_title: string
  popular_badge: string
  plans: Array<{ name: string; price: string; period: string; features: string[] }>
  cta_title: string
  cta_desc: string
}

const ru: OwnersContent = {
  page_title: 'Для владельцев',
  hero_badge: 'QR-платформа для ресторанов',
  hero_title1: 'Цифровое меню и',
  hero_title2: 'автоматизация заказов',
  hero_desc: 'Замените бумажные меню на QR-коды. Гости заказывают сами — официанты успевают больше.',
  cta_apply: 'Оставить заявку',
  stats: [
    { val: '< 30 сек', label: 'время заказа' },
    { val: '6 языков', label: 'интерфейс' },
    { val: '24/7', label: 'без перерывов' },
  ],
  features_title: 'Возможности',
  features: [
    { title: 'QR-меню без приложения', desc: 'Гость сканирует QR-код на столе — мгновенно видит меню и делает заказ прямо с телефона. Без скачивания, без регистрации.' },
    { title: 'Заказы в реальном времени', desc: 'Официанты и кухня получают уведомления мгновенно. Статус каждого блюда виден на экране: принят → кухня → готово → подано.' },
    { title: 'Умное меню', desc: 'Акции, скидки, хиты, новинки. Разделение на кухню и бар. Управляйте доступностью блюд в один клик прямо из админки.' },
    { title: 'Аналитика и выручка', desc: 'Отслеживайте популярные блюда, средний чек, загруженность столов. Все данные в реальном времени в панели администратора.' },
    { title: 'Мультиязычность', desc: 'Меню автоматически на языке гостя: русский, казахский, английский, китайский, турецкий, корейский. Идеально для туристов.' },
    { title: 'PWA — работает как приложение', desc: 'Добавляется на экран телефона как нативное приложение. Работает быстро, без магазина приложений.' },
  ],
  how_title: 'Как это работает',
  steps: [
    { title: 'Регистрация', desc: 'Создаёте аккаунт, добавляете ресторан, загружаете меню.' },
    { title: 'QR-коды на столы', desc: 'Система генерирует уникальный QR для каждого стола. Печатаете и ставите.' },
    { title: 'Гости заказывают', desc: 'Сканируют QR → выбирают → заказ летит на кухню и официанту.' },
    { title: 'Вы управляете', desc: 'Смотрите статусы в реальном времени в панели администратора.' },
  ],
  pricing_title: 'Тарифы',
  popular_badge: 'Популярный',
  plans: [
    { name: 'Старт', price: 'Бесплатно', period: 'навсегда', features: ['1 ресторан', 'До 10 столов', 'QR-меню', 'Заказы со стола', 'Базовая аналитика'] },
    { name: 'Бизнес', price: '9 900 ₸', period: 'в месяц', features: ['До 5 ресторанов', 'Неограниченно столов', 'Акции и скидки', 'Полная аналитика', 'Приоритетная поддержка', 'Своя цветовая тема'] },
    { name: 'Сеть', price: 'По запросу', period: '', features: ['Неограниченно всего', 'White-label решение', 'API интеграция', 'Выделенный менеджер', 'SLA 99.9%'] },
  ],
  cta_title: 'Готовы начать?',
  cta_desc: 'Начните бесплатно — никаких обязательств. Подключите свой ресторан за 30 минут.',
}

const kk: OwnersContent = {
  page_title: 'Иелері үшін',
  hero_badge: 'Мейрамханаларға арналған QR-платформа',
  hero_title1: 'Цифрлық мәзір және',
  hero_title2: 'тапсырыстарды автоматтандыру',
  hero_desc: 'Қағаз мәзірді QR-кодтарға ауыстырыңыз. Қонақтар өздері тапсырыс береді — даяшылар көбірек үлгереді.',
  cta_apply: 'Өтінім қалдыру',
  stats: [
    { val: '< 30 сек', label: 'тапсырыс уақыты' },
    { val: '6 тіл', label: 'интерфейс' },
    { val: '24/7', label: 'үзіліссіз' },
  ],
  features_title: 'Мүмкіндіктер',
  features: [
    { title: 'Қосымшасыз QR-мәзір', desc: 'Қонақ үстелдегі QR-кодты сканерлейді — мәзірді бірден көріп, телефонынан тапсырыс береді. Жүктеусіз, тіркелусіз.' },
    { title: 'Нақты уақыттағы тапсырыстар', desc: 'Даяшылар мен асхана хабарламаларды лезде алады. Әр тағамның статусы экранда көрінеді: қабылданды → асхана → дайын → берілді.' },
    { title: 'Ақылды мәзір', desc: 'Акциялар, жеңілдіктер, хиттер, жаңалықтар. Асхана мен барға бөлу. Тағамдардың қолжетімділігін админ-панельден бір рет басып басқарыңыз.' },
    { title: 'Аналитика және түсім', desc: 'Танымал тағамдарды, орташа чекті, үстелдердің жүктелуін бақылаңыз. Барлық деректер әкімші панелінде нақты уақытта.' },
    { title: 'Көптілділік', desc: 'Мәзір қонақтың тілінде автоматты түрде: орыс, қазақ, ағылшын, қытай, түрік, корей. Туристерге тамаша.' },
    { title: 'PWA — қосымша сияқты жұмыс істейді', desc: 'Телефон экранына нативті қосымша ретінде қосылады. Жылдам жұмыс істейді, қосымшалар дүкені керек емес.' },
  ],
  how_title: 'Қалай жұмыс істейді',
  steps: [
    { title: 'Тіркелу', desc: 'Аккаунт ашасыз, мейрамхананы қосасыз, мәзірді жүктейсіз.' },
    { title: 'Үстелдерге QR-кодтар', desc: 'Жүйе әр үстелге бірегей QR жасайды. Басып шығарып қоясыз.' },
    { title: 'Қонақтар тапсырыс береді', desc: 'QR сканерлейді → таңдайды → тапсырыс асхана мен даяшыға ұшады.' },
    { title: 'Сіз басқарасыз', desc: 'Әкімші панелінде статустарды нақты уақытта көресіз.' },
  ],
  pricing_title: 'Тарифтер',
  popular_badge: 'Танымал',
  plans: [
    { name: 'Старт', price: 'Тегін', period: 'мәңгі', features: ['1 мейрамхана', '10 үстелге дейін', 'QR-мәзір', 'Үстелден тапсырыс', 'Базалық аналитика'] },
    { name: 'Бизнес', price: '9 900 ₸', period: 'айына', features: ['5 мейрамханаға дейін', 'Үстелдер шексіз', 'Акциялар мен жеңілдіктер', 'Толық аналитика', 'Басым қолдау', 'Өз түс тақырыбы'] },
    { name: 'Желі', price: 'Сұраныс бойынша', period: '', features: ['Барлығы шексіз', 'White-label шешім', 'API интеграция', 'Жеке менеджер', 'SLA 99.9%'] },
  ],
  cta_title: 'Бастауға дайынсыз ба?',
  cta_desc: 'Тегін бастаңыз — ешқандай міндеттеме жоқ. Мейрамханаңызды 30 минутта қосыңыз.',
}

const en: OwnersContent = {
  page_title: 'For owners',
  hero_badge: 'QR platform for restaurants',
  hero_title1: 'Digital menu and',
  hero_title2: 'order automation',
  hero_desc: 'Replace paper menus with QR codes. Guests order by themselves — waiters get more done.',
  cta_apply: 'Leave a request',
  stats: [
    { val: '< 30 sec', label: 'order time' },
    { val: '6 languages', label: 'interface' },
    { val: '24/7', label: 'no breaks' },
  ],
  features_title: 'Features',
  features: [
    { title: 'QR menu without an app', desc: 'A guest scans the QR code on the table — instantly sees the menu and orders right from the phone. No downloads, no sign-up.' },
    { title: 'Real-time orders', desc: 'Waiters and the kitchen get notified instantly. Every dish status is on screen: accepted → kitchen → ready → served.' },
    { title: 'Smart menu', desc: 'Promos, discounts, hits, new items. Kitchen/bar separation. Manage dish availability in one click from the admin panel.' },
    { title: 'Analytics & revenue', desc: 'Track popular dishes, average check, table load. All data in real time in the admin panel.' },
    { title: 'Multilingual', desc: 'The menu is automatically in the guest\'s language: Russian, Kazakh, English, Chinese, Turkish, Korean. Perfect for tourists.' },
    { title: 'PWA — works like an app', desc: 'Adds to the phone home screen like a native app. Fast, no app store needed.' },
  ],
  how_title: 'How it works',
  steps: [
    { title: 'Sign up', desc: 'Create an account, add your restaurant, upload the menu.' },
    { title: 'QR codes on tables', desc: 'The system generates a unique QR for every table. Print and place them.' },
    { title: 'Guests order', desc: 'They scan the QR → choose → the order flies to the kitchen and the waiter.' },
    { title: 'You manage', desc: 'Watch statuses in real time in the admin panel.' },
  ],
  pricing_title: 'Pricing',
  popular_badge: 'Popular',
  plans: [
    { name: 'Start', price: 'Free', period: 'forever', features: ['1 restaurant', 'Up to 10 tables', 'QR menu', 'Table ordering', 'Basic analytics'] },
    { name: 'Business', price: '9 900 ₸', period: 'per month', features: ['Up to 5 restaurants', 'Unlimited tables', 'Promos & discounts', 'Full analytics', 'Priority support', 'Custom color theme'] },
    { name: 'Chain', price: 'On request', period: '', features: ['Unlimited everything', 'White-label solution', 'API integration', 'Dedicated manager', 'SLA 99.9%'] },
  ],
  cta_title: 'Ready to start?',
  cta_desc: 'Start for free — no obligations. Connect your restaurant in 30 minutes.',
}

const OWNERS_I18N: Partial<Record<Lang, OwnersContent>> = { ru, kk, en }

export function ownersContent(lang: Lang): OwnersContent {
  return OWNERS_I18N[lang] ?? en
}
