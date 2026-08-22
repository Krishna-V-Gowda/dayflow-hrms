from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import get_current_user, require_hr
from ..db import get_db
from ..models import Employee, PayrollRecord, User
from ..schemas import PayrollOut, PayrollUpdate
from ..services import audit

router = APIRouter(prefix="/api/payroll", tags=["payroll"])


def serialize(record: PayrollRecord) -> dict:
    return {"id": record.id, "employee_id": record.employee_id, "employee_name": record.employee.full_name,
            "basic_salary": record.basic_salary, "allowances": record.allowances, "deductions": record.deductions,
            "net_salary": record.basic_salary + record.allowances - record.deductions,
            "effective_from": record.effective_from, "updated_at": record.updated_at}


def ensure_record(db: Session, employee: Employee) -> PayrollRecord:
    record = db.query(PayrollRecord).filter(PayrollRecord.employee_id == employee.id).first()
    if not record:
        record = PayrollRecord(employee_id=employee.id, basic_salary=employee.salary)
        db.add(record)
        db.flush()
    return record


@router.get("/me", response_model=PayrollOut)
def my_payroll(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return serialize(ensure_record(db, user.employee))


@router.get("", response_model=list[PayrollOut])
def all_payroll(_: User = Depends(require_hr), db: Session = Depends(get_db)):
    records = [ensure_record(db, employee) for employee in db.query(Employee).order_by(Employee.full_name).all()]
    db.commit()
    return [serialize(record) for record in records]


@router.put("/{employee_id}", response_model=PayrollOut)
def update_payroll(employee_id: int, payload: PayrollUpdate, user: User = Depends(require_hr), db: Session = Depends(get_db)):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(404, "Employee not found")
    record = ensure_record(db, employee)
    for field, value in payload.model_dump().items():
        setattr(record, field, value)
    employee.salary = record.basic_salary
    record.updated_at = datetime.utcnow()
    audit(db, user, "payroll_updated", "payroll", record.id, payload.model_dump())
    db.commit()
    db.refresh(record)
    return serialize(record)