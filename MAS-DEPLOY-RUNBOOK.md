# IBM MAS Manage — Automation Script Deploy Runbook

> Generic, reusable. Works for any Automation Script + Object Launch Point.

---

## URLs

| Variable | Pattern |
|----------|---------|
| `AUTH` | `https://auth.<domain>` |
| `BASE` | `https://<tenant>.manage.<domain>` |
| `BASE_ALL` | `https://<tenant>-all.manage.<domain>` ← **use this for all API calls** |

> `BASE_ALL` is not obvious — it appears in error response URLs. Always use it for REST, not `BASE`.

---

## Authentication

OIDC only. No `apikey` header. No `/maximo/api/v1` (always 500). No shortcuts.

```python
import requests, pickle

session = requests.Session()

# 1. Collect OIDC state cookies
session.get(f"{BASE}/maximo/oslc/whoami", allow_redirects=False)

# 2. Follow authorize → /login chain
r = session.get(f"{AUTH}/oidc/endpoint/MaximoAppSuite/authorize"
                f"?scope=openid&response_type=code&client_id=manage"
                f"&redirect_uri={BASE}/oidcclient/redirect/oidc",
                allow_redirects=False)
loc = r.headers.get("Location", "")
session.get(loc if loc.startswith("http") else f"{AUTH}{loc}", allow_redirects=False)

# 3. POST credentials
r = session.post(f"{AUTH}/j_security_check",
    data={"j_username": USERNAME, "j_password": PASSWORD},
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    allow_redirects=False)

# 4. Complete code exchange
session.get(r.headers["Location"], allow_redirects=True)

# Verify
assert session.get(f"{BASE_ALL}/maximo/oslc/whoami?lean=1",
    headers={"Accept": "application/json"}, allow_redirects=False).status_code == 200

# Save / restore
pickle.dump(session.cookies, open("/tmp/mas_session.pkl", "wb"))
# session.cookies.update(pickle.load(open("/tmp/mas_session.pkl", "rb")))
```

---

## Deploy Script

**Endpoint:** `POST {BASE_ALL}/maximo/oslc/os/mxapiautoscript`

```python
r = session.post(
    f"{BASE_ALL}/maximo/oslc/os/mxapiautoscript",
    json={
        "autoscript":     "BOB_<NAME>",          # Bob_ prefix mandatory
        "description":    "<description>",
        "scriptlanguage": "jython",
        "version":        "1.0",
        "source":         open("script.py").read()
        # ← NO "status" field on create
    },
    headers={"Accept": "application/json", "Content-Type": "application/json"},
    allow_redirects=False
)
assert r.status_code == 201
```

**Activate** (created as Draft — must patch separately):

```python
script_href = session.get(
    f"{BASE_ALL}/maximo/oslc/os/mxapiautoscript?lean=1"
    "&oslc.where=autoscript%3D%22BOB_<NAME>%22&oslc.select=href",
    headers={"Accept": "application/json"}, allow_redirects=False
).json()["member"][0]["href"]

session.post(script_href, json={"status": "Active"},
    headers={"Accept": "application/json", "Content-Type": "application/json",
             "x-method-override": "PATCH", "patchtype": "MERGE"},
    allow_redirects=False)
```

---

## Create Launch Point

**PATCH the script href** with an embedded `scriptlaunchpoint` array.

```python
# Create (eventtype "0" = INIT is the only valid string on create)
session.post(script_href,
    json={"scriptlaunchpoint": [{
        "launchpointname": "BOB_<NAME>_LP",
        "description":     "<description>",
        "launchpointtype": "OBJECT",
        "objectname":      "<MBONAME>",    # e.g. WORKORDER
        "active":          True,
        "eventtype":       "0"             # ← must be "0", not "INIT" or "INITSAVE"
    }]},
    headers={"Accept": "application/json", "Content-Type": "application/json",
             "x-method-override": "PATCH", "patchtype": "MERGE"},
    allow_redirects=False)

# Enable SAVE event (add = INIT, update = SAVE)
lp_localref = session.get(f"{script_href}/scriptlaunchpoint?lean=1",
    headers={"Accept": "application/json"}, allow_redirects=False
).json()["member"][0]["localref"]

session.post(lp_localref,
    json={"launchpointname": "BOB_<NAME>_LP", "add": True, "update": True},
    headers={"Accept": "application/json", "Content-Type": "application/json",
             "x-method-override": "PATCH", "patchtype": "MERGE"},
    allow_redirects=False)
```

---

## Verify

```python
s = session.get(f"{script_href}?lean=1", headers={"Accept":"application/json"}, allow_redirects=False).json()
print(s["autoscript"], s.get("status_description") or s.get("status"))  # → BOB_<NAME>  Active

lp = session.get(f"{lp_localref}?lean=1", headers={"Accept":"application/json"}, allow_redirects=False).json()
print(lp["launchpointname"], lp["objectname"], lp["add"], lp["update"])  # → BOB_<NAME>_LP  <OBJ>  True  True
```

---

## Quick-Fail Reference

| Error | Cause | Fix |
|-------|-------|-----|
| `302` on `/maximo/oslc/*` | No session | Complete auth flow first |
| `500 BMXAA1649E` | `/maximo/api/v1` is broken on this instance | Never use it — use `/oslc/os/mxapiautoscript` |
| `400 BMXAA9260E` | Used `/maximo/oslc/script` (runner, not manager) | Use `/oslc/os/mxapiautoscript` |
| `400 BMXAA4190E` | Sent `"status"` on create | Omit on create; PATCH after |
| `400 BMXAA4049E` | `eventtype` = `"INIT"` / `"SAVE"` / `"INITSAVE"` | Use `"0"` only |
| `400 BMXAA1339E` | LP PATCH missing `launchpointname` key | Always include it in every LP PATCH |
