import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    print("=== STARTING API VERIFICATION ===")
    
    # 1. Health Check
    try:
        res = requests.get(f"{BASE_URL}/api/health")
        print(f"Health Check: {res.status_code} -> {res.json()}")
    except Exception as e:
        print(f"Failed to connect to backend: {e}")
        return

    # 2. Fetch initial complaints for a road
    # Road 4 is Salem-Namakkal which we seeded with complaint 1
    res = requests.get(f"{BASE_URL}/api/complaints/4")
    complaints = res.json()
    print(f"Initial Complaints for Road 4: Count = {len(complaints)}")
    if complaints:
        c1 = complaints[0]
        print(f"First Complaint: ID={c1['id']}, Ref={c1['complaint_ref_id']}, Upvotes={c1['upvotes']}, VerifScore={c1['verification_score']}, Trust={c1['trust_level']}, Priority={c1['priority_score']}")
        c_id = c1['id']
    else:
        print("No complaints found for Road 4!")
        return

    # 3. Test Upvoting
    print("\n--- Testing Upvoting ---")
    payload = {"device_id": "test_dev_99", "vote_type": "upvote"}
    res = requests.post(f"{BASE_URL}/api/complaints/{c_id}/vote", json=payload)
    if res.status_code == 200:
        updated = res.json()
        print(f"Vote Success! Updated Upvotes={updated['upvotes']}, Priority={updated['priority_score']}, Trust={updated['trust_level']}")
    else:
        print(f"Vote Failed: {res.status_code} -> {res.text}")

    # 4. Test Duplicate Voting (Toggle)
    print("\n--- Testing Vote Toggling (Double Vote) ---")
    res = requests.post(f"{BASE_URL}/api/complaints/{c_id}/vote", json=payload)
    if res.status_code == 200:
        updated = res.json()
        print(f"Toggle Success! Updated Upvotes={updated['upvotes']} (should decrease by 1)")
    else:
        print(f"Toggle Failed: {res.status_code} -> {res.text}")

    # 5. Test Verification
    print("\n--- Testing Verification Actions ---")
    verif_payload = {"device_id": "test_dev_99", "action_type": "confirm"}
    res = requests.post(f"{BASE_URL}/api/complaints/{c_id}/verify", json=verif_payload)
    if res.status_code == 200:
        updated = res.json()
        print(f"Verification Success! Updated VerificationScore={updated['verification_score']}, Priority={updated['priority_score']}")
    else:
        print(f"Verification Failed: {res.status_code} -> {res.text}")

    # 6. Test Trending Complaints Sorting
    print("\n--- Testing Trending Sorting ---")
    res = requests.get(f"{BASE_URL}/api/complaints/trending")
    trending = res.json()
    print(f"Trending count: {len(trending)}")
    for idx, tc in enumerate(trending[:3]):
        print(f"  #{idx+1} Ref: {tc['complaint_ref_id']} - Upvotes: {tc['upvotes']} - Priority: {tc['priority_score']}")

    # 7. Test Priority Sorting
    print("\n--- Testing Priority Sorting ---")
    res = requests.get(f"{BASE_URL}/api/complaints/priority")
    priority = res.json()
    print(f"Priority count: {len(priority)}")
    for idx, pc in enumerate(priority[:3]):
        print(f"  #{idx+1} Ref: {pc['complaint_ref_id']} - Priority: {pc['priority_score']} - Status: {pc['status']}")

    print("\n=== API VERIFICATION COMPLETED ===")

if __name__ == "__main__":
    test_api()
