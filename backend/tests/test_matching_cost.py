from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.core.config import settings
from app.schemas.ride import SearchRidesRequest
from app.services.matching import RideCandidate


TARGET = datetime(2030, 1, 2, 0, 30, tzinfo=UTC)


def candidate(minutes=0, meters=0, seconds=0):
    return RideCandidate(
        ride=SimpleNamespace(departure_at=TARGET - timedelta(minutes=30)),
        detour_meters=meters, detour_seconds=seconds,
        estimated_pickup_at=TARGET + timedelta(minutes=minutes),
    )


def test_combined_cost_prefers_small_detour_over_exact_time():
    close = candidate(3, 500, 120)
    punctual = candidate(0, 2500, 480)
    distant = candidate(10, 200, 60)
    for option in (close, punctual, distant):
        option.rank(TARGET)
    assert close.match_cost < distant.match_cost < punctual.match_cost
    assert close.match_cost == pytest.approx(0.0895)


def test_cost_is_symmetric_and_configurable(monkeypatch):
    early, late = candidate(-10), candidate(10)
    early.rank(TARGET)
    late.rank(TARGET)
    assert early.match_cost == late.match_cost
    assert early.pickup_difference_seconds == -600
    monkeypatch.setattr(settings, "MATCH_TIME_WEIGHT", 0.9)
    late.rank(TARGET)
    assert late.match_cost == pytest.approx(2 * early.match_cost)


def test_single_time_derives_window_across_midnight():
    request = SearchRidesRequest(desired_pickup_at=TARGET)
    assert request.pickup_after == TARGET - timedelta(hours=2)
    assert request.pickup_before == TARGET + timedelta(hours=2)
    assert request.pickup_after.day == 1


@pytest.mark.parametrize("payload", [{}, {"desired_pickup_at": "2030-01-02T08:00:00"},
    {"desired_pickup_at": TARGET, "pickup_after": TARGET}])
def test_invalid_time_contract(payload):
    with pytest.raises(ValidationError):
        SearchRidesRequest(**payload)


def test_hard_limits_include_boundary_and_reject_excess():
    request = SearchRidesRequest(desired_pickup_at=TARGET)
    option = candidate(120, 10000, 7200)
    option.ride.departure_at = TARGET
    assert option.rejection_reason(request.pickup_after, request.pickup_before) is None
    option.detour_meters += 1
    assert option.rejection_reason(request.pickup_after, request.pickup_before)
    option.detour_meters = 0
    option.estimated_pickup_at += timedelta(seconds=1)
    assert option.rejection_reason(request.pickup_after, request.pickup_before)


def test_legacy_window_is_preserved():
    request = SearchRidesRequest(pickup_after=TARGET, pickup_before=TARGET + timedelta(minutes=10))
    assert request.desired_pickup_at is None
    assert request.pickup_after == TARGET
