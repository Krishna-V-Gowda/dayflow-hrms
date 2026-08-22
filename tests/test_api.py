from datetime import date, timedelta

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models import Employee, LeaveRequest


client = TestClient(app)


def token(email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    return response


def headers(response):
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def clear_fixture(start):
    db = SessionLocal()
    employee = db.query(Employee).filter(Employee.email == "employee@dayflow.local").first()
    db.query(LeaveRequest).filter(LeaveRequest.employee_id == employee.id, LeaveRequest.start_date == start).delete()
    db.commit()
    db.close()


def test_valid_and_invalid_login():
    assert token("employee@dayflow.local", "Employee123!").status_code == 200
    assert token("employee@dayflow.local", "wrong-password").status_code == 401


def test_browser_frontend_origin_is_allowed():
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_employee_forbidden_from_hr_endpoint():
    employee = token("employee@dayflow.local", "Employee123!")
    assert client.get("/api/employees", headers=headers(employee)).status_code == 403


def test_hr_can_retrieve_audit_with_integer_entity_ids():
    hr = token("hr@dayflow.local", "Admin123!")
    response = client.get("/api/audit", headers=headers(hr))
    assert response.status_code == 200, response.text
    assert all(isinstance(entry["entity_id"], int) for entry in response.json())


def test_duplicate_checkin_rejected():
    employee = token("employee@dayflow.local", "Employee123!")
    first = client.post("/api/attendance/check-in", headers=headers(employee))
    second = client.post("/api/attendance/check-in", headers=headers(employee))
    assert first.status_code in {200, 409}
    assert second.status_code == 409


def test_checkout_without_open_checkin_rejected():
    employee = token("meera@dayflow.local", "Employee123!")
    assert client.post("/api/attendance/check-out", headers=headers(employee)).status_code == 409


def test_leave_validation_creation_and_overlap():
    employee = token("employee@dayflow.local", "Employee123!")
    start = date.today() + timedelta(days=40)
    clear_fixture(start)
    auth = headers(employee)
    invalid_range = client.post("/api/leaves", headers=auth, json={"leave_type": "Paid", "start_date": start.isoformat(), "end_date": (start - timedelta(days=1)).isoformat()})
    assert invalid_range.status_code == 400
    created = client.post("/api/leaves", headers=auth, json={"leave_type": "Sick", "start_date": start.isoformat(), "end_date": start.isoformat()})
    assert created.status_code == 201, created.text
    overlap = client.post("/api/leaves", headers=auth, json={"leave_type": "Paid", "start_date": start.isoformat(), "end_date": start.isoformat()})
    assert overlap.status_code == 409


def test_hr_approval_and_decision_engine():
    employee = token("employee@dayflow.local", "Employee123!")
    hr = token("hr@dayflow.local", "Admin123!")
    start = date.today() + timedelta(days=50)
    clear_fixture(start)
    created = client.post("/api/leaves", headers=headers(employee), json={"leave_type": "Unpaid", "start_date": start.isoformat(), "end_date": start.isoformat()})
    assert created.status_code == 201, created.text
    leave_id = created.json()["id"]
    impact = client.get(f"/api/decisions/leave/{leave_id}/impact", headers=headers(hr))
    assert impact.status_code == 200
    assert impact.json()["leave_id"] == leave_id
    assert impact.json()["reasons"]
    approved = client.patch(f"/api/leaves/{leave_id}", headers=headers(hr), json={"status": "approved", "reviewer_comment": "Coverage confirmed"})
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"


def test_payroll_permissions():
    employee = token("employee@dayflow.local", "Employee123!")
    hr = token("hr@dayflow.local", "Admin123!")
    own = client.get("/api/payroll/me", headers=headers(employee))
    assert own.status_code == 200
    assert client.get("/api/payroll", headers=headers(employee)).status_code == 403
    records = client.get("/api/payroll", headers=headers(hr))
    assert records.status_code == 200
    assert any(item["employee_id"] == own.json()["employee_id"] for item in records.json())