"""Verify privacy at the API boundary, including direct profile access."""
import unittest
from datetime import timedelta

import test_ride_routes as fixtures
from app.models import User


class PrivacyTest(unittest.TestCase):
    setUp = fixtures.RideRoutesTest.setUp
    create_ride = fixtures.RideRoutesTest.create_ride
    pickup_window = fixtures.RideRoutesTest.pickup_window

    def request(self, ride_id):
        self.user_id = 2
        response = self.client.post('/matches/', json={
            'ride_id': ride_id, 'pickup_address_id': 1,
            'dropoff_campus_id': 'campus_saude', **self.pickup_window(),
        })
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()['id']

    def assert_public(self, profile):
        for field in ('email', 'birth_date', 'phone', 'social_link', 'instagram', 'car_plate', 'car_color'):
            self.assertNotIn(field, profile)

    def test_public_private_and_search_vehicle(self):
        driver = self.db.get(User, 1)
        driver.instagram = '@driver'
        self.db.commit()
        private = self.client.get('/users/me').json()
        self.assertEqual(private['email'], driver.email)
        self.assertEqual(private['car_plate'], 'ABC1C34')
        self.assertTrue(private['profile_complete'])
        ride_id = self.create_ride()
        self.user_id = 2
        self.assert_public(self.client.get('/users/1').json())
        self.assert_public(self.client.get(f'/rides/{ride_id}').json()['driver'])
        search = self.client.get('/rides/search', params={
            'pickup_lat': -30.034, 'pickup_lng': -51.219,
            'dropoff_campus_id': 'campus_saude', **self.pickup_window(),
        })
        self.assertEqual(search.status_code, 200, search.text)
        self.assertEqual(len(search.json()), 1)
        public = search.json()[0]['driver']
        self.assert_public(public)
        self.assertEqual((public['car_brand'], public['car_model']), ('Volkswagen', 'Gol'))

    def test_confirmation_only_and_cancellation_revokes_details(self):
        ride_id = self.create_ride()
        match_id = self.request(ride_id)
        self.user_id = 1
        pending = self.client.get(f'/matches/ride/{ride_id}').json()[0]
        self.assert_public(pending['passenger'])
        self.assertIsNone(pending['passenger_phone'])
        pending_detail = self.client.get(f'/matches/{match_id}').json()
        self.assertIsNone(pending_detail['passenger'])
        self.assertIsNone(pending_detail['pickup_lat'])
        accepted = self.client.patch(f'/matches/{match_id}/respond', json={'action': 'accept'})
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.user_id = 2
        detail = self.client.get(f'/matches/{match_id}').json()
        self.assertEqual(detail['driver']['car_plate'], 'ABC1C34')
        self.assertEqual(detail['driver']['car_color'], 'Prata')
        self.assertEqual(detail['driver']['phone'], '(51) 99999-9999')
        self.assertNotIn('email', detail['driver'])
        self.assertNotIn('birth_date', detail['driver'])
        self.assertIsNotNone(detail['pickup_lat'])
        self.user_id = 3
        self.assertEqual(self.client.get(f'/matches/{match_id}').status_code, 403)
        self.user_id = 2
        self.assertEqual(self.client.patch(f'/matches/{match_id}/cancel').status_code, 200)
        detail = self.client.get(f'/matches/{match_id}').json()
        self.assertIsNone(detail['driver'])
        self.assertIsNone(detail['driver_car_plate'])
        self.user_id = 1
        self.assertIsNone(self.client.get(f'/matches/{match_id}').json()['pickup_lat'])

    def test_profile_required_for_search_request_and_offer(self):
        ride_id = self.create_ride()
        self.user_id = 2
        passenger = self.db.get(User, 2)
        passenger.phone = None
        self.db.commit()
        self.assertFalse(self.client.get('/users/me').json()['profile_complete'])
        response = self.client.post('/matches/', json={
            'ride_id': ride_id, 'pickup_address_id': 1,
            'dropoff_campus_id': 'campus_saude', **self.pickup_window(),
        })
        self.assertEqual(response.status_code, 403)
        search = self.client.get('/rides/search', params={
            'pickup_lat': -30.034, 'pickup_lng': -51.219,
            'dropoff_campus_id': 'campus_saude', **self.pickup_window(),
        })
        self.assertEqual(search.status_code, 403)
        updated = self.client.patch('/users/me', json={'phone': '(51) 99999-9999'})
        self.assertEqual(updated.status_code, 200)
        self.assertTrue(updated.json()['profile_complete'])
        self.user_id = 1
        self.db.get(User, 1).car_brand = None
        self.db.commit()
        response = self.client.post('/rides/', json={
            'origin_lat': -30.033, 'origin_lng': -51.221,
            'destination_campus_id': 'campus_saude',
            'departure_at': (self.departure + timedelta(hours=1)).isoformat(),
        })
        self.assertEqual(response.status_code, 403)
        updated = self.client.patch('/users/me', json={'car_brand': 'Volkswagen'})
        self.assertTrue(updated.json()['profile_complete'])

    def test_block_prevents_confirmation_and_profile_access(self):
        ride_id = self.create_ride()
        match_id = self.request(ride_id)
        self.assertEqual(self.client.post('/users/1/block').status_code, 201)
        self.assertEqual(self.client.get('/users/1').status_code, 404)
        self.user_id = 1
        self.assertEqual(self.client.patch(f'/matches/{match_id}/respond', json={'action': 'accept'}).status_code, 403)

    def test_invalid_phone_rejected(self):
        self.assertEqual(self.client.patch('/users/me', json={'phone': '123'}).status_code, 422)

    def test_incomplete_passenger_cannot_be_confirmed(self):
        ride_id = self.create_ride()
        match_id = self.request(ride_id)
        self.db.get(User, 2).phone = None
        self.db.commit()
        self.user_id = 1
        response = self.client.patch(f'/matches/{match_id}/respond', json={'action': 'accept'})
        self.assertEqual(response.status_code, 409)
