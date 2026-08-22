from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import require_hr
from ..db import get_db
from ..models import Employee, LeaveRequest, LeaveStatus, User

router = APIRouter(prefix="/api/decisions", tags=["decision-engine"])


@router.get("/leave/{leave_id}/impact")
def leave_impact(leave_id: int, _: User = Depends(require_hr), db: Session = Depends(get_db)):
    leave = db.get(LeaveRequest, leave_id)
    if not leave:
        raise HTTPException(404, "Leave request not found")
    team = db.query(Employee).filter(Employee.department == leave.employee.department).all()
    total = len(team)
    team_ids = [employee.id for employee in team]
    absences = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id.in_(team_ids),
        LeaveRequest.status.in_([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
        LeaveRequest.start_date <= leave.end_date,
        LeaveRequest.end_date >= leave.start_date,
    ).all()
    overlapping = [item for item in absences if item.id != leave.id]
    approved = [item for item in overlapping if item.status == LeaveStatus.APPROVED]
    pending = [item for item in overlapping if item.status == LeaveStatus.PENDING]
    current_absent = len({item.employee_id for item in approved})
    projected_absent = len({item.employee_id for item in approved + [leave]})
    current = max(0, total - current_absent)
    projected = max(0, total - projected_absent)
    current_pct = round(current / total * 100, 1) if total else 0
    projected_pct = round(projected / total * 100, 1) if total else 0
    delta = round(projected_pct - current_pct, 1)
    if projected_pct < 60 or projected_absent >= 3:
        risk, recommendation = "high", "Review coverage plan before approving"
    elif projected_pct < 80 or pending:
        risk, recommendation = "moderate", "Approve only after confirming team coverage"
    else:
        risk, recommendation = "low", "Coverage remains healthy; approve if policy allows"
    reasons = [f"{total} employees are in {leave.employee.department}.", f"{current_absent} approved absence(s) overlap the requested dates."]
    if pending:
        reasons.append(f"{len(pending)} other pending request(s) overlap the requested dates.")
    reasons.append(f"Approving this request changes coverage by {delta:+g} percentage points.")
    return {
        "leave_id": leave.id,
        "employee": leave.employee.full_name,
        "department": leave.employee.department,
        "leave_type": leave.leave_type,
        "requested_days": (leave.end_date - leave.start_date).days + 1,
        "current_team_coverage": current_pct,
        "projected_coverage": projected_pct,
        "coverage_delta": delta,
        "overlapping_absences": [{"employee": item.employee.full_name, "status": item.status, "start_date": item.start_date, "end_date": item.end_date} for item in overlapping],
        "risk": risk,
        "recommendation": recommendation,
        "reasons": reasons,
    }