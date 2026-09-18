from unittest.mock import patch

from django.core.cache import cache
from django.db import OperationalError
from django.test import SimpleTestCase, TestCase, override_settings


class LivenessTests(SimpleTestCase):
    def test_live_is_public_small_and_no_store(self):
        response = self.client.get('/health/live')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok', 'service': 'plait-api'})
        self.assertIn('no-cache', response.headers['Cache-Control'])
        self.assertEqual(response.headers['X-Plait-Probe'], 'live')

    def test_live_rejects_post(self):
        self.assertEqual(self.client.post('/health/live').status_code, 405)


class ReadinessTests(TestCase):
    @patch('config.health._check_realtime')
    def test_ready_checks_database_cache_and_realtime_without_auth(self, _realtime):
        response = self.client.get('/health/ready')
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['status'], 'ready')
        self.assertTrue(body['checks']['database']['ok'])
        self.assertTrue(body['checks']['cache']['ok'])
        self.assertTrue(body['checks']['realtime']['ok'])
        self.assertNotIn('url', str(body).lower())

    @patch('config.health._check_realtime')
    @patch('config.health._check_database', side_effect=OperationalError('secret-db-host'))
    def test_dependency_failure_is_503_and_does_not_leak_exception(self, _db, _realtime):
        response = self.client.get('/health/ready')
        self.assertEqual(response.status_code, 503)
        body = response.json()
        self.assertEqual(body['status'], 'not_ready')
        self.assertFalse(body['checks']['database']['ok'])
        self.assertNotIn('secret-db-host', response.content.decode())

    @patch('config.health._check_realtime')
    @patch('config.health._check_cache', side_effect=RuntimeError('secret-cache-host'))
    def test_cache_failure_is_503_and_does_not_leak_exception(self, _cache, _realtime):
        response = self.client.get('/health/ready')
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()['checks']['cache']['ok'])
        self.assertNotIn('secret-cache-host', response.content.decode())

    @patch('config.health._check_realtime', side_effect=RuntimeError('secret-redis-host'))
    def test_realtime_failure_is_503_and_does_not_leak_exception(self, _realtime):
        response = self.client.get('/health/ready')
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()['checks']['realtime']['ok'])
        self.assertNotIn('secret-redis-host', response.content.decode())
