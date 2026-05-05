import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Disable the rate limiter by default for the test suite so we are not
# coupled to wall-clock timing. Tests that exercise the limiter directly
# clear this in their own monkeypatched environment.
os.environ.setdefault("SENTINEL_RATE_LIMIT_DISABLED", "1")
