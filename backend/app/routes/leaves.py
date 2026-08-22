from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import get_current_user, require_hr
from ..db import get_db
from ..models import Employee, LeaveRequest, LeaveStatus, User
from ..schemas import LeaveCreate, LeaveDecision, LeaveOut

router = APIRouter(prefix="/api/leaves", tags=["leaves"])


def serialize(item: LeaveRequest) -> dict:
    return {
        "id": item.id,
        "employee_id": item.employee_id,
        "employee_name": item.employee.full_name,
        "leave_type": item.leave_type,
        "start_date": item.start_date,
        "end_date": item.end_date,
        "remarks": item.remarks,
        "status": item.status,
        "reviewer_comment": item.reviewer_comment,
        "created_at": item.created_at,
    }


@router.get("", response_model=list[LeaveOut])
def list_leaves(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(LeaveRequest).order_by(LeaveRequest.created_at.desc())
    if not (user.role.value if hasattr(user.role, "value") else str(user.role)) == "hr":
        employee = db.query(Employee).filter(Employee.user_id == user.id).first()
        query = query.filter(LeaveRequest.employee_id == employee.id)
    return [serialize(item) for item in query.all()]


@router.post("", response_model=LeaveOut, status_code=201)
def create_leave(payload: LeaveCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.user_id == user.id).first()
    if payload.end_date < payload.start_date:
        raise HTTPException(400, "End date cannot be before start date")
    if (payload.end_date - payload.start_date).days + 1 > 30:
        raise HTTPException(400, "Leave request cannot exceed 30 days")
    overlap = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == employee.id,
        LeaveRequest.status == LeaveStatus.PENDING,
        LeaveRequest.start_date <= payload.end_date,
        LeaveRequest.end_date >= payload.start_date,
    ).first()
    if overlap:
        raise HTTPException(409, "An overlapping pending leave request already exists")
    item = LeaveRequest(
        employee_id=employee.id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        remarks=payload.remarks,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize(item)


@router.patch("/{leave_id}", response_model=LeaveOut)
def decide_leave(
    leave_id: int,
    payload: LeaveDecision,
    _: User = Depends(require_hr),
    db: Session = Depends(get_db),
):
    item = db.get(LeaveRequest, leave_id)
    if not item:
        raise HTTPException(404, "Leave request not found")
    if item.status != LeaveStatus.PENDING:
        raise HTTPException(409, "Only pending requests can be decided")
    item.status = payload.status
    item.reviewer_comment = payload.reviewer_comment
    item.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return serialize(item)
