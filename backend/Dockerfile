FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# collectstatic перенесён в start-команду (CMD ниже), потому что во время
# сборки образа переменные окружения (SECRET_KEY, DATABASE_URL и др.)
# ещё не доступны — Railway их инжектирует только при запуске контейнера.

EXPOSE 8000

# Запускаем collectstatic + миграции + gunicorn одной командой.
# Если какой-то шаг упадёт — контейнер не стартует и Railway покажет ошибку.
CMD ["sh", "-c", "python manage.py collectstatic --noinput && python manage.py migrate && python manage.py seed_plans && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3"]
