from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from .models import LeaveStatus


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class UserLogin(BaseModel):
    email: str
    password: str


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_code: str
    full_name: str
    email: str
    department: str
    job_title: str
    salary: float
    phone: str
    address: str


class EmployeeSelfUpdate(BaseModel):
    phone: str = Field(default="", max_length=30)
    address: str = Field(default="", max_length=255)


class EmployeeUpdate(EmployeeSelfUpdate):
    department: str = Field(min_length=1, max_length=100)
    job_title: str = Field(min_length=1, max_length=100)
    salary: float = Field(ge=0)


class LeaveCreate(BaseModel):
    leave_type: str = Field(min_length=2, max_length=30)
    start_date: date
    end_date: date
    remarks: str = Field(default="", max_length=500)

    @field_validator("leave_type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        normalized = value.strip().title()
        if normalized not in {"Paid", "Sick", "Unpaid"}:
            raise ValueError("Leave type must be Paid, Sick, or Unpaid")
        return normalized


class LeaveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: int
    employee_name: str
    leave_type: str
    start_date: date
    end_date: date
    remarks: str
    status: LeaveStatus
    reviewer_comment: str
    created_at: datetime


class LeaveDecision(BaseModel):
    status: LeaveStatus
    reviewer_comment: str = Field(default="", max_length=500)

    @field_validator("status")
    @classmethod
    def validate_decision(cls, value: LeaveStatus) -> LeaveStatus:
        if value not in {LeaveStatus.APPROVED, LeaveStatus.REJECTED}:
            raise ValueError("Decision must be approved or rejected")
        return value


class AttendanceOut(BaseModel):
    id: int
    employee_name: str
    work_date: date
    check_in: Optional[datetime]
    check_out: Optional[datetime]
    status: str
    duration_minutes: Optional[int]
    signal: Optional[str] = None


class PayrollOut(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    basic_salary: float
    allowances: float
    deductions: float
    net_salary: float
    effective_from: date
    updated_at: datetime


class PayrollUpdate(BaseModel):
    basic_salary: float = Field(ge=0)
    allowances: float = Field(ge=0)
    deductions: float = Field(ge=0)
    effective_from: date


class NotificationOut(BaseModel):
    id: int
    notification_type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime


class AuditOut(BaseModel):
    id: int
    actor_name: str
    action: str
    entity_type: str
    entity_id: int
    details: str
    created_at: datetime
