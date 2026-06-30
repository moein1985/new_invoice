import sys, json
data = json.load(sys.stdin)
print("Items:", len(data))
for i, x in enumerate(data):
    if "result" in x:
        d = x["result"]["data"]["json"]
        if isinstance(d, list):
            print(f"  [{i}]: OK, count={len(d)}")
        else:
            print(f"  [{i}]: OK")
    elif "error" in x:
        err = x.get("error", {}).get("json", {})
        print(f"  [{i}]: ERROR - {err.get('code', '?')}: {err.get('message', '?')[:60]}")
    else:
        print(f"  [{i}]: UNKNOWN format")
