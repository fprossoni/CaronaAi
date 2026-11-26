import unittest
from datetime import datetime, timezone
from app.api.matches import _resolve_pickup_address
from app.schemas.match import MatchRequest


class PickupAddressDetailsTest(unittest.IsolatedAsyncioTestCase):
    async def test_direct_coordinates_preserve_numbered_address(self):
        body = MatchRequest(
            desired_pickup_at=datetime.now(timezone.utc),
            ride_id=1, pickup_lat=-30.04, pickup_lng=-51.2,
            pickup_label="Próximo a Rua Teste, 123", pickup_region="Centro",
            pickup_street="Rua Teste", pickup_number="123",
            pickup_neighborhood="Centro",
        )
        result = await _resolve_pickup_address(None, 1, body)
        self.assertEqual(result[:6], (-30.04, -51.2, body.pickup_label, "Centro", "Rua Teste", "123"))
        self.assertEqual(result[8], "Centro")
