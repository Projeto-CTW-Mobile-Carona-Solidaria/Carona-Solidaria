"""Smoke test against the running local API and observability stack (stdlib only)."""
import base64
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
GRAFANA_URL = "http://127.0.0.1:" + os.environ.get("GRAFANA_PORT", "3300")
password = (ROOT / "observability/.secrets/grafana-admin-password").read_text().strip()
authorization = "Basic " + base64.b64encode(("admin:" + password).encode()).decode()


def get(url, grafana=False):
    request = Request(url, headers={"Authorization": authorization} if grafana else {})
    try:
        with urlopen(request, timeout=10) as response:
            return json.load(response)
    except HTTPError as error:
        # Do not dump responses, configuration or credentials on failure.
        raise AssertionError(f"HTTP {error.code}: {url.split('?')[0]}") from None


def eventually(check, message):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            if check():
                return
        except (URLError, AssertionError):
            pass
        time.sleep(2)
    raise AssertionError(message)


def prometheus(query):
    result = get("http://127.0.0.1:9090/api/v1/query?" + urlencode({"query": query}))
    assert result["status"] == "success", "Prometheus query failed"
    return result["data"]["result"]


def logs(query):
    url = GRAFANA_URL + "/api/datasources/proxy/uid/carona-loki/loki/api/v1/query_range?"
    result = get(url + urlencode({"query": query, "since": "1h", "limit": 10}), grafana=True)
    assert result["status"] == "success", "Loki query failed"
    return result["data"]["result"]


def interpolate(expression):
    for variable, value in {
        "$__rate_interval": "1m", "$__range": "1h", "$__auto": "1m", "$instance": ".*",
        "${level:regex}": ".*", "${search:doublequote}": '""',
        "${request_id:doublequote}": '".*"',
    }.items():
        expression = expression.replace(variable, value)
    assert "$" not in expression, "Unresolved dashboard variable"
    return expression


eventually(
    lambda: any(row["value"][1] == "1" for row in prometheus('up{job="carona-backend"}')),
    "Prometheus could not scrape the API. Check the port and metrics token.",
)

# A denied API request generates a real access log without changing application data.
try:
    urlopen("http://127.0.0.1:8079/api/me", timeout=10)
    raise AssertionError("The API must require authentication")
except HTTPError as error:
    assert error.code == 401, "Expected an unauthenticated API request"
    request_id = error.headers.get("X-Request-ID")
    assert request_id, "Missing X-Request-ID on API response"

query = '{application="carona-solidaria",level="WARN"} | json | requestId=' + json.dumps(request_id)
eventually(lambda: bool(logs(query)), "Alloy/Loki did not ingest the API request log.")

panels = 0
queries = 0
for uid in ("carona-api", "carona-logs"):
    result = get(f"{GRAFANA_URL}/api/dashboards/uid/{uid}", grafana=True)
    assert result["meta"]["provisioned"], f"Dashboard {uid} is not provisioned"
    for panel in result["dashboard"]["panels"]:
        panels += 1
        for target in panel.get("targets", []):
            expression = interpolate(target["expr"])
            if target["datasource"]["uid"] == "carona-prometheus":
                prometheus(expression)
            else:
                logs(expression)
            queries += 1

print(f"OK: API scrape, request log ingestion, 2 provisioned dashboards, {panels} panels, {queries} queries.")
